import assert from 'node:assert/strict';
import test from 'node:test';
import { SimulatedChatScheduler, type ScheduleTimeout } from './SimulatedChatScheduler';

class ManualTimeouts {
    private readonly tasks: Array<{ callback: () => void; delayMs: number; canceled: boolean }> = [];

    readonly schedule: ScheduleTimeout = (callback, delayMs) => {
        const task = { callback, delayMs, canceled: false };
        this.tasks.push(task);
        return () => { task.canceled = true; };
    };

    runNext(): number {
        while (this.tasks.length > 0) {
            const task = this.tasks.shift()!;
            if (task.canceled) continue;
            task.callback();
            return task.delayMs;
        }
        throw new Error('No scheduled timeout to run');
    }
}

const flushPromises = () => new Promise<void>(resolve => setImmediate(resolve));

test('sends simulated messages every five seconds without repeating back-to-back', async () => {
    const timeouts = new ManualTimeouts();
    const sent: Array<[string, string, number]> = [];
    const scheduler = new SimulatedChatScheduler(
        async (sender, text, duration) => { sent.push([sender, text, duration]); },
        ['First simulated message', 'Second simulated message'],
        ['@mateo_001', '@sofia_002'],
        5,
        5_000,
        () => 0,
        timeouts.schedule,
    );

    scheduler.start();
    assert.equal(timeouts.runNext(), 5_000);
    await flushPromises();
    assert.deepEqual(sent, [['@mateo_001', 'First simulated message', 5]]);

    assert.equal(timeouts.runNext(), 5_000);
    await flushPromises();
    assert.deepEqual(sent, [
        ['@mateo_001', 'First simulated message', 5],
        ['@sofia_002', 'Second simulated message', 5],
    ]);
    scheduler.stop();
});

test('pauses simulation and displays credited real chats in queue order', async () => {
    const timeouts = new ManualTimeouts();
    const sent: Array<[string, string]> = [];
    const scheduler = new SimulatedChatScheduler(
        async (sender, text) => { sent.push([sender, text]); },
        ['Simulated message'],
        ['@mateo_001'],
        60,
        60_000,
        () => 0,
        timeouts.schedule,
    );

    scheduler.start();
    timeouts.runNext();
    await flushPromises();

    let firstRealFinished = false;
    let secondRealFinished = false;
    const firstReal = scheduler.sendRealMessage('@ana', 'Real message one').then(() => { firstRealFinished = true; });
    const secondReal = scheduler.sendRealMessage('@luis', 'Real message two').then(() => { secondRealFinished = true; });
    await flushPromises();
    assert.deepEqual(sent, [['@mateo_001', 'Simulated message']]);

    timeouts.runNext();
    await flushPromises();
    assert.deepEqual(sent, [
        ['@mateo_001', 'Simulated message'],
        ['@ana', 'Real message one'],
    ]);
    assert.equal(firstRealFinished, false);

    timeouts.runNext();
    await flushPromises();
    assert.deepEqual(sent, [
        ['@mateo_001', 'Simulated message'],
        ['@ana', 'Real message one'],
        ['@luis', 'Real message two'],
    ]);
    assert.equal(firstRealFinished, true);
    assert.equal(secondRealFinished, false);

    timeouts.runNext();
    await Promise.all([firstReal, secondReal]);
    await flushPromises();
    assert.equal(secondRealFinished, true);
    assert.deepEqual(sent.at(-1), ['@mateo_001', 'Simulated message']);
    scheduler.stop();
});

test('a real chat arriving before the first simulation gets priority', async () => {
    const timeouts = new ManualTimeouts();
    const sent: string[] = [];
    const scheduler = new SimulatedChatScheduler(
        async (_sender, text) => { sent.push(text); },
        ['Simulated message'],
        ['@simulado_001'],
        60,
        60_000,
        Math.random,
        timeouts.schedule,
    );

    scheduler.start();
    const realMessage = scheduler.sendRealMessage('@ana', 'Real message');
    await flushPromises();
    assert.deepEqual(sent, ['Real message']);

    timeouts.runNext();
    await realMessage;
    await flushPromises();
    assert.deepEqual(sent, ['Real message', 'Simulated message']);
    scheduler.stop();
});

test('pauses the simulated sequence for the duration of a real gift event', async () => {
    const timeouts = new ManualTimeouts();
    const sent: string[] = [];
    const scheduler = new SimulatedChatScheduler(
        async (_sender, text) => { sent.push(text); },
        ['Simulated message'],
        ['@simulado_001'],
        60,
        60_000,
        Math.random,
        timeouts.schedule,
    );

    scheduler.start();
    scheduler.pauseForRealEvent(10);
    assert.deepEqual(sent, []);

    assert.equal(timeouts.runNext(), 10_000);
    await flushPromises();
    assert.deepEqual(sent, ['Simulated message']);
    scheduler.stop();
});

test('still displays credited chats while a real gift pauses simulated messages', async () => {
    const timeouts = new ManualTimeouts();
    const sent: string[] = [];
    const scheduler = new SimulatedChatScheduler(
        async (_sender, text) => { sent.push(text); },
        ['Simulated message'],
        ['@simulado_001'],
        60,
        60_000,
        Math.random,
        timeouts.schedule,
    );

    scheduler.start();
    scheduler.pauseForRealEvent(10);
    const creditedChat = scheduler.sendRealMessage('@ana', 'Credited real message');
    await flushPromises();
    assert.deepEqual(sent, ['Credited real message']);

    timeouts.runNext();
    assert.deepEqual(sent, ['Credited real message']);
    timeouts.runNext();
    await creditedChat;
    await flushPromises();
    assert.deepEqual(sent, ['Credited real message', 'Simulated message']);
    scheduler.stop();
});
