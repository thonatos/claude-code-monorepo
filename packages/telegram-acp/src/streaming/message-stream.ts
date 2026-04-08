/**
 * Manages state for a single streaming message.
 */

import type { StreamingConfig, MessageCallbacks } from './types.ts';

export type StreamType = 'thought' | 'text' | 'tool';

export class MessageStream {
  private msgId: number | null = null;
  private chunks: string[] = [];
  private charCount: number = 0;
  private lastEditTime: number = 0;
  private isSending: boolean = false;
  private pendingChunks: string[] = [];

  constructor(
    private readonly type: StreamType,
    private readonly callbacks: MessageCallbacks,
    private readonly config: StreamingConfig,
    private readonly formatter: (text: string) => string
  ) {}

  async append(chunk: string): Promise<void> {
    if (this.isSending) {
      this.pendingChunks.push(chunk);
      this.charCount += chunk.length;
    } else {
      this.chunks.push(chunk);
      this.charCount += chunk.length;
    }
  }

  async flushIfNeeded(): Promise<void> {
    if (this.isSending) return;

    const now = Date.now();

    if (!this.msgId && this.charCount >= this.config.firstSendThreshold) {
      await this.sendFirstMessage();
      return;
    }

    if (this.msgId) {
      const shouldEditByThreshold = this.charCount >= this.config.editThreshold;
      const shouldEditByTime = (now - this.lastEditTime) >= this.config.editIntervalMs && this.charCount > 0;

      if (shouldEditByThreshold || shouldEditByTime) {
        const elapsed = now - this.lastEditTime;
        if (elapsed >= this.config.rateLimitDelayMs) {
          await this.editMessage();
        }
      }
    }
  }

  private async sendFirstMessage(): Promise<void> {
    if (this.isSending || this.msgId) return;

    this.isSending = true;

    try {
      const text = this.formatter(this.chunks.join(''));
      const msgId = await this.callbacks.sendMessage(text, 'HTML');

      if (msgId && msgId > 0) {
        this.msgId = msgId;
        this.lastEditTime = Date.now();
        this.charCount = 0;

        if (this.pendingChunks.length > 0) {
          this.chunks.push(...this.pendingChunks);
          this.charCount = this.pendingChunks.reduce((sum, c) => sum + c.length, 0);
          this.pendingChunks = [];
        }
      }
    } catch (err) {
      this.callbacks.log(`[streaming] Error sending message: ${String(err)}`);
    } finally {
      this.isSending = false;
    }
  }

  private async editMessage(): Promise<void> {
    if (this.isSending || !this.msgId) return;

    this.isSending = true;

    try {
      const text = this.formatter(this.chunks.join(''));
      await this.callbacks.editMessage(this.msgId, text, 'HTML');

      this.lastEditTime = Date.now();
      this.charCount = 0;

      if (this.pendingChunks.length > 0) {
        this.chunks.push(...this.pendingChunks);
        this.charCount = this.pendingChunks.reduce((sum, c) => sum + c.length, 0);
        this.pendingChunks = [];
      }
    } catch (err) {
      this.callbacks.log(`[streaming] Error editing message: ${String(err)}`);
    } finally {
      this.isSending = false;
    }
  }

  async finalize(): Promise<string> {
    while (this.isSending) {
      await new Promise(r => setTimeout(r, 10));
    }

    const text = this.chunks.join('');

    if (this.msgId && this.chunks.length > 0) {
      const formatted = this.formatter(text);
      try {
        await this.callbacks.editMessage(this.msgId, formatted, 'HTML');
      } catch (err) {
        this.callbacks.log(`[streaming] Error finalizing message: ${String(err)}`);
      }
    }

    return text;
  }

  getMessageId(): number | null {
    return this.msgId;
  }

  setMessageId(id: number): void {
    this.msgId = id;
  }

  reset(): void {
    this.msgId = null;
    this.chunks = [];
    this.charCount = 0;
    this.lastEditTime = 0;
    this.isSending = false;
    this.pendingChunks = [];
  }

  hasContent(): boolean {
    return this.chunks.length > 0 || this.pendingChunks.length > 0;
  }
}