export type ScheduledTextSender = (sender: string, text: string, durationSeconds: number) => Promise<void>;
export type ScheduleTimeout = (callback: () => void, delayMs: number) => () => void;

const MESSAGE_PRIORITY = { simulated: 0, scheduled: 1, real: 2 } as const;

const scheduleTimeout: ScheduleTimeout = (callback, delayMs) => {
    const timer = setTimeout(callback, delayMs);
    timer.unref?.();
    return () => clearTimeout(timer);
};

type QueuedMessage = {
    sender: string;
    text: string;
    durationSeconds: number;
    priority: 'real' | 'scheduled' | 'simulated';
    resolve?: () => void;
    reject?: (error: unknown) => void;
};

export class SimulatedChatScheduler {
    private readonly realMessages: QueuedMessage[] = [];
    private readonly messageQueue: QueuedMessage[] = [];
    private cancelSimulationTick: (() => void) | undefined;
    private started = false;
    private activeMessages = 0;
    private activeRealMessages = 0;
    private realEventPauses = 0;
    private lastMessageIndex = -1;
    private lastQueueLogLength = 0;

    constructor(
        private readonly sendText: ScheduledTextSender,
        private readonly simulatedMessages: string[],
        private readonly simulatedSenders: string[] = [],
        private readonly durationSeconds = 60,
        private readonly intervalMs = 60_000,
        private readonly random: () => number = Math.random,
        private readonly schedule: ScheduleTimeout = scheduleTimeout,
        private readonly maxPendingMessages = 1,
        private readonly maxVisibleMessages = 3,
        private readonly freeMessagesEnabled = true,
    ) {
        if (!Number.isInteger(maxPendingMessages) || maxPendingMessages < 1) {
            throw new Error('maxPendingMessages must be a positive integer');
        }
        if (!Number.isInteger(maxVisibleMessages) || maxVisibleMessages < 1) {
            throw new Error('maxVisibleMessages must be a positive integer');
        }
    }

    start(): void {
        if (this.started) return;
        this.started = true;
        if (!this.freeMessagesEnabled) return;
        this.enqueueSimulatedMessage();
        this.scheduleNextSimulationTick();
    }

    stop(): void {
        this.started = false;
        this.cancelSimulationTick?.();
        this.cancelSimulationTick = undefined;
    }

