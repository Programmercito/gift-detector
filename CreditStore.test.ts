import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CreditStore } from './CreditStore';

test('returns an in-flight credit to pending after a restart', () => {
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
        assert.deepEqual(store.getCreditStatusCounts(), { pending: 1, sending: 0, used: 0 });
    } finally {
        store?.close();
        rmSync(directory, { recursive: true, force: true });
    }
});
