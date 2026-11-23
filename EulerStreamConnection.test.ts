import assert from 'node:assert/strict';
import test from 'node:test';
import { createEulerStreamWebSocketUrl, EulerStreamConnection } from './EulerStreamConnection';

test('builds the Community WebSocket URL with raw v3 frames', () => {
    const url = new URL(createEulerStreamWebSocketUrl('creator', 'test-api-key'));

    assert.equal(url.origin, 'wss://ws.eulerstream.com');
    assert.equal(url.searchParams.get('uniqueId'), 'creator');
    assert.equal(url.searchParams.get('apiKey'), 'test-api-key');
    assert.equal(url.searchParams.get('features.rawMessages'), 'true');
    assert.equal(url.searchParams.get('features.bundleEvents'), 'false');
    assert.equal(url.searchParams.get('features.schemaVersion'), 'v3');
});

test('decodes and dispatches messages in order', async () => {
    const listeners = new Map<string, (event: any) => void>();
    let actualUrl = '';
    const events: string[] = [];
    const socket = {
        binaryType: '',
        addEventListener(type: string, listener: (event: any) => void) {
            listeners.set(type, listener);
        },
        close() {},
    };

    const connection = new EulerStreamConnection(
        'creator',
        'test-api-key',
        event => { events.push(event.type); },
        url => { actualUrl = url; return socket; },
        async () => ({
            protoMessageFetchResult: {
                messages: [
                    { decodedData: { type: 'WebcastChatMessage', data: { content: 'hello' } } },
                    { decodedData: { type: 'WebcastGiftMessage', data: { giftId: '1' } } },
                ],
            },
        }),
    );

    connection.connect();
    listeners.get('message')?.({ data: new Uint8Array([1, 2, 3]).buffer });
    await new Promise(resolve => setImmediate(resolve));
    connection.disconnect();

    assert.equal(socket.binaryType, 'arraybuffer');
    assert.equal(new URL(actualUrl).searchParams.get('apiKey'), 'test-api-key');
    assert.deepEqual(events, ['WebcastChatMessage', 'WebcastGiftMessage']);
});
