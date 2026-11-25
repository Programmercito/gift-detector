import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CreditStore } from './CreditStore';

test('marks an interrupted send as used after restart to avoid replaying an old chat', () => {
    const directory = mkdtempSync(join(tmpdir(), 'gift-detector-recovery-'));
    const databasePath = join(directory, 'credits.sqlite');
    let store: CreditStore | undefined;

    try {
        store = new CreditStore(databasePath);
        store.addDiamonds(10, 10);
        assert.notEqual(store.claimNextCredit(), null);
        assert.deepEqual(store.getCreditStatusCounts(), { pending: 0, sending: 1, used: 0 });
        store.close();
        store = undefined;

        store = new CreditStore(databasePath);
        assert.deepEqual(store.getCreditStatusCounts(), { pending: 0, sending: 0, used: 1 });
    } finally {
        store?.close();
        rmSync(directory, { recursive: true, force: true });
    }
});
