import assert from 'node:assert/strict';
import test from 'node:test';
import { SimulatedChatScheduler, type ScheduleTimeout } from './SimulatedChatScheduler';

class ManualTimeouts {
    private now = 0;
    private readonly tasks: Array<{ callback: () => void; dueAt: number; delayMs: number; canceled: boolean }> = [];

    readonly schedule: ScheduleTimeout = (callback, delayMs) => {
        const task = { callback, dueAt: this.now + delayMs, delayMs, canceled: false };
        this.tasks.push(task);
        return () => { task.canceled = true; };
    };

    get nowMs(): number {
        return this.now;
    }

    runNext(): number {
        let nextIndex = -1;
        for (let index = 0; index < this.tasks.length; index += 1) {
            if (this.tasks[index].canceled) continue;
            if (nextIndex === -1 || this.tasks[index].dueAt < this.tasks[nextIndex].dueAt) nextIndex = index;
        }
        if (nextIndex === -1) throw new Error('No scheduled timeout to run');
        const [task] = this.tasks.splice(nextIndex, 1);
        this.now = task.dueAt;
        task.callback();
        return task.delayMs;
    }
}

const flushPromises = () => new Promise<void>(resolve => setImmediate(resolve));

test('fills three visible slots at five-second intervals, then waits for space', async () => {
    const timeouts = new ManualTimeouts();
    const sent: Array<[string, string, number, number]> = [];
    const randomValues = [0, 0.25, 0.5, 0.75];
    let randomIndex = 0;
    const scheduler = new SimulatedChatScheduler(
        async (sender, text, duration) => { sent.push([sender, text, duration, timeouts.nowMs]); },
        ['Message one', 'Message two', 'Message three', 'Message four'],
        ['@sender_001', '@sender_002', '@sender_003', '@sender_004'],
        25,
        5_000,
        () => randomValues[randomIndex++ % randomValues.length],
        timeouts.schedule,
        1,
        3,
    );

    scheduler.start();
    await flushPromises();
    assert.deepEqual(sent.map(([, text, , at]) => [text, at]), [['Message one', 0]]);

    timeouts.runNext();
    await flushPromises();
    timeouts.runNext();
    await flushPromises();
    assert.deepEqual(sent.map(([, text, , at]) => [text, at]), [
        ['Message one', 0],
        ['Message two', 5_000],
        ['Message three', 10_000],
    ]);

    timeouts.runNext(); // 15s: all three slots are occupied; skip this tick.
    await flushPromises();
    timeouts.runNext(); // 20s: still full; skip again.
    await flushPromises();
    assert.equal(sent.length, 3);

    while (sent.length < 4) {
        timeouts.runNext();
        await flushPromises();
    }
    assert.deepEqual(sent[3], ['@sender_004', 'Message four', 25, 25_000]);
    assert.ok(sent.every(([, , duration]) => duration === 25));
    scheduler.stop();
});

test('real messages take available visible slots before further simulations', async () => {
    const timeouts = new ManualTimeouts();
    const sent: Array<[string, string, number, number]> = [];
    const scheduler = new SimulatedChatScheduler(
        async (sender, text, duration) => { sent.push([sender, text, duration, timeouts.nowMs]); },
        ['Simulated one', 'Simulated two', 'Simulated three', 'Simulated four'],
        ['@sim_001', '@sim_002', '@sim_003', '@sim_004'],
        25,
        5_000,
        () => 0,
        timeouts.schedule,
        2,
        3,
    );

    scheduler.start();
    await flushPromises();
    timeouts.runNext();
    await flushPromises();
    timeouts.runNext();
    await flushPromises();
    assert.equal(sent.length, 3);

    let firstRealFinished = false;
    let secondRealFinished = false;
    const firstReal = scheduler.sendRealMessage('@ana_0001', 'Real one').then(() => { firstRealFinished = true; });
    const secondReal = scheduler.sendRealMessage('@luis_0002', 'Real two').then(() => { secondRealFinished = true; });
    await flushPromises();
    assert.equal(sent.length, 3);

    while (sent.length < 5) {
        timeouts.runNext();
        await flushPromises();
    }
    assert.deepEqual(sent.slice(3), [
        ['@ana_0001', 'Real one', 25, 25_000],
        ['@luis_0002', 'Real two', 25, 30_000],
    ]);

    scheduler.stop();
    while (!firstRealFinished || !secondRealFinished) {
        timeouts.runNext();
        await flushPromises();
    }
    await Promise.all([firstReal, secondReal]);
    scheduler.stop();
});

