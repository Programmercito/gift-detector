export type TextSender = (sender: string, text: string, durationSeconds: number) => Promise<void>;
export type ScheduleInterval = (callback: () => void, intervalMs: number) => () => void;

const scheduleInterval: ScheduleInterval = (callback, intervalMs) => {
    const timer = setInterval(callback, intervalMs);
    timer.unref?.();
    return () => clearInterval(timer);
};

export class PeriodicTextReminder {
    private cancelInterval: (() => void) | undefined;

    constructor(
        private readonly sendText: TextSender,
        private readonly text: string,
        private readonly intervalMinutes: number,
        private readonly durationSeconds: number,
        private readonly schedule: ScheduleInterval = scheduleInterval,
    ) {}

    start(): void {
        if (this.cancelInterval) return;
        this.cancelInterval = this.schedule(() => {
            void this.sendText('@admin', this.text, this.durationSeconds).catch(() => {
                console.error('Failed to send the scheduled admin reminder.');
            });
        }, this.intervalMinutes * 60_000);
    }

    stop(): void {
        this.cancelInterval?.();
        this.cancelInterval = undefined;
    }
}
