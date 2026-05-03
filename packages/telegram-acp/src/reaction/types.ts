/**
 * Reaction type definitions for Telegram-ACP bridge.
 */

export type ReactionPhase = 'thought' | 'tool' | 'media_in' | 'media_out' | 'done';

export interface ReactionState {
  currentPhase: ReactionPhase | null;
  lastUpdateAt: number;
}
