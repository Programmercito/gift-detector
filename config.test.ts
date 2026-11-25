import assert from 'node:assert/strict';
import test from 'node:test';
import { SIMULATED_MESSAGES, SIMULATED_SENDERS } from './config';

const maleHandles = ['luis', 'mateo', 'diego', 'tomas', 'nicolas', 'santiago', 'benjamin', 'thiago', 'joaquin', 'felipe', 'bruno', 'franco', 'gael', 'lautaro', 'simon', 'pablo', 'gabriel', 'andres', 'david', 'adrian'];
const femaleHandles = ['sofia', 'camila', 'valentina', 'martina', 'emilia', 'isabella', 'mia', 'catalina', 'olivia', 'ana', 'renata', 'julieta', 'abril', 'zoe', 'lucia', 'daniela', 'carolina', 'elena', 'paula', 'natalia'];
const maleNames = ['Luis', 'Mateo', 'Diego', 'Tomás', 'Nicolás', 'Santiago', 'Benjamín', 'Thiago', 'Joaquín', 'Felipe', 'Bruno', 'Franco', 'Gael', 'Lautaro', 'Simón', 'Pablo', 'Gabriel', 'Andrés', 'David', 'Adrián'];
const femaleNames = ['Sofía', 'Camila', 'Valentina', 'Martina', 'Emilia', 'Isabella', 'Mía', 'Catalina', 'Olivia', 'Ana', 'Renata', 'Julieta', 'Abril', 'Zoe', 'Lucía', 'Daniela', 'Carolina', 'Elena', 'Paula', 'Natalia'];
const latinAmericanCountries = [
    'Argentina', 'Bolivia', 'Brasil', 'Chile', 'Colombia', 'Costa Rica', 'Cuba', 'República Dominicana',
    'Ecuador', 'El Salvador', 'Guatemala', 'Honduras', 'México', 'Nicaragua', 'Panamá', 'Paraguay', 'Perú',
    'Uruguay', 'Venezuela',
];
const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
const wordsIn = (value: string) => new Set(normalize(value).split(/[^\p{L}\p{N}]+/u));

test('loads varied simulated messages with separate sender identities', () => {
    assert.equal(SIMULATED_MESSAGES.length, 1000);
    assert.equal(SIMULATED_SENDERS.length, 1000);
    assert.equal(new Set(SIMULATED_MESSAGES).size, 1000);
    assert.equal(new Set(SIMULATED_SENDERS).size, 1000);
    assert.ok(SIMULATED_MESSAGES.every(message => !/\p{Extended_Pictographic}/u.test(message)));
    assert.ok(SIMULATED_MESSAGES.every(message => message.split(/\s+/).length <= 14));
    assert.ok(SIMULATED_MESSAGES.every(message => !/@[\w]+/u.test(message)));
    assert.ok(SIMULATED_SENDERS.every((sender, index) => {
        const senderName = sender.toLowerCase().slice(1).split('_')[0];
        const words = wordsIn(SIMULATED_MESSAGES[index]);
        const senderIsMale = maleHandles.includes(senderName);
        const senderIsFemale = femaleHandles.includes(senderName);
        const recipientIsMale = maleNames.some(name => words.has(normalize(name)));
        const recipientIsFemale = femaleNames.some(name => words.has(normalize(name)));
        return senderIsMale
            ? recipientIsFemale && !words.has(senderName)
            : senderIsFemale && recipientIsMale && !words.has(senderName);
    }));
    assert.ok(SIMULATED_SENDERS.every((sender, index) => {
        const senderName = sender.toLowerCase().slice(1).split('_')[0];
        return index % 2 === 0 ? maleHandles.includes(senderName) : femaleHandles.includes(senderName);
    }));
    assert.ok(SIMULATED_MESSAGES.slice(700).every(message =>
        latinAmericanCountries.some(country => normalize(message).includes(normalize(country)))
            && [...maleNames, ...femaleNames].some(name => wordsIn(message).has(normalize(name))),
    ));
    assert.ok(new Set(SIMULATED_MESSAGES.map(message => message.split(/\s+/).slice(0, 3).join(' '))).size >= 300);
    assert.ok(new Set(SIMULATED_MESSAGES.flatMap(message =>
        message.toLocaleLowerCase('es').split(/[^\p{L}\p{N}]+/u),
    )).size > 100);
});
