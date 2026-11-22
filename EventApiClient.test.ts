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
        duration: 5,
    });
});

test('reports unsuccessful API responses', async () => {
    const client = new EventApiClient('http://localhost:8787/event', async () =>
        new Response(null, { status: 503 }),
    );

    await assert.rejects(client.sendText('@ana', 'Hello'), /HTTP 503/);
});
