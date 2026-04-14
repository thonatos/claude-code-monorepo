/**
 * Emoji mapping for reaction phases.
 */

import type { ReactionPhase } from "./reaction.types";

export const DEFAULT_EMOJI_MAP: Record<ReactionPhase, string> = {
  thought: "🤔",
  tool: "🔧",
  done: "✅",
};

/**
 * Minimum delay between reaction API calls (ms).
 */
export const REACTION_DEBOUNCE_MS = 500;
