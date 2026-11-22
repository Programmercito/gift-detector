import { fileURLToPath } from 'node:url';

// Diamonds needed to forward the next TikTok chat message once.
export const DIAMONDS_PER_MESSAGE = 10;

// TikTok channel username to monitor (without the @).
export const TIKTOK_USERNAME = 'programmercito';

// Change this if the event API runs on a different host or port.
export const EVENT_API_URL = 'http://localhost:8787/event';

// SQLite file is kept next to this configuration file.
export const SQLITE_DATABASE_PATH = fileURLToPath(new URL('./gift-detector.sqlite', import.meta.url));

export const COMMENT_DURATION_SECONDS = 5;
