// packages/telegram-acp/test/reaction/manager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReactionManager } from '../../src/reaction/manager.ts';
import { DEFAULT_EMOJI_MAP, REACTION_DEBOUNCE_MS } from '../../src/reaction/emoji-mapping.ts';

describe('ReactionManager', () => {
  let mockReact: ReturnType<typeof vi.fn>;
  let manager: ReactionManager;

  beforeEach(() => {
    mockReact = vi.fn().mockResolvedValue(undefined);
    manager = new ReactionManager(mockReact);
  });

  it('should set reaction for phase', async () => {
    await manager.setReaction('thought');

    expect(mockReact).toHaveBeenCalledTimes(1);
    expect(mockReact).toHaveBeenCalledWith(DEFAULT_EMOJI_MAP.thought);
  });

  it('should not call API for same phase twice (debouncing)', async () => {
    await manager.setReaction('thought');
    await manager.setReaction('thought'); // Same phase

    expect(mockReact).toHaveBeenCalledTimes(1); // Only called once
  });

  it('should call API when phase changes (after debounce)', async () => {
    await manager.setReaction('thought');

    // Wait for debounce to expire
    await new Promise((r) => setTimeout(r, REACTION_DEBOUNCE_MS + 10));

    await manager.setReaction('tool'); // Different phase

    expect(mockReact).toHaveBeenCalledTimes(2);
    expect(mockReact).toHaveBeenLastCalledWith(DEFAULT_EMOJI_MAP.tool);
  });

  it('should clear reaction', async () => {
    await manager.setReaction('thought');
    await manager.clearReaction();

    expect(mockReact).toHaveBeenLastCalledWith('');
  });

  it('should not throw when API fails', async () => {
    mockReact.mockRejectedValue(new Error('API error'));

    // Should not throw
    await expect(manager.setReaction('thought')).resolves.toBeUndefined();
  });

  it('should respect debounce delay', async () => {
    await manager.setReaction('thought');

    // Immediately change phase (within debounce window)
    await manager.setReaction('tool');

    // Should skip due to debounce
    expect(mockReact).toHaveBeenCalledTimes(1);

    // Wait for debounce to expire
    await new Promise((r) => setTimeout(r, REACTION_DEBOUNCE_MS + 10));

    // Now should allow update
    await manager.setReaction('tool');
    expect(mockReact).toHaveBeenCalledTimes(2);
  });
});
