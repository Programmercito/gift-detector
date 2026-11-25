import assert from 'node:assert/strict';
import test from 'node:test';
import { SIMULATED_MESSAGES, SIMULATED_SENDERS } from './config';

const personNames = [
    'Luis', 'Mateo', 'Diego', 'Tomás', 'Nicolás', 'Santiago', 'Benjamín', 'Thiago', 'Joaquín', 'Felipe',
    'Bruno', 'Franco', 'Gael', 'Lautaro', 'Simón', 'Pablo', 'Gabriel', 'Andrés', 'David', 'Adrián',
    'Sofía', 'Camila', 'Valentina', 'Martina', 'Emilia', 'Isabella', 'Mía', 'Catalina', 'Olivia', 'Ana',
    'Renata', 'Julieta', 'Abril', 'Zoe', 'Lucía', 'Daniela', 'Carolina', 'Elena', 'Paula', 'Natalia',
];

test('loads varied simulated messages with separate sender identities', () => {
    assert.equal(SIMULATED_MESSAGES.length, 100);
    assert.equal(SIMULATED_SENDERS.length, 100);
    assert.equal(new Set(SIMULATED_MESSAGES).size, 100);
    assert.equal(new Set(SIMULATED_SENDERS).size, 100);
    assert.ok(SIMULATED_MESSAGES.every(message => !/\p{Extended_Pictographic}/u.test(message)));
    assert.ok(SIMULATED_MESSAGES.every(message => message.split(/\s+/).length <= 10));
    assert.ok(SIMULATED_MESSAGES.every(message => !/@[\w]+/u.test(message)));
    assert.ok(SIMULATED_MESSAGES.every(message => {
        const words = new Set(message.toLocaleLowerCase('es').split(/[^\p{L}\p{N}]+/u));
        return personNames.every(name => !words.has(name.toLocaleLowerCase('es')));
    }));
    assert.ok(new Set(SIMULATED_MESSAGES.map(message => message.split(/\s+/).slice(0, 3).join(' '))).size >= 75);
    assert.ok(new Set(SIMULATED_MESSAGES.flatMap(message =>
        message.toLocaleLowerCase('es').split(/[^\p{L}\p{N}]+/u),
    )).size > 100);
});
