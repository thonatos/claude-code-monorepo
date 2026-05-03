/**
 * Manages all streaming messages for a single user session.
 */

import { MessageStream } from './message-stream.ts';
import { formatThought, formatThoughtFinal, markdownToHtml } from './formatting.ts';
import type { StreamingConfig, MessageCallbacks } from './types.ts';
import { DEFAULT_STREAMING_CONFIG } from './types.ts';

export class StreamingMessageState {
  private thoughtStream: MessageStream;
  private textStream: MessageStream;
  private lastTypingAt: number = 0;

  constructor(
    private readonly callbacks: MessageCallbacks,
    private readonly config: StreamingConfig = DEFAULT_STREAMING_CONFIG,
  ) {
    this.thoughtStream = new MessageStream('thought', callbacks, config, formatThought);
    this.textStream = new MessageStream('text', callbacks, config, markdownToHtml);
  }

  reset(): void {
    this.thoughtStream.reset();
    this.textStream.reset();
  }

  async appendThought(chunk: string): Promise<void> {
    await this.thoughtStream.append(chunk);
    await this.thoughtStream.flushIfNeeded();
    await this.maybeSendTyping();
  }

  async finalizeThought(): Promise<string> {
    return await this.thoughtStream.finalize();
  }

  async appendText(chunk: string): Promise<void> {
    if (this.thoughtStream.hasContent()) {
      await this.finalizeThought();
    }

    await this.textStream.append(chunk);
    await this.textStream.flushIfNeeded();
    await this.maybeSendTyping();
  }

  async finalizeText(): Promise<string> {
    return await this.textStream.finalize();
  }

  async finalizeAll(): Promise<string> {
    await this.finalizeThought();
    return await this.finalizeText();
  }

  private async maybeSendTyping(): Promise<void> {
    if (!this.callbacks.sendTyping) return;

    const now = Date.now();
    if (now - this.lastTypingAt < this.config.typingIntervalMs) {
      return;
    }

    this.lastTypingAt = now;
    try {
      await this.callbacks.sendTyping();
    } catch {
      // Best effort
    }
  }

  /**
   * Format thought with final prefix (public for external use).
   */
  formatThoughtFinal(text: string): string {
    return formatThoughtFinal(text);
  }
}
