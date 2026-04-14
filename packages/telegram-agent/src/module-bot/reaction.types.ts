/**
 * Reaction type definitions for Telegram Agent.
 */

export type ReactionPhase = "thought" | "tool" | "done";

export interface ReactionState {
  currentPhase: ReactionPhase | null;
  lastUpdateAt: number;
}
