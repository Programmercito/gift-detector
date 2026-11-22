import assert from 'node:assert/strict';
import test from 'node:test';
import { TikTokLiveConnection } from 'tiktok-live-connector';
import { TIKTOK_USERNAME } from './config';

test('constructs the TikTok connection with an explicit options object', () => {
    assert.doesNotThrow(() => new TikTokLiveConnection(TIKTOK_USERNAME, {}));
});
