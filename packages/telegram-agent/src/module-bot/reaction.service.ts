/**
 * Reaction service for managing Telegram message reactions.
 */

import { Inject, Injectable, ScopeEnum } from '@artusx/core';
import { DEFAULT_EMOJI_MAP, REACTION_DEBOUNCE_MS } from '../constants';
import type TelegramClient from '../plugins/telegram/client';
import { InjectEnum as TelegramInjectEnum } from '../plugins/telegram/constants';
import type { ReactionPhase, ReactionState } from '../types';

@Injectable({
  scope: ScopeEnum.SINGLETON,
})
export class ReactionService {
  @Inject(TelegramInjectEnum.Client)
  private telegramClient!: TelegramClient;

  // State tracking per user
  private states: Map<string, ReactionState> = new Map();

  /**
   * Send reaction for a phase.
   * Debounced to avoid API spam.
   */
  async sendReaction(userId: string, messageId: number, phase: ReactionPhase): Promise<void> {
    const state = this.getState(userId);

    // Debounce check
    const now = Date.now();
    if (state.lastUpdateAt && now - state.lastUpdateAt < REACTION_DEBOUNCE_MS) {
      return;
    }

    // Skip if same phase
    if (state.currentPhase === phase) {
      return;
    }

    const emoji = DEFAULT_EMOJI_MAP[phase] as any;
    const bot = this.telegramClient.getBot();

    await bot.api.setMessageReaction(userId, messageId, [{ type: 'emoji', emoji }]);

    state.currentPhase = phase;
    state.lastUpdateAt = now;
  }

  /**
   * Clear reaction.
   */
  async clearReaction(userId: string, messageId: number): Promise<void> {
    const bot = this.telegramClient.getBot();
    await bot.api.setMessageReaction(userId, messageId, []);

    const state = this.getState(userId);
    state.currentPhase = null;
    state.lastUpdateAt = Date.now();
  }

  /**
   * Get or create state for user.
   */
  private getState(userId: string): ReactionState {
    const existing = this.states.get(userId);
    if (existing) return existing;

    const state: ReactionState = {
      currentPhase: null,
      lastUpdateAt: 0,
    };
    this.states.set(userId, state);
    return state;
  }

  /**
   * Reset state for user (on new message).
   */
  reset(userId: string): void {
    this.states.delete(userId);
  }
}
