/**
 * Streaming message state machine for Telegram API interactions.
 * Manages message chunking, rate limiting, and state transitions.
 */

export interface StreamingConfig {
  firstSendThreshold: number;
  editThreshold: number;
  editIntervalMs: number;
  typingIntervalMs: number;
  rateLimitDelayMs: number;
}

export const DEFAULT_STREAMING_CONFIG: StreamingConfig = {
  firstSendThreshold: 20,
  editThreshold: 50,
  editIntervalMs: 500,
  typingIntervalMs: 5000,
  rateLimitDelayMs: 100,
};

export interface MessageCallbacks {
  sendMessage: (text: string, parseMode?: 'HTML') => Promise<number>;
  editMessage: (msgId: number, text: string, parseMode?: 'HTML') => Promise<number>;
  sendTyping: () => Promise<void>;
  log: (msg: string) => void;
}

/**
 * Manages state for a single streaming message.
 */
class MessageStream {
  private msgId: number | null = null;
  private chunks: string[] = [];
  private charCount: number = 0;
  private lastEditTime: number = 0;
  private isSending: boolean = false;
  private pendingChunks: string[] = [];

  constructor(
    private readonly type: 'thought' | 'text' | 'tool',
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

/**
 * Manages all streaming messages for a single user session.
 */
export class StreamingMessageState {
  private thoughtStream: MessageStream;
  private textStream: MessageStream;
  private toolStreams: Map<string, MessageStream> = new Map();
  private lastTypingAt: number = 0;

  constructor(
    private readonly callbacks: MessageCallbacks,
    private readonly config: StreamingConfig = DEFAULT_STREAMING_CONFIG
  ) {
    this.thoughtStream = new MessageStream('thought', callbacks, config, this.formatThought.bind(this));
    this.textStream = new MessageStream('text', callbacks, config, this.formatText.bind(this));
  }

  reset(): void {
    this.thoughtStream.reset();
    this.textStream.reset();
    this.toolStreams.clear();
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

  async updateToolCall(toolCallId: string, formatter: () => string): Promise<void> {
    if (this.thoughtStream.hasContent()) {
      await this.finalizeThought();
    }

    let stream = this.toolStreams.get(toolCallId);
    
    if (!stream) {
      stream = new MessageStream('tool', this.callbacks, this.config, formatter);
      this.toolStreams.set(toolCallId, stream);
    }

    if (!stream.getMessageId()) {
      const text = formatter();
      const msgId = await this.callbacks.sendMessage(text, 'HTML');
      stream.setMessageId(msgId);
    }

    await this.maybeSendTyping();
  }

  async editToolCall(toolCallId: string, formatter: () => string): Promise<void> {
    const stream = this.toolStreams.get(toolCallId);
    if (stream && stream.getMessageId()) {
      const text = formatter();
      await this.callbacks.editMessage(stream.getMessageId()!, text, 'HTML');
    }
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

  private formatThought(text: string): string {
    const escaped = this.escapeHtml(text);
    return `<i>💭 Thinking...</i>\n${escaped}`;
  }

  formatThoughtFinal(text: string): string {
    const escaped = this.escapeHtml(text);
    return `<i>💭 Thought complete</i>\n${escaped}`;
  }

  private formatText(text: string): string {
    return this.markdownToHtml(text);
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private markdownToHtml(text: string): string {
    const codeBlocks: string[] = [];

    let result = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => {
      const index = codeBlocks.length;
      codeBlocks.push(`<pre><code>${this.escapeHtml(code)}</code></pre>`);
      return `\x00CODEBLOCK${index}\x00`;
    });

    result = result.replace(/`([^`]+)`/g, (_, code) => `<code>${this.escapeHtml(code)}</code>`);
    result = result.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    result = result.replace(/\*([^*]+)\*/g, '<i>$1</i>');
    result = result.replace(/_([^_]+)_/g, '<i>$1</i>');
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    codeBlocks.forEach((block, index) => {
      result = result.replace(`\x00CODEBLOCK${index}\x00`, block);
    });

    return result.trim();
  }
}

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
