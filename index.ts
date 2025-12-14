import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import { FoodApiClient } from './FoodApiClient';
const tiktokUsername = 'marcelocrow';
const connection = new TikTokLiveConnection(tiktokUsername);
const foodClient = new FoodApiClient();
// Register event listeners BEFORE connecting
connection.on(WebcastEvent.CHAT, data => {
    //console.log(`${data!.user!.uniqueId} (userId:${data!.user!.uniqueId}) writes: ${data!.comment}`);
});

connection.on(WebcastEvent.GIFT, async data => {
    const diamantes = data!.giftDetails!.diamondCount;
    // Regla de tres: 26000 diamantes = 1000 COMIDA (mínimo 1 comida por cualquier regalo)
    const comida = Math.max(1, Math.floor((diamantes * 1000) / 26000));
    console.log(`${data!.user!.uniqueId} (userId:${data!.user!.userId}) sends ${data!.giftId} '${data!.giftDetails!.giftName}' with cost ${data!.giftDetails!.diamondCount}`);
    console.log(`Diamantes: ${diamantes} = COMIDA: ${comida}`);
    await foodClient.addFood(comida);
});

// Connect to the live stream
connection.connect().then(state => {
    console.info(`Connected to roomId ${state.roomId}`);
}).catch(err => {
    console.error('Failed to connect', err);
});