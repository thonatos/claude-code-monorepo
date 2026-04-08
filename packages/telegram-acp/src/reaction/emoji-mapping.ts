/**
 * Emoji mapping for reaction phases.
 */

import type { ReactionPhase } from './types.ts';

export const DEFAULT_EMOJI_MAP: Record<ReactionPhase, string> = {
  thought: '🤔',
  tool: '🔧',
  media_in: '📤',
  media_out: '📥',
  done: '✅',
};

/**
 * Minimum delay between reaction API calls (ms).
 */
export const REACTION_DEBOUNCE_MS = 500;