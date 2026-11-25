import { CreditStore } from './CreditStore';
import { SQLITE_DATABASE_PATH } from './config';

export type SendText = (sender: string, text: string) => Promise<void>;

export class DiamondMessageForwarder {
    private readonly creditStore: CreditStore;

    constructor(
        private readonly diamondsPerMessage: number,
        private readonly sendText: SendText,
        databasePath: string = SQLITE_DATABASE_PATH,
        private readonly freeMessagesEnabled = false,
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

    async handleChat(sender: string, text: string, eventId?: string): Promise<number> {
        if (eventId && !this.creditStore.markChatEventProcessed(eventId)) {
            console.info(`[chat] ignored duplicate event ${eventId}`);
            return 0;
        }

        const creditId = this.creditStore.claimNextCredit();
        if (creditId === null && !this.freeMessagesEnabled) {
            const status = this.creditStore.getCreditStatusCounts();
            console.info(`[credit] no pending credit for ${sender}; pending=${status.pending}, sending=${status.sending}, used=${status.used}`);
            return 0;
        }

        try {
            await this.sendText(sender.slice(0, 64), text);
        } catch (error) {
            if (creditId !== null) this.creditStore.releaseCredit(creditId);
            if (eventId) this.creditStore.forgetChatEvent(eventId);
            throw error;
        }

        if (creditId !== null) this.creditStore.markUsed(creditId);
        else console.info(`[credit] forwarded free chat for ${sender}`);
        return 1;
    }

    close(): void {
        this.creditStore.close();
    }
}
