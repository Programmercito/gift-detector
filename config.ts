function requiredSetting(name: string): string {
    const value = process.env[name];
    if (value === undefined || value.trim() === '') throw new Error(`${name} must be set in .env`);
    return value.trim();
}

function numberSetting(name: string): number {
    const value = requiredSetting(name);
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`);
    return parsed;
}

function booleanSetting(name: string): boolean {
    const value = requiredSetting(name).toLowerCase();
    if (value !== 'true' && value !== 'false') throw new Error(`${name} must be true or false`);
    return value === 'true';
}

export const DIAMONDS_PER_MESSAGE = numberSetting('DIAMONDS_PER_MESSAGE');
export const TIKTOK_USERNAME = requiredSetting('TIKTOK_USERNAME');
export const TIKTOK_ENABLE_EXTENDED_GIFT_INFO = booleanSetting('TIKTOK_ENABLE_EXTENDED_GIFT_INFO');
export const EVENT_API_URL = requiredSetting('EVENT_API_URL');
export const FOOD_API_URL = requiredSetting('FOOD_API_URL');
export const FOOD_API_TIMEOUT_MS = numberSetting('FOOD_API_TIMEOUT_MS');
export const SQLITE_DATABASE_PATH = requiredSetting('SQLITE_DATABASE_PATH');
export const COMMENT_DURATION_SECONDS = numberSetting('COMMENT_DURATION_SECONDS');
export const DIAMONDS_PER_FOOD = numberSetting('DIAMONDS_PER_FOOD');
export const MIN_FOOD_PER_GIFT = numberSetting('MIN_FOOD_PER_GIFT');
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || undefined;
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || undefined;
