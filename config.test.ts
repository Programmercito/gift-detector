import assert from 'node:assert/strict';
import test from 'node:test';
import { SIMULATED_MESSAGES, SIMULATED_SENDERS } from './config';

const maleHandles = ['luis', 'mateo', 'diego', 'tomas', 'nicolas', 'santiago', 'benjamin', 'thiago', 'joaquin', 'felipe', 'bruno', 'franco', 'gael', 'lautaro', 'simon', 'pablo', 'gabriel', 'andres', 'david', 'adrian'];
const femaleHandles = ['sofia', 'camila', 'valentina', 'martina', 'emilia', 'isabella', 'mia', 'catalina', 'olivia', 'ana', 'renata', 'julieta', 'abril', 'zoe', 'lucia', 'daniela', 'carolina', 'elena', 'paula', 'natalia'];

test('loads varied simulated messages with separate sender identities', () => {
    assert.equal(SIMULATED_MESSAGES.length, 1000);
    assert.equal(SIMULATED_SENDERS.length, 1000);
    assert.equal(new Set(SIMULATED_MESSAGES).size, 1000);
    assert.equal(new Set(SIMULATED_SENDERS).size, 1000);
    assert.ok(SIMULATED_MESSAGES.every(message => !/\p{Extended_Pictographic}/u.test(message)));
    assert.ok(SIMULATED_MESSAGES.every(message => message.split(/\s+/).length <= 11));
    assert.ok(SIMULATED_MESSAGES.every(message => !/@[\w]+/u.test(message)));
    assert.ok(SIMULATED_SENDERS.every((sender, index) => {
        const senderName = sender.toLowerCase().slice(1).split('_')[0];
        const words = new Set(SIMULATED_MESSAGES[index].toLowerCase().split(/[^\p{L}\p{N}]+/u));
        return [...maleHandles, ...femaleHandles].includes(senderName) && !words.has(senderName);
    }));
    assert.ok(SIMULATED_SENDERS.slice(0, 400).every((sender, index) => {
        const senderName = sender.toLowerCase().slice(1).split('_')[0];
        return index % 2 === 0 ? maleHandles.includes(senderName) : femaleHandles.includes(senderName);
    }));
    assert.ok(new Set(SIMULATED_MESSAGES.map(message => message.split(/\s+/).slice(0, 3).join(' '))).size >= 300);
    assert.ok(new Set(SIMULATED_MESSAGES.flatMap(message =>
        message.toLocaleLowerCase('es').split(/[^\p{L}\p{N}]+/u),
    )).size > 100);
});
