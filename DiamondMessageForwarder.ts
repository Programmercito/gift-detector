import { CreditStore } from './CreditStore';
import { SQLITE_DATABASE_PATH } from './config';

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

    async handleChat(sender: string, text: string): Promise<number> {
        const creditId = this.creditStore.claimNextCredit();
        if (creditId === null) return 0;

        try {
            await this.sendText(sender.slice(0, 64), text);
        } catch (error) {
            this.creditStore.releaseCredit(creditId);
            throw error;
        }

        this.creditStore.markUsed(creditId);
        return 1;
    }

    close(): void {
        this.creditStore.close();
    }
}
