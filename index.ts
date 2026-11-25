import { DiamondMessageForwarder } from './DiamondMessageForwarder';
import { EventApiClient, GIFT_DURATION_SECONDS } from './EventApiClient';
import { EulerLiveEvent, EulerStreamConnection } from './EulerStreamConnection';
import { TelegramApiClient } from './TelegramApiClient';
import { PeriodicTextReminder } from './PeriodicTextReminder';
import { SimulatedChatScheduler } from './SimulatedChatScheduler';
import {
    ADMIN_REMINDER_DURATION_SECONDS,
    ADMIN_REMINDER_INTERVAL_MINUTES,
    ADMIN_REMINDER_MESSAGE,
    COMMENT_DURATION_SECONDS,
    FREE_MESSAGES_ENABLED,
    MAX_PENDING_MESSAGES,
    MAX_VISIBLE_MESSAGES,
    DIAMONDS_PER_MESSAGE,
    EULER_API_KEY,
    SIMULATED_MESSAGES,
    SIMULATED_SENDERS,
    SIMULATED_MESSAGE_INTERVAL_SECONDS,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
    TIKTOK_USERNAME,
} from './config';
import { getGiftCount, getGiftName, getReceivedDiamonds, isCompleteGiftEvent } from './giftDiamonds';

const eventApiClient = new EventApiClient();
const telegramApiClient = new TelegramApiClient(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);
let warnedAboutMissingChatIdentity = false;

function getEventTimestampMs(value: unknown): number | undefined {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp < 1_000_000_000) return undefined;
    if (timestamp >= 1_000_000_000_000_000) return timestamp / 1000;
    if (timestamp < 1_000_000_000_000) return timestamp * 1000;
    return timestamp;
}

const simulatedChatScheduler = new SimulatedChatScheduler(
    (sender, text, duration) => eventApiClient.sendText(sender, text, duration),
    SIMULATED_MESSAGES,
    SIMULATED_SENDERS,
    COMMENT_DURATION_SECONDS,
    SIMULATED_MESSAGE_INTERVAL_SECONDS * 1000,
    Math.random,
    undefined,
    MAX_PENDING_MESSAGES,
    MAX_VISIBLE_MESSAGES,
    FREE_MESSAGES_ENABLED,
);
const diamondMessageForwarder = new DiamondMessageForwarder(
    DIAMONDS_PER_MESSAGE,
    (sender, text) => simulatedChatScheduler.sendRealMessage(sender, text),
);
const adminReminder = new PeriodicTextReminder(
    (sender, text, duration) => simulatedChatScheduler.enqueueMessage(sender, text, duration),
    ADMIN_REMINDER_MESSAGE,
    ADMIN_REMINDER_INTERVAL_MINUTES,
    ADMIN_REMINDER_DURATION_SECONDS,
);
adminReminder.start();
simulatedChatScheduler.start();

if (!telegramApiClient.isConfigured()) {
    console.warn('Telegram gift notifications are disabled; set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.');
}

async function handleLiveEvent(event: EulerLiveEvent): Promise<void> {
    if (event.type === 'WebcastChatMessage') {
        const data = event.data;
        const comment = data?.comment;
        const text = data?.content ?? comment;
        if (typeof text !== 'string' || !text) return;

        const uniqueId = data.user?.uniqueId ?? data.user?.displayId ?? 'TikTok';
        const sender = uniqueId.startsWith('@') ? uniqueId : `@${uniqueId}`;
        const rawEventId = data.common?.msgId ?? data.msgId ?? data.messageId;
        const eventId = rawEventId === undefined || rawEventId === null ? undefined : String(rawEventId);
        const eventTimestampMs = getEventTimestampMs(data.common?.createTime ?? data.createTime);
        if (!eventId && eventTimestampMs === undefined && !warnedAboutMissingChatIdentity) {
            warnedAboutMissingChatIdentity = true;
            console.warn('Chat events have no stable ID or timestamp; replay deduplication is unavailable.');
        }

        void diamondMessageForwarder.handleChat(sender, text, eventId, eventTimestampMs).then(sentMessages => {
            if (sentMessages > 0) {
                console.log(`Forwarded chat; ${diamondMessageForwarder.getPendingMessages()} message credit(s) remain.`);
            }
        }).catch(error => {
            console.error('Failed to send chat to the event API:', error);
        });
        return;
    }

    if (event.type !== 'WebcastGiftMessage') return;

    const data = event.data;
    if (!isCompleteGiftEvent(data)) return;

    const diamantes = getReceivedDiamonds(data);
    const giftName = getGiftName(data);
    const uniqueId = data?.user?.uniqueId ?? data?.user?.displayId;
    const sender = uniqueId ? (uniqueId.startsWith('@') ? uniqueId : `@${uniqueId}`) : undefined;
    const giftCount = getGiftCount(data);
    diamondMessageForwarder.addDiamonds(diamantes);

    if (giftName) {
        const resumeSimulation = simulatedChatScheduler.pauseForRealEvent(GIFT_DURATION_SECONDS);
        try {
            await eventApiClient.sendGift(sender, giftName, giftCount);
            console.log(`Sent gift animation: ${sender ?? 'TikTok'} sent ${giftName} x${giftCount}.`);
        } catch (error) {
            resumeSimulation();
            console.error('Failed to send gift animation to the event API:', error);
        }
    }

    try {
        await telegramApiClient.sendGiftNotification(sender, giftName ?? 'Regalo desconocido', giftCount, diamantes);
    } catch (error) {
        console.error('Failed to send gift details to Telegram:', error);
    }

    console.log(`${uniqueId} (userId:${data?.user?.userId}) sends ${data?.giftId} '${giftName ?? data?.gift?.name}' with diamond value ${diamantes}`);
}

const connection = new EulerStreamConnection(TIKTOK_USERNAME, EULER_API_KEY, handleLiveEvent);
connection.connect();
