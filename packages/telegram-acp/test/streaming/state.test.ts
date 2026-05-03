import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StreamingMessageState, DEFAULT_STREAMING_CONFIG } from '../../src/streaming/index.ts';

describe('StreamingMessageState', () => {
  let mockSendMessage: ReturnType<typeof vi.fn>;
  let mockEditMessage: ReturnType<typeof vi.fn>;
  let mockSendTyping: ReturnType<typeof vi.fn>;
  let mockLog: ReturnType<typeof vi.fn>;
  let state: StreamingMessageState;

  beforeEach(() => {
    mockSendMessage = vi.fn().mockResolvedValue(123);
    mockEditMessage = vi.fn().mockResolvedValue(true);
    mockSendTyping = vi.fn().mockResolvedValue(undefined);
    mockLog = vi.fn();

    state = new StreamingMessageState(
      {
        sendMessage: mockSendMessage,
        editMessage: mockEditMessage,
        sendTyping: mockSendTyping,
        log: mockLog,
      },
      DEFAULT_STREAMING_CONFIG,
    );
  });

  describe('thought streaming', () => {
    it('should send message when reaching first send threshold', async () => {
      await state.appendThought('This is a thought with more than twenty characters');

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(expect.stringContaining('Thinking...'), 'HTML');
    });

    it('should not send before reaching threshold', async () => {
      await state.appendThought('short');

      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('text streaming', () => {
    it('should convert markdown to HTML', async () => {
      await state.appendText('Use **bold** text with enough chars to trigger');

      const sentText = mockSendMessage.mock.calls[0][0];
      expect(sentText).toContain('<b>bold</b>');
    });
  });

  describe('reset', () => {
    it('should clear all streams', async () => {
      await state.appendThought('Thinking with more than twenty chars');
      await state.appendText('Text with enough characters');

      state.reset();

      // New messages should create new streams
      await state.appendThought('New thought with more than 20 chars');

      expect(mockSendMessage.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
