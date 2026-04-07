/**
 * History injection strategies with smart token management.
 */

import type { StoredMessage } from './storage.ts';

export interface HistoryInjectionConfig {
  strategy: 'full' | 'recent' | 'smart';  // Injection strategy
  maxTokens: number;                       // Max tokens to inject (default: 4000)
  maxMessages: number;                     // Max messages to inject (default: 20)
  recentWindowMs: number;                  // Recent message window (default: 1 hour)
  truncateThreshold: number;               // Truncate messages longer than this (default: 2000 chars)
}

export const DEFAULT_HISTORY_CONFIG: HistoryInjectionConfig = {
  strategy: 'smart',
  maxTokens: 4000,
  maxMessages: 20,
  recentWindowMs: 60 * 60 * 1000,  // 1 hour
  truncateThreshold: 2000,
};

/**
 * Estimate token count for a text (approximate).
 * Uses simple heuristic: ~4 chars per token for English, ~2 chars for Chinese.
 */
export function estimateTokens(text: string): number {
  // Detect if text has significant Chinese characters
  const chineseRatio = (text.match(/[\u4e00-\u9fa5]/g) || []).length / text.length;
  
  if (chineseRatio > 0.3) {
    // Chinese: ~2 chars per token
    return Math.ceil(text.length / 2);
  } else {
    // English/mixed: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}

/**
 * Truncate a message if it exceeds the threshold.
 */
function truncateMessage(message: StoredMessage, threshold: number): StoredMessage {
  if (message.content.length <= threshold) {
    return message;
  }
  
  return {
    ...message,
    content: message.content.slice(0, threshold) + '...[truncated]',
  };
}

/**
 * History injection manager.
 */
export class HistoryInjector {
  private config: HistoryInjectionConfig;
  private injectionCache: Map<string, {
    injected: boolean;
    messages: StoredMessage[];
    timestamp: number;
  }> = new Map();

  constructor(config: HistoryInjectionConfig = DEFAULT_HISTORY_CONFIG) {
    this.config = config;
  }

  /**
   * Build context for history injection.
   */
  buildContext(messages: StoredMessage[], newPrompt: string): string {
    switch (this.config.strategy) {
      case 'full':
        return this.buildFullContext(messages, newPrompt);
      case 'recent':
        return this.buildRecentContext(messages, newPrompt);
      case 'smart':
        return this.buildSmartContext(messages, newPrompt);
      default:
        return this.buildSmartContext(messages, newPrompt);
    }
  }

  /**
   * Full history injection (no filtering).
   */
  private buildFullContext(messages: StoredMessage[], newPrompt: string): string {
    const truncatedMessages = messages.map(m => truncateMessage(m, this.config.truncateThreshold));
    const historyText = this.formatHistory(truncatedMessages);
    return `${historyText}\n\n[Current message]:\n${newPrompt}`;
  }

  /**
   * Recent history injection (time-based window).
   */
  private buildRecentContext(messages: StoredMessage[], newPrompt: string): string {
    const cutoff = Date.now() - this.config.recentWindowMs;
    const recentMessages = messages
      .filter(m => m.timestamp >= cutoff)
      .slice(-this.config.maxMessages)
      .map(m => truncateMessage(m, this.config.truncateThreshold));
    
    const historyText = this.formatHistory(recentMessages);
    return `${historyText}\n\n[Current message]:\n${newPrompt}`;
  }

  /**
   * Smart history injection (token budget + recency + relevance).
   */
  private buildSmartContext(messages: StoredMessage[], newPrompt: string): string {
    // Start with recent messages
    const cutoff = Date.now() - this.config.recentWindowMs;
    let selectedMessages: StoredMessage[] = [];
    let totalTokens = 0;

    // Add recent messages first (reverse order from newest to oldest)
    const recentMessages = messages
      .filter(m => m.timestamp >= cutoff)
      .reverse();

    for (const message of recentMessages) {
      const truncated = truncateMessage(message, this.config.truncateThreshold);
      const tokens = estimateTokens(truncated.content);

      if (totalTokens + tokens > this.config.maxTokens) {
        break;
      }

      selectedMessages.unshift(truncated);
      totalTokens += tokens;

      if (selectedMessages.length >= this.config.maxMessages) {
        break;
      }
    }

    // If budget still available, add older messages
    if (totalTokens < this.config.maxTokens && selectedMessages.length < this.config.maxMessages) {
      const olderMessages = messages
        .filter(m => m.timestamp < cutoff)
        .reverse();

      for (const message of olderMessages) {
        const truncated = truncateMessage(message, this.config.truncateThreshold);
        const tokens = estimateTokens(truncated.content);

        if (totalTokens + tokens > this.config.maxTokens) {
          break;
        }

        selectedMessages.unshift(truncated);
        totalTokens += tokens;

        if (selectedMessages.length >= this.config.maxMessages) {
          break;
        }
      }
    }

    const historyText = selectedMessages.length > 0 
      ? this.formatHistory(selectedMessages)
      : '';
    
    return historyText 
      ? `${historyText}\n\n[Current message]:\n${newPrompt}`
      : newPrompt;
  }

  /**
   * Format history messages as context.
   */
  private formatHistory(messages: StoredMessage[]): string {
    const lines = ['[Previous conversation context]:'];
    
    for (const msg of messages) {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const timestamp = new Date(msg.timestamp).toLocaleTimeString();
      lines.push(`${role} (${timestamp}): ${msg.content}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Check if history has been injected for a user.
   */
  hasInjected(userId: string): boolean {
    const cached = this.injectionCache.get(userId);
    return cached?.injected ?? false;
  }

  /**
   * Mark history as injected for a user.
   */
  markInjected(userId: string, messages: StoredMessage[]): void {
    this.injectionCache.set(userId, {
      injected: true,
      messages,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear injection cache for a user.
   */
  clearInjection(userId: string): void {
    this.injectionCache.delete(userId);
  }

  /**
   * Clear all injection caches.
   */
  clearAll(): void {
    this.injectionCache.clear();
  }

  /**
   * Get cached messages for a user.
   */
  getCachedMessages(userId: string): StoredMessage[] | null {
    const cached = this.injectionCache.get(userId);
    return cached?.messages ?? null;
  }

  /**
   * Update config.
   */
  updateConfig(config: Partial<HistoryInjectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current config.
   */
  getConfig(): HistoryInjectionConfig {
    return { ...this.config };
  }
}
