/**
 * Rate limiter for Telegram API calls.
 */

export class TelegramRateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private lastCallTime = 0;

  constructor(
    private readonly minIntervalMs: number = 50,
    private readonly maxConcurrent: number = 3
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const elapsed = now - this.lastCallTime;

      if (elapsed < this.minIntervalMs) {
        await new Promise(r => setTimeout(r, this.minIntervalMs - elapsed));
      }

      const fn = this.queue.shift();
      if (fn) {
        this.lastCallTime = Date.now();
        await fn();
      }
    }

    this.processing = false;
  }
}