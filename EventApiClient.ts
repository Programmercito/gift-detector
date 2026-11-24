import { EVENT_API_URL } from './config';

const DIAMOND_MESSAGE_DURATION_SECONDS = 60;
export const GIFT_DURATION_SECONDS = 10;

export class EventApiClient {
    constructor(
        private readonly url: string = EVENT_API_URL,
        private readonly fetchImpl: typeof fetch = fetch,
    ) {}

    async sendText(sender: string, text: string, duration: number = DIAMOND_MESSAGE_DURATION_SECONDS): Promise<void> {
        await this.sendEvent({
            action: 'text',
            sender: sender.slice(0, 64),
            text,
            duration,
        });
    }

    async sendGift(sender: string | undefined, gift: string, count: number): Promise<void> {
        await this.sendEvent({
            action: 'gift',
            sender: sender?.slice(0, 64),
            gift: gift.slice(0, 80),
            count,
            duration: GIFT_DURATION_SECONDS,
        });
    }

    private async sendEvent(event: Record<string, string | number | undefined>): Promise<void> {
        const response = await this.fetchImpl(this.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event),
        });
        if (!response.ok) {
            throw new Error(`Event API returned HTTP ${response.status}`);
        }
    }
}
