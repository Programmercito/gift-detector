import assert from 'node:assert/strict';
import test from 'node:test';
import { PeriodicTextReminder } from './PeriodicTextReminder';

test('sends the admin reminder on the configured interval and duration', async () => {
    let callback: (() => void) | undefined;
    let scheduledDelay = 0;
    let canceled = false;
    const calls: Array<[string, string, number]> = [];
    const reminder = new PeriodicTextReminder(
        async (sender, text, duration) => { calls.push([sender, text, duration]); },
        'Gift reminder',
        5,
        60,
        (nextCallback, intervalMs) => {
            callback = nextCallback;
            scheduledDelay = intervalMs;
            return () => { canceled = true; };
        },
    );

    reminder.start();
    assert.equal(calls.length, 0);
    assert.equal(scheduledDelay, 5 * 60_000);

    callback?.();
    await new Promise(resolve => setImmediate(resolve));

    assert.deepEqual(calls, [['@admin', 'Gift reminder', 60]]);
    reminder.stop();
    assert.equal(canceled, true);
});

test('does not schedule duplicate intervals when started twice', () => {
    let scheduleCount = 0;
    const reminder = new PeriodicTextReminder(
        async () => {},
        'Gift reminder',
        5,
        60,
        () => {
            scheduleCount += 1;
            return () => {};
        },
    );

    reminder.start();
    reminder.start();

    assert.equal(scheduleCount, 1);
});
