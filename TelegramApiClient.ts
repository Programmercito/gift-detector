type TelegramApiResponse = { ok?: boolean; description?: string };

export class TelegramApiClient {
    constructor(
        private readonly botToken: string | undefined,
        private readonly chatId: string | undefined,
        private readonly fetchImpl: typeof fetch = fetch,
    ) {}

    isConfigured(): boolean {
        return Boolean(this.botToken && this.chatId);
    }

    async sendGiftNotification(
        sender: string | undefined,
        gift: string,
        count: number,
        diamonds: number,
    ): Promise<void> {
        if (!this.botToken || !this.chatId) return;

        const text = [
            '🎁 Nuevo regalo en TikTok',
            `Quién: ${(sender || 'Usuario desconocido').slice(0, 64)}`,
            `Regalo: ${(gift || 'Regalo desconocido').slice(0, 80)}`,
            `Cantidad: ${count}`,
            `Diamantes: ${diamonds}`,
        ].join('\n');

        const response = await this.fetchImpl(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: this.chatId, text }),
        });

        if (!response.ok) {
            throw new Error(`Telegram API returned HTTP ${response.status}`);
        }

        const result = (await response.json()) as TelegramApiResponse;
        if (!result.ok) {
            throw new Error(result.description || 'Telegram API rejected the gift notification');
        }
    }
}
