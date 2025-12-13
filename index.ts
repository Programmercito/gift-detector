import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
const tiktokUsername = 'marcelocrow';
const connection = new TikTokLiveConnection(tiktokUsername);

// Register event listeners BEFORE connecting
connection.on(WebcastEvent.CHAT, data => {
    //console.log(`${data!.user!.uniqueId} (userId:${data!.user!.uniqueId}) writes: ${data!.comment}`);
});

connection.on(WebcastEvent.GIFT, data => {
    const diamantes = data!.giftDetails!.diamondCount;

    // Regla de tres: 26000 diamantes = 1000 COMIDA
    const comida = Math.floor((diamantes * 1000) / 26000);

    console.log(`${data!.user!.uniqueId} (userId:${data!.user!.userId}) sends ${data!.giftId} '${data!.giftDetails!.giftName}'`);
    console.log(`Diamantes: ${diamantes} = COMIDA: ${comida}`);
});

// Connect to the live stream
connection.connect().then(state => {
    console.info(`Connected to roomId ${state.roomId}`);
}).catch(err => {
    console.error('Failed to connect', err);
});