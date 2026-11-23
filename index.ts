import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import { FoodApiClient } from './FoodApiClient';
import { DiamondMessageForwarder } from './DiamondMessageForwarder';
import { EventApiClient } from './EventApiClient';
import { TelegramApiClient } from './TelegramApiClient';
import {
    DIAMONDS_PER_FOOD,
    DIAMONDS_PER_MESSAGE,
    MIN_FOOD_PER_GIFT,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
    TIKTOK_ENABLE_EXTENDED_GIFT_INFO,
    TIKTOK_USERNAME,
} from './config';
import { getGiftCount, getGiftName, getReceivedDiamonds, isCompleteGiftEvent } from './giftDiamonds';

const connection = new TikTokLiveConnection(TIKTOK_USERNAME, {
    enableExtendedGiftInfo: TIKTOK_ENABLE_EXTENDED_GIFT_INFO,
});
const foodClient = new FoodApiClient();
const eventApiClient = new EventApiClient();
const telegramApiClient = new TelegramApiClient(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);
const diamondMessageForwarder = new DiamondMessageForwarder(
    DIAMONDS_PER_MESSAGE,
    (sender, text) => eventApiClient.sendText(sender, text),
);

if (!telegramApiClient.isConfigured()) {
    console.warn('Telegram gift notifications are disabled; set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.');
}

// Register event listeners BEFORE connecting
connection.on(WebcastEvent.CHAT, async data => {
    const comment = data?.comment;
    if (!comment) return;

    const uniqueId = data.user?.uniqueId ?? data.user?.displayId ?? 'TikTok';
    const sender = uniqueId.startsWith('@') ? uniqueId : `@${uniqueId}`;

    try {
        const sentMessages = await diamondMessageForwarder.handleChat(sender, comment);
        if (sentMessages > 0) {
            console.log(`Forwarded chat; ${diamondMessageForwarder.getPendingMessages()} message credit(s) remain.`);
        }
    } catch (error) {
        console.error('Failed to send chat to the event API:', error);
    }
});

connection.on(WebcastEvent.GIFT, async data => {
    if (!isCompleteGiftEvent(data)) return;

    const giftDetails = data?.giftDetails;
    const diamantes = getReceivedDiamonds(data);
    const giftName = getGiftName(data);
    const uniqueId = data?.user?.uniqueId ?? data?.user?.displayId;
    const sender = uniqueId ? (uniqueId.startsWith('@') ? uniqueId : `@${uniqueId}`) : undefined;
    const giftCount = getGiftCount(data);
    diamondMessageForwarder.addDiamonds(diamantes);

    if (giftName) {
        try {
            await eventApiClient.sendGift(sender, giftName, giftCount);
            console.log(`Sent gift animation: ${sender ?? 'TikTok'} sent ${giftName} x${giftCount}.`);
        } catch (error) {
            console.error('Failed to send gift animation to the event API:', error);
        }
    }

    try {
        await telegramApiClient.sendGiftNotification(sender, giftName ?? 'Regalo desconocido', giftCount, diamantes);
    } catch (error) {
        console.error('Failed to send gift details to Telegram:', error);
    }

    const comida = Math.max(MIN_FOOD_PER_GIFT, Math.floor(diamantes / DIAMONDS_PER_FOOD));
    console.log(`${uniqueId} (userId:${data?.user?.userId}) sends ${data?.giftId} '${giftName ?? giftDetails?.giftName}' with diamond value ${diamantes}`);
    console.log(`Diamantes: ${diamantes} = COMIDA: ${comida}`);
    await foodClient.addFood(comida);
});

// Connect to the live stream
connection.connect().then(state => {
    console.info(`Connected to roomId ${state.roomId}`);
}).catch(err => {
    console.error('Failed to connect', err);
});
