import assert from 'node:assert/strict';
import test from 'node:test';
import { TelegramApiClient } from './TelegramApiClient';

test('sends gift details to the configured Telegram chat', async () => {
    let actualUrl = '';
    let actualInit: RequestInit | undefined;
    const client = new TelegramApiClient('test-token', '9286091152', async (input, init) => {
        actualUrl = String(input);
        actualInit = init;
        return Response.json({ ok: true });
    });

    await client.sendGiftNotification('@ana', 'Rosa', 334, 3340);

    assert.equal(actualUrl, 'https://api.telegram.org/bottest-token/sendMessage');
    assert.equal(actualInit?.method, 'POST');
    assert.deepEqual(JSON.parse(String(actualInit?.body)), {
        chat_id: '9286091152',
        text: '🎁 Nuevo regalo en TikTok\nQuién: @ana\nRegalo: Rosa\nCantidad: 334\nDiamantes: 3340',
    });
});

test('reports Telegram API errors even when HTTP succeeds', async () => {
    const client = new TelegramApiClient('test-token', '9286091152', async () =>
        Response.json({ ok: false, description: 'Chat not found' }),
    );

    await assert.rejects(client.sendGiftNotification('@ana', 'Rosa', 1, 1), /Chat not found/);
});

test('does not send when Telegram credentials are missing', async () => {
    let wasCalled = false;
    const client = new TelegramApiClient(undefined, undefined, async () => {
        wasCalled = true;
        return Response.json({ ok: true });
    });

    await client.sendGiftNotification('@ana', 'Rosa', 1, 1);

    assert.equal(client.isConfigured(), false);
    assert.equal(wasCalled, false);
});
