import { DatabaseSync } from 'node:sqlite';

type CreditStatus = 'pending' | 'sending' | 'used';

const PROCESSED_CHAT_EVENT_LIMIT = 50_000;
const PROCESSED_CHAT_EVENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type CreditStatusCounts = Record<CreditStatus, number>;

export class CreditStore {
    private readonly database: DatabaseSync;

    constructor(databasePath: string) {
        this.database = new DatabaseSync(databasePath);
        this.database.exec(`
            PRAGMA journal_mode = WAL;

            CREATE TABLE IF NOT EXISTS gift_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                pending_diamonds REAL NOT NULL DEFAULT 0
            );

            INSERT OR IGNORE INTO gift_state (id, pending_diamonds) VALUES (1, 0);

            CREATE TABLE IF NOT EXISTS message_credits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                status TEXT NOT NULL CHECK (status IN ('pending', 'sending', 'used')),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                used_at TEXT
            );

            CREATE INDEX IF NOT EXISTS message_credits_status_id
                ON message_credits (status, id);

            CREATE TABLE IF NOT EXISTS processed_chat_events (
                event_id TEXT PRIMARY KEY,
                processed_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS processed_chat_events_time
                ON processed_chat_events (processed_at DESC);

            -- An interrupted send may already have reached the event API; do not replay it.
            UPDATE message_credits
                SET status = 'used', used_at = COALESCE(used_at, CURRENT_TIMESTAMP)
                WHERE status = 'sending';
        `);
    }

    markChatEventProcessed(eventId: string): boolean {
        if (!eventId.trim()) return false;

        return this.inTransaction(() => {
            const result = this.database
                .prepare('INSERT OR IGNORE INTO processed_chat_events (event_id, processed_at) VALUES (?, ?)')
                .run(eventId, Date.now());
            if (Number(result.changes) !== 1) return false;

            this.database
                .prepare('DELETE FROM processed_chat_events WHERE processed_at < ?')
                .run(Date.now() - PROCESSED_CHAT_EVENT_TTL_MS);
            this.database.exec(`
                DELETE FROM processed_chat_events
                WHERE event_id IN (
                    SELECT event_id FROM processed_chat_events
                    ORDER BY processed_at DESC
                    LIMIT -1 OFFSET ${PROCESSED_CHAT_EVENT_LIMIT}
                )
            `);
            return true;
        });
    }

    forgetChatEvent(eventId: string): void {
        this.database.prepare('DELETE FROM processed_chat_events WHERE event_id = ?').run(eventId);
    }

    addDiamonds(diamonds: number, diamondsPerMessage: number): void {
        if (!Number.isFinite(diamonds) || diamonds <= 0) return;

        this.inTransaction(() => {
            const state = this.database
                .prepare('SELECT pending_diamonds FROM gift_state WHERE id = 1')
                .get() as { pending_diamonds: number };
            const totalDiamonds = Number(state.pending_diamonds) + diamonds;
            const earnedMessages = Math.floor(totalDiamonds / diamondsPerMessage);
            const remainingDiamonds = totalDiamonds - earnedMessages * diamondsPerMessage;

            this.database
                .prepare('UPDATE gift_state SET pending_diamonds = ? WHERE id = 1')
                .run(remainingDiamonds);

            const insertCredit = this.database.prepare(
                "INSERT INTO message_credits (status) VALUES ('pending')",
            );
            for (let index = 0; index < earnedMessages; index += 1) {
                insertCredit.run();
            }
        });
    }

    getPendingDiamonds(): number {
        const row = this.database
            .prepare('SELECT pending_diamonds FROM gift_state WHERE id = 1')
            .get() as { pending_diamonds: number };
        return Number(row.pending_diamonds);
    }

    getPendingMessages(): number {
        const row = this.database
            .prepare("SELECT COUNT(*) AS count FROM message_credits WHERE status = 'pending'")
            .get() as { count: number };
        return Number(row.count);
    }

    getCreditStatusCounts(): CreditStatusCounts {
        const rows = this.database
            .prepare('SELECT status, COUNT(*) AS count FROM message_credits GROUP BY status')
            .all() as Array<{ status: CreditStatus; count: number }>;
        const counts: CreditStatusCounts = { pending: 0, sending: 0, used: 0 };
        for (const row of rows) counts[row.status] = Number(row.count);
        return counts;
    }

    claimNextCredit(): number | null {
        return this.inTransaction(() => {
            const row = this.database
                .prepare("SELECT id FROM message_credits WHERE status = 'pending' ORDER BY id LIMIT 1")
                .get() as { id: number } | undefined;
            if (!row) return null;

            this.database
                .prepare("UPDATE message_credits SET status = 'sending' WHERE id = ? AND status = 'pending'")
                .run(row.id);
            return Number(row.id);
        });
    }

    markUsed(creditId: number): void {
        const result = this.database
            .prepare(
                "UPDATE message_credits SET status = 'used', used_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'sending'",
            )
            .run(creditId);
        if (Number(result.changes) !== 1) {
            throw new Error(`Could not mark message credit ${creditId} as used`);
        }
    }

    releaseCredit(creditId: number): void {
        const result = this.database
            .prepare("UPDATE message_credits SET status = 'pending' WHERE id = ? AND status = 'sending'")
            .run(creditId);
        if (Number(result.changes) !== 1) {
            throw new Error(`Could not release message credit ${creditId}`);
        }
    }

    close(): void {
        this.database.close();
    }

    private inTransaction<T>(action: () => T): T {
        this.database.exec('BEGIN IMMEDIATE');
        try {
            const result = action();
            this.database.exec('COMMIT');
            return result;
        } catch (error) {
            this.database.exec('ROLLBACK');
            throw error;
        }
    }
}
