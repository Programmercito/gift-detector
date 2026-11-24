import assert from 'node:assert/strict';
import test from 'node:test';
import { EventApiClient } from './EventApiClient';

test('posts the text event to the API with the expected payload', async () => {
    let actualUrl = '';
    let actualInit: RequestInit | undefined;
    const client = new EventApiClient('http://localhost:8787/event', async (input, init) => {
        actualUrl = String(input);
        actualInit = init;
        return new Response(null, { status: 200 });
    });

    await client.sendText('@ana', 'Hello');

    assert.equal(actualUrl, 'http://localhost:8787/event');
    assert.equal(actualInit?.method, 'POST');
    assert.equal(actualInit?.headers && (actualInit.headers as Record<string, string>)['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(String(actualInit?.body)), {
        action: 'text',
        sender: '@ana',
        text: 'Hello',
        duration: 60,
    });
});

test('reports unsuccessful API responses', async () => {
    const client = new EventApiClient('http://localhost:8787/event', async () =>
        new Response(null, { status: 503 }),
    );

    await assert.rejects(client.sendText('@ana', 'Hello'), /HTTP 503/);
});

test('allows an individual text event duration override', async () => {
    let actualInit: RequestInit | undefined;
    const client = new EventApiClient('http://localhost:8787/event', async (_input, init) => {
        actualInit = init;
        return new Response(null, { status: 200 });
    });

    await client.sendText('@admin', 'Reminder', 60);

    assert.deepEqual(JSON.parse(String(actualInit?.body)), {
        action: 'text',
        sender: '@admin',
        text: 'Reminder',
        duration: 60,
    });
});

test('posts a gift event for the 3D gift animation', async () => {
    let actualInit: RequestInit | undefined;
    const client = new EventApiClient('http://localhost:8787/event', async (_input, init) => {
        actualInit = init;
        return new Response(null, { status: 200 });
    });

    await client.sendGift('@ana', 'Rosa', 3);

    assert.deepEqual(JSON.parse(String(actualInit?.body)), {
        action: 'gift',
        sender: '@ana',
        gift: 'Rosa',
        count: 3,
        duration: 10,
    });
});