test('bounds pending real messages and reserves their slot ahead of simulations', async () => {
    const timeouts = new ManualTimeouts();
    const sent: Array<[string, string, number, number]> = [];
    const scheduler = new SimulatedChatScheduler(
        async (sender, text, duration) => { sent.push([sender, text, duration, timeouts.nowMs]); },
        ['Simulated one', 'Simulated two', 'Simulated three'],
        ['@sim_001', '@sim_002', '@sim_003'],
        25,
        5_000,
        () => 0,
        timeouts.schedule,
        1,
        3,
    );

    scheduler.start();
    await flushPromises();
    timeouts.runNext();
    await flushPromises();
    timeouts.runNext();
    await flushPromises();
    let realFinished = false;
    const real = scheduler.sendRealMessage('@ana_0001', 'Priority real').then(() => { realFinished = true; });
    await assert.rejects(scheduler.sendRealMessage('@luis_0002', 'Overflow real'), /queue is full/);

    while (sent.length < 4) {
        timeouts.runNext();
        await flushPromises();
    }
    assert.deepEqual(sent[3], ['@ana_0001', 'Priority real', 25, 25_000]);
    scheduler.stop();
    while (!realFinished) {
        timeouts.runNext();
        await flushPromises();
    }
    await real;
});

test('admin shares the visible slots and keeps its configured sixty-second duration', async () => {
    const timeouts = new ManualTimeouts();
    const sent: Array<[string, string, number, number]> = [];
    const scheduler = new SimulatedChatScheduler(
        async (sender, text, duration) => { sent.push([sender, text, duration, timeouts.nowMs]); },
        ['Simulated one', 'Simulated two', 'Simulated three'],
        ['@sim_001', '@sim_002', '@sim_003'],
        25,
        5_000,
        () => 0,
        timeouts.schedule,
        2,
        3,
    );

    scheduler.start();
    await flushPromises();
    timeouts.runNext();
    await flushPromises();
    timeouts.runNext();
    await flushPromises();
    const admin = scheduler.enqueueMessage('@admin', 'Admin reminder', 60);
    const real = scheduler.sendRealMessage('@ana_0001', 'Real chat');
    await flushPromises();

    while (sent.length < 4) {
        timeouts.runNext();
        await flushPromises();
    }
    assert.deepEqual(sent[3], ['@ana_0001', 'Real chat', 25, 25_000]);
    while (sent.length < 5) {
        timeouts.runNext();
        await flushPromises();
    }
    assert.deepEqual(sent[4], ['@admin', 'Admin reminder', 60, 50_000]);
    scheduler.stop();
    while (timeouts.nowMs < 110_000) {
        timeouts.runNext();
        await flushPromises();
    }
    await Promise.all([admin, real]);
});

test('real chat arriving before start is delivered before simulated text', async () => {
    const timeouts = new ManualTimeouts();
    const sent: string[] = [];
    const scheduler = new SimulatedChatScheduler(
        async (_sender, text) => { sent.push(text); },
        ['Simulated message'],
        ['@simulado_001'],
        5,
        5_000,
        Math.random,
        timeouts.schedule,
        1,
        3,
    );

    const real = scheduler.sendRealMessage('@ana', 'Real message');
    await flushPromises();
    assert.deepEqual(sent, ['Real message']);
    scheduler.start();
    while (sent.length < 2) {
        timeouts.runNext();
        await flushPromises();
    }
    await real;
    assert.deepEqual(sent, ['Real message', 'Simulated message']);
    scheduler.stop();
});

test('gift events pause simulated enqueues but allow real chat into a free slot', async () => {
    const timeouts = new ManualTimeouts();
    const sent: Array<[string, string, number, number]> = [];
    const scheduler = new SimulatedChatScheduler(
        async (sender, text, duration) => { sent.push([sender, text, duration, timeouts.nowMs]); },
        ['Simulated one', 'Simulated two', 'Simulated three'],
        ['@sim_001', '@sim_002', '@sim_003'],
        5,
        5_000,
        () => 0,
        timeouts.schedule,
        1,
        3,
    );

    scheduler.start();
    await flushPromises();
    const resumeGift = scheduler.pauseForRealEvent(10);
    const real = scheduler.sendRealMessage('@ana_0001', 'Credited real message');
    await flushPromises();
    assert.deepEqual(sent.map(([, text]) => text), ['Simulated one', 'Credited real message']);

    while (timeouts.nowMs < 10_000) {
        timeouts.runNext();
        await flushPromises();
    }
    resumeGift();
    while (sent.length < 3) {
        timeouts.runNext();
        await flushPromises();
    }
    assert.deepEqual(sent[2], ['@sim_002', 'Simulated two', 5, 10_000]);
    await real;
    scheduler.stop();
});
