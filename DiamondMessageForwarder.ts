import { CreditStore } from './CreditStore';
import { SQLITE_DATABASE_PATH } from './config';

const MAX_CHAT_EVENT_AGE_MS = 60_000;

export type SendText = (sender: string, text: string) => Promise<void>;

export class DiamondMessageForwarder {
    private readonly creditStore: CreditStore;

    constructor(
        private readonly diamondsPerMessage: number,
        private readonly sendText: SendText,
        databasePath: string = SQLITE_DATABASE_PATH,
    ) {
        if (!Number.isFinite(diamondsPerMessage) || diamondsPerMessage <= 0) {
            throw new Error('diamondsPerMessage must be a positive number');
        }
        this.creditStore = new CreditStore(databasePath);
    }

    addDiamonds(diamonds: number): void {
        this.creditStore.addDiamonds(diamonds, this.diamondsPerMessage);
    }

    getPendingDiamonds(): number {
        return this.creditStore.getPendingDiamonds();
    }

    getPendingMessages(): number {
        return this.creditStore.getPendingMessages();
    }

    getCreditStatusCounts() {
        return this.creditStore.getCreditStatusCounts();
    }

    async handleChat(sender: string, text: string, eventId?: string, eventTimestampMs?: number): Promise<number> {
        if (eventId && !this.creditStore.markChatEventProcessed(eventId)) {
            console.info(`[chat] ignored duplicate event ${eventId}`);
            return 0;
        }
        if (eventTimestampMs !== undefined && Date.now() - eventTimestampMs > MAX_CHAT_EVENT_AGE_MS) {
            console.info(`[chat] ignored stale event${eventId ? ` ${eventId}` : ''}`);
            return 0;
        }

        const creditId = this.creditStore.claimNextCredit();
        if (creditId === null) return 0;

        try {
            await this.sendText(sender.slice(0, 64), text);
        } catch (error) {
            this.creditStore.releaseCredit(creditId);
            if (eventId) this.creditStore.forgetChatEvent(eventId);
            throw error;
        }

        this.creditStore.markUsed(creditId);
        return 1;
    }

    close(): void {
        this.creditStore.close();
    }
}
