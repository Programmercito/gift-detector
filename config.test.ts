import assert from 'node:assert/strict';
import test from 'node:test';
import { SIMULATED_MESSAGES } from './config';

const recipientNames = [
    'Ana', 'Luis', 'Sofía', 'Mateo', 'Camila', 'Diego', 'Valentina', 'Tomás', 'Martina', 'Nicolás',
    'Emilia', 'Santiago', 'Isabella', 'Benjamín', 'Mía', 'Thiago', 'Catalina', 'Joaquín', 'Olivia', 'Felipe',
];

test('loads 1000 short, unique, emoji-free simulated chat messages', () => {
    assert.equal(SIMULATED_MESSAGES.length, 1000);
    assert.equal(new Set(SIMULATED_MESSAGES).size, 1000);
    assert.ok(SIMULATED_MESSAGES.every(message => !/\p{Extended_Pictographic}/u.test(message)));
    assert.ok(SIMULATED_MESSAGES.every(message => message.split(/\s+/).length <= 8));
    assert.ok(SIMULATED_MESSAGES.every(message => {
        const words = message.toLowerCase().split(/[\s,;:.!?]+/);
        return recipientNames.some(name => words.includes(name.toLowerCase()));
    }));

    const romanticMessages = SIMULATED_MESSAGES.filter(message =>
        /te pienso|te extraño|me hacés falta|te quiero|qué lindo verte|un beso para vos|sos mi alegría|te mando cariño|siempre te recuerdo|me encantás|me encanta tu sonrisa|adoro tu forma de reír|valoro mucho tu paciencia|me alegra tu compañía|me inspira tu valentía|aprecio tu sinceridad|me conmueve tu ternura|me fascina tu creatividad|disfruto tu sentido del humor|me hace bien tu presencia/i.test(message),
    );
    assert.equal(romanticMessages.length, 400);
    assert.ok(romanticMessages.every(message => recipientNames.some(name => message.toLowerCase().includes(name.toLowerCase()))));
});
