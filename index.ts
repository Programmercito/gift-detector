import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import { FoodApiClient } from './FoodApiClient';
import { DiamondMessageForwarder } from './DiamondMessageForwarder';
import { EventApiClient } from './EventApiClient';
import { DIAMONDS_PER_MESSAGE, TIKTOK_USERNAME } from './config';
import { getReceivedDiamonds } from './giftDiamonds';

const connection = new TikTokLiveConnection(TIKTOK_USERNAME, {});
const foodClient = new FoodApiClient();
const eventApiClient = new EventApiClient();
const diamondMessageForwarder = new DiamondMessageForwarder(
    DIAMONDS_PER_MESSAGE,
    (sender, text) => eventApiClient.sendText(sender, text),
);

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
    const giftDetails = data?.giftDetails;
    const diamantes = Number(giftDetails?.diamondCount ?? 0);
    diamondMessageForwarder.addDiamonds(getReceivedDiamonds(data));

    // Regla de tres: 26000 diamantes = 1000 COMIDA (mínimo 1 comida por cualquier regalo)
    const comida = Math.max(1, Math.floor((diamantes * 1000) / 26000));
    console.log(`${data?.user?.uniqueId} (userId:${data?.user?.userId}) sends ${data?.giftId} '${giftDetails?.giftName}' with diamond value ${diamantes}`);
    console.log(`Diamantes: ${diamantes} = COMIDA: ${comida}`);
    await foodClient.addFood(comida);
});

// Connect to the live stream
connection.connect().then(state => {
    console.info(`Connected to roomId ${state.roomId}`);
}).catch(err => {
    console.error('Failed to connect', err);
});
