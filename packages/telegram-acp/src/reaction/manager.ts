/**
 * Manages reaction state with debouncing to avoid API spam.
 */

import { DEFAULT_EMOJI_MAP, REACTION_DEBOUNCE_MS } from './emoji-mapping.ts';
import type { ReactionPhase, ReactionState } from './types.ts';

export class ReactionManager {
  private state: ReactionState = {
    currentPhase: null,
    lastUpdateAt: 0,
  };

  constructor(private setReactionApi: (emoji: string) => Promise<void>) {}

  async setReaction(phase: ReactionPhase): Promise<void> {
    // Debouncing: check if phase changed
    if (this.state.currentPhase === phase) {
      return; // Skip duplicate update
    }

    // Check debounce delay (only for different phases)
    const now = Date.now();
    if (this.state.currentPhase !== null && now - this.state.lastUpdateAt < REACTION_DEBOUNCE_MS) {
      return; // Skip if too frequent
    }

    // Update state
    this.state.currentPhase = phase;
    this.state.lastUpdateAt = now;

    // Call API (best-effort, don't throw on failure)
    try {
      const emoji = DEFAULT_EMOJI_MAP[phase];
      await this.setReactionApi(emoji);
    } catch (err) {
      // Log but don't throw to avoid blocking main flow
      console.debug(`[reaction] API call failed: ${String(err)}`);
    }
  }

  async clearReaction(): Promise<void> {
    this.state.currentPhase = null;
    this.state.lastUpdateAt = Date.now();
    await this.setReactionApi('');
  }

  getCurrentPhase(): ReactionPhase | null {
    return this.state.currentPhase;
  }
}
