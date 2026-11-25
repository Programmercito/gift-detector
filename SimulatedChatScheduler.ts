export type ScheduledTextSender = (sender: string, text: string, durationSeconds: number) => Promise<void>;
export type ScheduleTimeout = (callback: () => void, delayMs: number) => () => void;

const scheduleTimeout: ScheduleTimeout = (callback, delayMs) => {
    const timer = setTimeout(callback, delayMs);
    timer.unref?.();
    return () => clearTimeout(timer);
};

type QueuedMessage = {
    sender: string;
    text: string;
    resolve: () => void;
    reject: (error: unknown) => void;
};

export class SimulatedChatScheduler {
    private readonly realMessages: QueuedMessage[] = [];
    private cancelWait: (() => void) | undefined;
    private started = false;
    private initialMessagePending = true;
    private displaying = false;
    private realEventPauses = 0;
    private lastMessageIndex = -1;

    constructor(
        private readonly sendText: ScheduledTextSender,
        private readonly simulatedMessages: string[],
        private readonly simulatedSenders: string[] = [],
        private readonly durationSeconds = 60,
        private readonly intervalMs = 60_000,
        private readonly random: () => number = Math.random,
        private readonly schedule: ScheduleTimeout = scheduleTimeout,
    ) {}

    start(): void {
        if (this.started) return;
        this.started = true;
        this.initialMessagePending = true;
        this.pump();
    }

    stop(): void {
        this.started = false;
        this.cancelWait?.();
        this.cancelWait = undefined;
    }

    sendRealMessage(sender: string, text: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.realMessages.push({ sender, text, resolve, reject });
            this.cancelWait?.();
            this.cancelWait = undefined;
            this.initialMessagePending = false;
            this.pump();
        });
    }

    pauseForRealEvent(durationSeconds: number): () => void {
        this.realEventPauses += 1;
        this.cancelWait?.();
        this.cancelWait = undefined;
        this.initialMessagePending = false;

        let released = false;
        let cancelTimeout = () => {};
        const release = () => {
            if (released) return;
            released = true;
            cancelTimeout();
            this.realEventPauses -= 1;
            this.pump();
        };

        cancelTimeout = this.schedule(release, durationSeconds * 1000);
        return release;
    }

    private pump(): void {
        if (this.displaying) return;

        const realMessage = this.realMessages.shift();
        if (realMessage) {
            this.display(realMessage.sender, realMessage.text, realMessage);
            return;
        }

        if (this.realEventPauses > 0) return;
        if (!this.started || this.simulatedMessages.length === 0) return;
        if (this.initialMessagePending) {
            this.initialMessagePending = false;
            this.cancelWait = this.schedule(() => {
                this.cancelWait = undefined;
                this.sendSimulatedMessage();
            }, this.intervalMs);
            return;
        }

        this.sendSimulatedMessage();
    }

    private sendSimulatedMessage(): void {
        if (this.realEventPauses > 0) return;
        if (this.realMessages.length > 0) {
            this.pump();
            return;
        }

        const index = this.pickMessageIndex();
        const text = this.simulatedMessages[index];
        if (text === undefined) return;
        this.lastMessageIndex = index;
        this.display(this.simulatedSenders[index] ?? '@comunidad', text);
    }

    private pickMessageIndex(): number {
        if (this.simulatedMessages.length <= 1) return 0;
        const randomIndex = Math.min(
            this.simulatedMessages.length - 1,
            Math.floor(this.random() * this.simulatedMessages.length),
        );
        return randomIndex === this.lastMessageIndex
            ? (randomIndex + 1) % this.simulatedMessages.length
            : randomIndex;
    }

    private display(sender: string, text: string, queuedMessage?: QueuedMessage): void {
        this.displaying = true;
        void this.sendText(sender, text, this.durationSeconds).then(() => {
            this.schedule(() => {
                this.displaying = false;
                queuedMessage?.resolve();
                this.pump();
            }, this.durationSeconds * 1000);
        }).catch(error => {
            this.displaying = false;
            queuedMessage?.reject(error);
            if (queuedMessage) {
                this.pump();
            } else if (this.started) {
                this.initialMessagePending = true;
                this.pump();
            }
        });
    }
}
