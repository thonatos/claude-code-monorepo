/**
 * Streaming types and interfaces.
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
