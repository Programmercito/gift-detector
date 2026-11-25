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
    private readonly messageQueue: QueuedMessage[] = [];
    private cancelSimulationTick: (() => void) | undefined;
    private started = false;
    private activeMessages = 0;
    private activeRealMessages = 0;
    private realEventPauses = 0;
    private lastMessageIndex = -1;

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
        this.enqueueSimulatedMessage();
        this.scheduleNextSimulationTick();
    }

    stop(): void {
        this.started = false;
        this.cancelSimulationTick?.();
        this.cancelSimulationTick = undefined;
    }

    sendRealMessage(sender: string, text: string): Promise<void> {
        return this.enqueueWithPriority(sender, text, this.durationSeconds, 'real');
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
                console.warn(`[scheduler] enqueue rejected: ${this.describeMessage(message)}; ${this.queueStatus()}`);
                reject(new Error('Pending message queue is full'));
                return;
            }
            console.info(`[scheduler] enqueued: ${this.describeMessage(message)}; ${this.queueStatus()}`);
            this.pump();
        });
    }

    private insertMessage(message: QueuedMessage): boolean {
        if (this.messageQueue.length < this.maxPendingMessages) {
            this.insertByPriority(message);
            return true;
        }

        const priority = MESSAGE_PRIORITY[message.priority];
        const replaceIndex = this.messageQueue.findIndex(
            queued => MESSAGE_PRIORITY[queued.priority] < priority,
        );
        if (replaceIndex === -1) return false;

        const [displaced] = this.messageQueue.splice(replaceIndex, 1);
        console.warn(`[scheduler] displaced: ${this.describeMessage(displaced)}; ${this.queueStatus()}`);
        displaced.reject?.(new Error('Pending message replaced by a higher-priority message'));
        if (message.priority === 'real') this.insertByPriority(message);
        else this.messageQueue.splice(replaceIndex, 0, message);
        return true;
    }

    private insertByPriority(message: QueuedMessage): void {
        if (message.priority !== 'real') {
            this.messageQueue.push(message);
            return;
        }

        let insertAt = 0;
        while (insertAt < this.messageQueue.length && this.messageQueue[insertAt].priority === 'real') {
            insertAt += 1;
        }
        this.messageQueue.splice(insertAt, 0, message);
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
            let nextIndex = 0;
            if (this.activeRealMessages > 0 || this.realEventPauses > 0) {
                nextIndex = this.messageQueue.findIndex(message => message.priority === 'real');
                if (nextIndex === -1) return;
            }
            const nextMessage = this.messageQueue.splice(nextIndex, 1)[0];
            if (!nextMessage) return;
            this.display(nextMessage);
        }
    }

    private enqueueSimulatedMessage(): void {
        if (!this.started || this.simulatedMessages.length === 0) return;
        if (this.messageQueue.some(message => message.priority === 'real') || this.activeRealMessages > 0 || this.realEventPauses > 0) {
            console.info(`[scheduler] simulated tick skipped: real priority or gift pause; ${this.queueStatus()}`);
            return;
        }
        if (this.messageQueue.length >= this.maxPendingMessages) {
            console.info(`[scheduler] simulated tick skipped: pending queue full; ${this.queueStatus()}`);
            return;
        }
        if (this.activeMessages + this.messageQueue.length >= this.maxVisibleMessages) {
            console.info(`[scheduler] simulated tick skipped: all visible slots occupied; ${this.queueStatus()}`);
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
        this.insertMessage(message);
        console.info(`[scheduler] enqueued simulated #${index + 1}: ${this.describeMessage(message)}; ${this.queueStatus()}`);
        this.pump();
    }

    private scheduleNextSimulationTick(): void {
        if (!this.started) return;
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
        console.info(`[scheduler] display started: ${this.describeMessage(queuedMessage)}; ${this.queueStatus()}`);
        void this.sendText(sender, text, durationSeconds).then(() => {
            this.schedule(() => {
                this.activeMessages -= 1;
                if (queuedMessage.priority === 'real') this.activeRealMessages -= 1;
                queuedMessage.resolve?.();
                console.info(`[scheduler] display finished: ${this.describeMessage(queuedMessage)}; ${this.queueStatus()}`);
                this.pump();
            }, durationSeconds * 1000);
        }).catch(error => {
            this.activeMessages -= 1;
            if (queuedMessage.priority === 'real') this.activeRealMessages -= 1;
            queuedMessage.reject?.(error);
            console.error(`[scheduler] display failed: ${this.describeMessage(queuedMessage)}; error=${String(error)}; ${this.queueStatus()}`);
            this.pump();
        });
    }

    private describeMessage(message: QueuedMessage): string {
        const text = message.text.replace(/\s+/g, ' ').slice(0, 120);
        return `priority=${message.priority} sender=${message.sender} duration=${message.durationSeconds}s text=${JSON.stringify(text)}`;
    }

    private queueStatus(): string {
        const real = this.messageQueue.filter(message => message.priority === 'real').length;
        const admin = this.messageQueue.filter(message => message.priority === 'scheduled').length;
        const simulated = this.messageQueue.filter(message => message.priority === 'simulated').length;
        return `pending=${this.messageQueue.length}/${this.maxPendingMessages} (real=${real}, admin=${admin}, simulated=${simulated}), visible=${this.activeMessages}/${this.maxVisibleMessages}, active-real=${this.activeRealMessages}, gift-pauses=${this.realEventPauses}`;
    }
}
