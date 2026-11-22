import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DiamondMessageForwarder } from './DiamondMessageForwarder';

test('sends each next chat once for every earned message credit', async () => {
    const sent: Array<{ sender: string; text: string }> = [];
    const forwarder = new DiamondMessageForwarder(10, async (sender, text) => {
        sent.push({ sender, text });
    }, ':memory:');

    forwarder.addDiamonds(30);
    assert.equal(await forwarder.handleChat('@ana', 'First'), 1);
    assert.equal(await forwarder.handleChat('@luis', 'Second'), 1);
    assert.equal(await forwarder.handleChat('@sol', 'Third'), 1);

    assert.deepEqual(sent, [
        { sender: '@ana', text: 'First' },
        { sender: '@luis', text: 'Second' },
        { sender: '@sol', text: 'Third' },
    ]);
    assert.equal(forwarder.getPendingDiamonds(), 0);
    assert.equal(forwarder.getPendingMessages(), 0);
});

test('keeps diamonds below the threshold for a later chat', async () => {
    const sent: string[] = [];
    const forwarder = new DiamondMessageForwarder(10, async (_sender, text) => {
        sent.push(text);
    }, ':memory:');

    forwarder.addDiamonds(7);
    assert.equal(await forwarder.handleChat('@ana', 'First'), 0);
    forwarder.addDiamonds(5);
    assert.equal(await forwarder.handleChat('@ana', 'Second'), 1);

    assert.deepEqual(sent, ['Second']);
    assert.equal(forwarder.getPendingDiamonds(), 2);
});

test('retains the unsent threshold when the API request fails', async () => {
    const forwarder = new DiamondMessageForwarder(10, async () => {
        throw new Error('API unavailable');
    }, ':memory:');
    forwarder.addDiamonds(20);

    await assert.rejects(forwarder.handleChat('@ana', 'Hello'), /API unavailable/);
    assert.equal(forwarder.getPendingMessages(), 2);
});

test('uses separate credits for concurrent chats without reusing one', async () => {
    const sent: string[] = [];
    const forwarder = new DiamondMessageForwarder(10, async (_sender, text) => {
        await Promise.resolve();
        sent.push(text);
    }, ':memory:');
    forwarder.addDiamonds(20);

    const counts = await Promise.all([
        forwarder.handleChat('@ana', 'First'),
        forwarder.handleChat('@ana', 'Second'),
    ]);

    assert.equal(counts.reduce((total, count) => total + count, 0), 2);
    assert.equal(sent.length, 2);
    assert.equal(forwarder.getPendingMessages(), 0);
});

test('limits the sender to 64 characters', async () => {
    let actualSender = '';
    const forwarder = new DiamondMessageForwarder(1, async (sender) => {
        actualSender = sender;
    }, ':memory:');
    forwarder.addDiamonds(1);

    await forwarder.handleChat(`@${'a'.repeat(70)}`, 'Hello');

    assert.equal(actualSender.length, 64);
});

test('persists diamond remainder and credit usage across restarts', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'gift-detector-sqlite-'));
    const databasePath = join(directory, 'credits.sqlite');
    let forwarder: DiamondMessageForwarder | undefined;

    try {
        forwarder = new DiamondMessageForwarder(10, async () => {}, databasePath);
        forwarder.addDiamonds(27);
        assert.equal(forwarder.getPendingMessages(), 2);
        assert.equal(forwarder.getPendingDiamonds(), 7);
        forwarder.close();
        forwarder = undefined;

        forwarder = new DiamondMessageForwarder(10, async () => {}, databasePath);
        assert.equal(forwarder.getPendingMessages(), 2);
        assert.equal(forwarder.getPendingDiamonds(), 7);

        assert.equal(await forwarder.handleChat('@ana', 'First'), 1);
        assert.deepEqual(forwarder.getCreditStatusCounts(), { pending: 1, sending: 0, used: 1 });
        forwarder.close();
        forwarder = undefined;

        forwarder = new DiamondMessageForwarder(10, async () => {}, databasePath);
        assert.equal(forwarder.getPendingMessages(), 1);
        assert.equal(forwarder.getPendingDiamonds(), 7);
        assert.deepEqual(forwarder.getCreditStatusCounts(), { pending: 1, sending: 0, used: 1 });
    } finally {
        forwarder?.close();
        rmSync(directory, { recursive: true, force: true });
    }
});