    sendRealMessage(sender: string, text: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const message: QueuedMessage = {
                sender,
                text,
                durationSeconds: this.durationSeconds,
                priority: 'real',
                resolve,
                reject,
            };
            this.realMessages.push(message);
            this.logQueueStatus('enqueued real', message);
            this.pump();
        });
    }

    enqueueMessage(sender: string, text: string, durationSeconds: number): Promise<void> {
        return this.enqueueWithPriority(sender, text, durationSeconds, 'scheduled');
    }

    private enqueueWithPriority(
        sender: string,
        text: string,
        durationSeconds: number,
        priority: QueuedMessage['priority'],
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const message: QueuedMessage = { sender, text, durationSeconds, priority, resolve, reject };
            if (!this.insertMessage(message)) {
                console.warn(`[queue] rejected: ${this.describeMessage(message)}; ${this.queueStatus()}`);
                reject(new Error('Pending message queue is full'));
                return;
            }
            this.pump();
            this.logQueueStatus('enqueued', message);
        });
    }

    private insertMessage(message: QueuedMessage): boolean {
        if (this.messageQueue.length < this.maxPendingMessages) {
            this.messageQueue.push(message);
            return true;
        }

        const priority = MESSAGE_PRIORITY[message.priority];
        const replaceIndex = this.messageQueue.findIndex(
            queued => MESSAGE_PRIORITY[queued.priority] < priority,
        );
        if (replaceIndex === -1) return false;

        const [displaced] = this.messageQueue.splice(replaceIndex, 1);
        this.logQueueStatus(`replaced ${this.describeMessage(displaced)} with`, message);
        displaced.reject?.(new Error('Pending message replaced by a higher-priority message'));
        this.messageQueue.splice(replaceIndex, 0, message);
        return true;
    }

    pauseForRealEvent(durationSeconds: number): () => void {
        this.realEventPauses += 1;

        let released = false;
        let cancelTimeout = () => {};
        const release = () => {
            if (released) return;
            released = true;
            cancelTimeout();
            this.realEventPauses -= 1;
            this.pump();
        };

        cancelTimeout = this.schedule(release, durationSeconds * 1000);
        return release;
    }

    private pump(): void {
        while (this.activeMessages < this.maxVisibleMessages) {
            const realMessage = this.realMessages.shift();
            if (realMessage) {
                this.display(realMessage);
                continue;
            }

            if (this.activeRealMessages > 0 || this.realEventPauses > 0) return;
            const nextMessage = this.messageQueue.shift();
            if (!nextMessage) return;
            this.display(nextMessage);
        }
    }

    private enqueueSimulatedMessage(): void {
        if (!this.started || !this.freeMessagesEnabled || this.simulatedMessages.length === 0) return;
        if (this.realMessages.length > 0 || this.activeRealMessages > 0 || this.realEventPauses > 0) {
            this.logQueueStatus('simulated tick skipped: real priority or gift pause');
            return;
        }
        if (this.messageQueue.length >= this.maxPendingMessages) {
            this.logQueueStatus('simulated tick skipped: pending queue full');
            return;
        }
        if (this.activeMessages + this.messageQueue.length >= this.maxVisibleMessages) {
            this.logQueueStatus('simulated tick skipped: all visible slots occupied');
            return;
        }
        const index = this.pickMessageIndex();
        const text = this.simulatedMessages[index];
        if (text === undefined) return;
        this.lastMessageIndex = index;
        const message: QueuedMessage = {
            sender: this.simulatedSenders[index] ?? '@comunidad',
            text,
            durationSeconds: this.durationSeconds,
            priority: 'simulated',
        };
        if (!this.insertMessage(message)) return;
        this.pump();
        this.logQueueStatus(`enqueued simulated #${index + 1}`, message);
    }

    private scheduleNextSimulationTick(): void {
        if (!this.started || !this.freeMessagesEnabled) return;
        this.cancelSimulationTick = this.schedule(() => {
            this.cancelSimulationTick = undefined;
            if (!this.started) return;
            this.enqueueSimulatedMessage();
            this.scheduleNextSimulationTick();
        }, this.intervalMs);
    }

    private pickMessageIndex(): number {
        if (this.simulatedMessages.length <= 1) return 0;
        const randomIndex = Math.min(
            this.simulatedMessages.length - 1,
            Math.floor(this.random() * this.simulatedMessages.length),
        );
        return randomIndex === this.lastMessageIndex
            ? (randomIndex + 1) % this.simulatedMessages.length
            : randomIndex;
    }

    private display(queuedMessage: QueuedMessage): void {
        const { sender, text, durationSeconds } = queuedMessage;
        this.activeMessages += 1;
        if (queuedMessage.priority === 'real') this.activeRealMessages += 1;
        void this.sendText(sender, text, durationSeconds).then(() => {
            queuedMessage.resolve?.();
            this.logQueueStatus('accepted by Event API', queuedMessage);
            this.schedule(() => {
                this.activeMessages -= 1;
                if (queuedMessage.priority === 'real') this.activeRealMessages -= 1;
                this.logQueueStatus('display finished', queuedMessage);
                this.pump();
            }, durationSeconds * 1000);
        }).catch(error => {
            this.activeMessages -= 1;
            if (queuedMessage.priority === 'real') this.activeRealMessages -= 1;
            queuedMessage.reject?.(error);
            console.error(`[queue] display failed: ${this.describeMessage(queuedMessage)}; error=${String(error)}; ${this.queueStatus()}`);
            this.pump();
        });
    }

    private describeMessage(message: QueuedMessage): string {
        const text = message.text.replace(/\s+/g, ' ').slice(0, 120);
        return `priority=${message.priority} sender=${message.sender} duration=${message.durationSeconds}s text=${JSON.stringify(text)}`;
    }

    private queueStatus(): string {
        const real = this.realMessages.length;
        const admin = this.messageQueue.filter(message => message.priority === 'scheduled').length;
        const simulated = this.messageQueue.filter(message => message.priority === 'simulated').length;
        return `real-queue=${real}, pending=${this.messageQueue.length}/${this.maxPendingMessages} (admin=${admin}, simulated=${simulated}), visible=${this.activeMessages}/${this.maxVisibleMessages}, active-real=${this.activeRealMessages}, gift-pauses=${this.realEventPauses}`;
    }

    private logQueueStatus(event: string, message?: QueuedMessage): void {
        const description = message ? `: ${this.describeMessage(message)}` : '';
        const line = `[queue] ${event}${description}; ${this.queueStatus()}`;
        if (!process.stdout.isTTY) return;

        process.stdout.write(`\r${line.padEnd(this.lastQueueLogLength)}\u001b[K`);
        this.lastQueueLogLength = Math.max(this.lastQueueLogLength, line.length);
    }
}
