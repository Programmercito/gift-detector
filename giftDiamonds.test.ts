import assert from 'node:assert/strict';
import test from 'node:test';
import { DiamondMessageForwarder } from './DiamondMessageForwarder';
import { getReceivedDiamonds } from './giftDiamonds';

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
    assert.equal(
        getReceivedDiamonds({
            gift: { diamondCount: 10, type: 1 },
            repeatCount: 2,
            repeatEnd: false,
        }),
        0,
    );
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
