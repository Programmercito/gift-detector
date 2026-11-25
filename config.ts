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

function positiveNumberSetting(name: string): number {
    const value = numberSetting(name);
    if (value <= 0) throw new Error(`${name} must be greater than zero`);
    return value;
}

export const DIAMONDS_PER_MESSAGE = numberSetting('DIAMONDS_PER_MESSAGE');
export const TIKTOK_USERNAME = requiredSetting('TIKTOK_USERNAME');
export const EVENT_API_URL = requiredSetting('EVENT_API_URL');
export const SQLITE_DATABASE_PATH = requiredSetting('SQLITE_DATABASE_PATH');
export const COMMENT_DURATION_SECONDS = numberSetting('COMMENT_DURATION_SECONDS');
export const ADMIN_REMINDER_INTERVAL_MINUTES = positiveNumberSetting('ADMIN_REMINDER_INTERVAL_MINUTES');
export const ADMIN_REMINDER_DURATION_SECONDS = positiveNumberSetting('ADMIN_REMINDER_DURATION_SECONDS');
export const ADMIN_REMINDER_MESSAGE = requiredSetting('ADMIN_REMINDER_MESSAGE');
export const SIMULATED_MESSAGES = Array.from({ length: 1000 }, (_, index) =>
    process.env[`mensaje_${index + 1}`]?.trim(),
).filter((message): message is string => Boolean(message));
export const SIMULATED_SENDERS = Array.from({ length: 1000 }, (_, index) =>
    process.env[`remitente_${index + 1}`]?.trim(),
).filter((sender): sender is string => Boolean(sender));
export const EULER_API_KEY = process.env.API_KEY || undefined;
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || undefined;
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || undefined;
