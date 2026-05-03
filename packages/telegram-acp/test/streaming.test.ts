import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StreamingMessageState, DEFAULT_STREAMING_CONFIG } from '../src/streaming/index.ts';

describe('StreamingMessageState - Real Streaming Simulation', () => {
  let mockSendMessage: ReturnType<typeof vi.fn>;
  let mockEditMessage: ReturnType<typeof vi.fn>;
  let mockSendTyping: ReturnType<typeof vi.fn>;
  let mockLog: ReturnType<typeof vi.fn>;
  let streamingState: StreamingMessageState;

  beforeEach(() => {
    mockSendMessage = vi.fn().mockResolvedValue(123);
    mockEditMessage = vi.fn().mockResolvedValue(true);
    mockSendTyping = vi.fn().mockResolvedValue(undefined);
    mockLog = vi.fn();

    streamingState = new StreamingMessageState(
      {
        sendMessage: mockSendMessage,
        editMessage: mockEditMessage,
        sendTyping: mockSendTyping,
        log: mockLog,
      },
      DEFAULT_STREAMING_CONFIG,
    );
  });

  describe('Thought Streaming', () => {
    it('should send message when reaching first send threshold (20 chars)', async () => {
      await streamingState.appendThought('This is a thinking process with more than twenty characters');

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(expect.stringContaining('Thinking...'), 'HTML');
    });

    it('should edit message when reaching edit threshold (50 chars) OR time interval (500ms)', async () => {
      await streamingState.appendThought('This is a thinking process with more than twenty characters');

      expect(mockSendMessage).toHaveBeenCalledTimes(1);

      // Wait for rate limit + time interval
      await new Promise((r) => setTimeout(r, 600));

      // Add more content (should trigger edit by time interval)
      await streamingState.appendThought(' and more content here');

      expect(mockEditMessage).toHaveBeenCalled();
    });

    it('should NOT send before reaching threshold', async () => {
      await streamingState.appendThought('short');

      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockEditMessage).not.toHaveBeenCalled();
    });
  });

  describe('Text Streaming', () => {
    it('should send text message at threshold and edit on accumulation', async () => {
      await streamingState.appendText('This is a response message with enough characters to trigger first send');

      expect(mockSendMessage).toHaveBeenCalledTimes(1);

      // Wait for time interval
      await new Promise((r) => setTimeout(r, 600));

      await streamingState.appendText(' and more content');

      expect(mockEditMessage).toHaveBeenCalled();
    });

    it('should convert markdown to HTML during streaming', async () => {
      await streamingState.appendText('Use **bold** text and `code` blocks with enough chars');

      const sentText = mockSendMessage.mock.calls[0][0];
      expect(sentText).toContain('<b>bold</b>');
      expect(sentText).toContain('<code>code</code>');
    });
  });

  describe('Mixed Streaming (Thought + Text)', () => {
    it('should finalize thought before sending text', async () => {
      await streamingState.appendThought('Let me think about this carefully with more than 20 chars');

      expect(mockSendMessage).toHaveBeenCalledTimes(1);

      await streamingState.appendText('Now I will respond with enough characters to send');

      // Should have sent thought first, then text
      expect(mockSendMessage.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Reset', () => {
    it('should clear all state on reset', async () => {
      await streamingState.appendThought('Thinking with more than twenty chars');
      await streamingState.appendText('Text with enough characters');

      streamingState.reset();

      // New messages should start fresh
      await streamingState.appendThought('New thought with more than twenty chars');

      expect(mockSendMessage.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
