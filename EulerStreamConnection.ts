import { deserializeWebSocketMessage } from 'tiktok-live-connector';

export type EulerLiveEvent = { type: string; data: Record<string, any> };

type SocketEvent = { data?: unknown; code?: number };
type SocketListener = (event: SocketEvent) => void;

type WebSocketLike = {
    binaryType: string;
    addEventListener(type: string, listener: SocketListener): void;
    close(code?: number): void;
};

type DecodedMessage = { decodedData?: EulerLiveEvent };
type DecodedFrame = { protoMessageFetchResult?: { messages?: DecodedMessage[] } };
type FrameDecoder = (frame: Uint8Array) => Promise<DecodedFrame>;
type SocketFactory = (url: string) => WebSocketLike;

const RECONNECT_DELAY_MS = 30_000;
const TERMINAL_CLOSE_CODES = new Set([4400, 4401, 4403]);

export function createEulerStreamWebSocketUrl(username: string, apiKey: string): string {
    if (!apiKey) throw new Error('API_KEY must be set in .env');

    const url = new URL('wss://ws.eulerstream.com');
    url.searchParams.set('uniqueId', username);
    url.searchParams.set('apiKey', apiKey);
    url.searchParams.set('features.rawMessages', 'true');
    url.searchParams.set('features.bundleEvents', 'false');
    url.searchParams.set('features.schemaVersion', 'v3');
    return url.toString();
}

function createNativeWebSocket(url: string): WebSocketLike {
    return new WebSocket(url) as unknown as WebSocketLike;
}

async function toUint8Array(data: unknown): Promise<Uint8Array | undefined> {
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    if (typeof Blob !== 'undefined' && data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
    return undefined;
}

function isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null;
}

export class EulerStreamConnection {
    private socket: WebSocketLike | undefined;
    private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    private shouldReconnect = false;
    private messageQueue = Promise.resolve();

    constructor(
        private readonly username: string,
        private readonly apiKey: string | undefined,
        private readonly onEvent: (event: EulerLiveEvent) => Promise<void> | void,
        private readonly socketFactory: SocketFactory = createNativeWebSocket,
        private readonly frameDecoder: FrameDecoder = deserializeWebSocketMessage as unknown as FrameDecoder,
    ) {}

    connect(): void {
        this.shouldReconnect = true;
        this.openSocket();
    }

    disconnect(): void {
        this.shouldReconnect = false;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.socket?.close(1000);
        this.socket = undefined;
    }

    private openSocket(): void {
        let socket: WebSocketLike;
        try {
            const url = createEulerStreamWebSocketUrl(this.username, this.apiKey ?? '');
            socket = this.socketFactory(url);
        } catch (error) {
            this.shouldReconnect = false;
            throw error;
        }

        socket.binaryType = 'arraybuffer';
        this.socket = socket;

        socket.addEventListener('open', () => {
            console.info(`Connected to Euler Stream for @${this.username}.`);
        });

        socket.addEventListener('message', event => {
            this.messageQueue = this.messageQueue
                .then(() => this.processMessage(event.data))
                .catch(() => console.error('Failed to decode a message from Euler Stream.'));
        });

        socket.addEventListener('error', () => {
            console.error('Euler Stream WebSocket error.');
        });

        socket.addEventListener('close', event => {
            if (this.socket === socket) this.socket = undefined;
            if (!this.shouldReconnect) return;

            console.warn(`Euler Stream WebSocket closed with code ${event.code ?? 0}.`);
            if (event.code !== undefined && TERMINAL_CLOSE_CODES.has(event.code)) {
                this.shouldReconnect = false;
                console.error('Not reconnecting; check the Euler API key and WebSocket settings.');
                return;
            }

            this.reconnectTimer = setTimeout(() => this.openSocket(), RECONNECT_DELAY_MS);
            this.reconnectTimer.unref?.();
        });
    }

    private async processMessage(data: unknown): Promise<void> {
        if (typeof data === 'string') {
            this.dispatchJson(data);
            return;
        }

        const bytes = await toUint8Array(data);
        if (!bytes) return;

        const frame = await this.frameDecoder(bytes);
        for (const message of frame.protoMessageFetchResult?.messages ?? []) {
            if (message.decodedData) await this.dispatch(message.decodedData);
        }
    }

    private dispatchJson(text: string): void {
        let payload: unknown;
        try {
            payload = JSON.parse(text);
        } catch {
            return;
        }

        if (!isRecord(payload)) return;
        const messages = Array.isArray(payload.messages) ? payload.messages : [payload];
        for (const message of messages) {
            if (isRecord(message) && typeof message.type === 'string' && isRecord(message.data)) {
                void this.dispatch({ type: message.type, data: message.data });
            }
        }
    }

    private async dispatch(event: EulerLiveEvent): Promise<void> {
        try {
            await this.onEvent(event);
        } catch {
            console.error(`Failed to handle Euler Stream event ${event.type}.`);
        }
    }
}
