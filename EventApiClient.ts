import { COMMENT_DURATION_SECONDS, EVENT_API_URL } from './config';

export class EventApiClient {
    constructor(
        private readonly url: string = EVENT_API_URL,
        private readonly fetchImpl: typeof fetch = fetch,
    ) {}

    async sendText(sender: string, text: string): Promise<void> {
        const response = await this.fetchImpl(this.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'text',
                sender: sender.slice(0, 64),
                text,
                duration: COMMENT_DURATION_SECONDS,
            }),
        });

        if (!response.ok) {
            throw new Error(`Event API returned HTTP ${response.status}`);
        }
    }
}
