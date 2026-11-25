import assert from 'node:assert/strict';
import test from 'node:test';
import { DiamondMessageForwarder } from './DiamondMessageForwarder';
import { getGiftCount, getGiftName, getReceivedDiamonds, isCompleteGiftEvent } from './giftDiamonds';

test('counts the received diamond value for a normal gift', () => {
    assert.equal(getReceivedDiamonds({ giftDetails: { diamondCount: 10 } }), 10);
});

test('counts a completed streak by its cumulative repeat count', () => {
    assert.equal(
        getReceivedDiamonds({
            giftDetails: { diamondCount: 10, giftType: 1 },
            repeatCount: 2,
            repeatEnd: true,
        }),
        20,
    );
});

test('ignores intermediate updates for a streak', () => {
    const event = {
        gift: { diamondCount: 10, type: 1 },
        repeatCount: 2,
        repeatEnd: false,
    };
    assert.equal(isCompleteGiftEvent(event), false);
    assert.equal(getReceivedDiamonds(event), 0);
});

test('supports the connector gift_type and numeric repeatEnd fields', () => {
    assert.equal(
        getReceivedDiamonds({
            gift: { diamondCount: 5, gift_type: 1 },
            repeatCount: 2,
            repeatEnd: 1,
        }),
        10,
    );
});

test('extracts gift name and cumulative gift count for the visual event', () => {
    const event = {
        gift: { name: 'Rosa', type: 1 },
        giftId: 5655,
        repeatCount: 3,
        repeatEnd: true,
    };

    assert.equal(getGiftName(event), 'Rosa');
    assert.equal(getGiftCount(event), 3);
    assert.equal(isCompleteGiftEvent(event), true);
});

test('turns a 20-diamond gift streak into credits for the next two chats', async () => {
    const sent: Array<{ sender: string; text: string }> = [];
    const forwarder = new DiamondMessageForwarder(10, async (sender, text) => {
        sent.push({ sender, text });
    }, ':memory:');
    const diamonds = getReceivedDiamonds({
        giftDetails: { diamondCount: 10, giftType: 1 },
        repeatCount: 2,
        repeatEnd: true,
    });

    forwarder.addDiamonds(diamonds);
    assert.equal(await forwarder.handleChat('@ana', 'First chat'), 1);
    assert.equal(await forwarder.handleChat('@luis', 'Second chat'), 1);
    assert.deepEqual(sent, [
        { sender: '@ana', text: 'First chat' },
        { sender: '@luis', text: 'Second chat' },
    ]);
});

test('one credit per diamond lets a two-diamond gift publish the next two chats', async () => {
    const sent: string[] = [];
    const forwarder = new DiamondMessageForwarder(1, async (_sender, text) => {
        sent.push(text);
    }, ':memory:');
    const diamonds = getReceivedDiamonds({ giftDetails: { diamondCount: 2 } });

    forwarder.addDiamonds(diamonds);

    assert.equal(forwarder.getPendingMessages(), 2);
    assert.equal(await forwarder.handleChat('@ana', 'First chat'), 1);
    assert.equal(await forwarder.handleChat('@luis', 'Second chat'), 1);
    assert.equal(await forwarder.handleChat('@sol', 'Third chat'), 0);
    assert.deepEqual(sent, ['First chat', 'Second chat']);
});
