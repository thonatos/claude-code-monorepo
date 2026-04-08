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
    
    streamingState = new StreamingMessageState({
      sendMessage: mockSendMessage,
      editMessage: mockEditMessage,
      sendTyping: mockSendTyping,
      log: mockLog,
    }, DEFAULT_STREAMING_CONFIG);
  });

  describe('Thought Streaming', () => {
    it('should send message when reaching first send threshold (20 chars)', async () => {
      await streamingState.appendThought('This is a thinking process with more than twenty characters');
      
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.stringContaining('💭 Thinking...'),
        'HTML'
      );
    });

    it('should edit message when reaching edit threshold (50 chars) OR time interval (500ms)', async () => {
      await streamingState.appendThought('This is a thinking process with more than twenty characters');
      
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      
      // Wait for rate limit + time interval
      await new Promise(r => setTimeout(r, 600));
      
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
      await new Promise(r => setTimeout(r, 600));
      
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

  describe('Tool Call Streaming', () => {
    it('should immediately send tool call and update on completion', async () => {
      await streamingState.updateToolCall('tool-1', () => '<b>⏳ 🔧 Read File</b>');

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      
      await streamingState.editToolCall('tool-1', () => '<b>✅ 🔧 Read File</b>\nFile content loaded');

      expect(mockEditMessage).toHaveBeenCalledWith(
        123,
        '<b>✅ 🔧 Read File</b>\nFile content loaded',
        'HTML'
      );
    });
  });

  describe('Mixed Streaming (Thought + Text)', () => {
    it('should finalize thought before sending text', async () => {
      await streamingState.appendThought('Let me think about this carefully with more than 20 chars');
      
      expect(mockSendMessage).toHaveBeenCalledTimes(1);

      await streamingState.appendText('Here is the answer with enough characters to trigger send');
      
      expect(mockSendMessage).toHaveBeenCalledTimes(2);
      expect(mockEditMessage).toHaveBeenCalled();
    });
  });

  describe('Finalization', () => {
    it('should finalize thought with complete message', async () => {
      await streamingState.appendThought('This is a thinking process with more than twenty chars');
      
      const finalText = await streamingState.finalizeThought();
      
      expect(finalText).toContain('This is a thinking');
      expect(mockEditMessage).toHaveBeenCalled();
    });
  });

  describe('Reset', () => {
    it('should clear all state on reset', async () => {
      await streamingState.appendThought('Thinking with more than twenty characters here');
      await streamingState.appendText('Text message with enough characters to trigger first send');
      
      streamingState.reset();
      
      await streamingState.appendThought('New thought with more than 20 chars');
      
      expect(mockSendMessage.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Real-world Simulation', () => {
    it('should simulate streaming output like real ACP agent', async () => {
      const thoughtChunks = [
        'Let me ',
        'think about ',
        'this problem ',  // 33 chars -> first send
      ];

      // Stream with delays
      for (const chunk of thoughtChunks) {
        await streamingState.appendThought(chunk);
        await new Promise(r => setTimeout(r, 150));
      }

      expect(mockSendMessage).toHaveBeenCalledTimes(1);

      // Wait for time interval (500ms)
      await new Promise(r => setTimeout(r, 600));

      // More chunks (should trigger edit by time interval)
      const moreChunks = [
        'carefully ',
        'and analyze ',
        'all possibilities',
      ];

      for (const chunk of moreChunks) {
        await streamingState.appendThought(chunk);
        await new Promise(r => setTimeout(r, 150));
      }

      expect(mockEditMessage.mock.calls.length).toBeGreaterThan(0);

      // Verify text contains initial chunks
      const lastEdit = mockEditMessage.mock.calls[mockEditMessage.mock.calls.length - 1];
      expect(lastEdit[1]).toContain('Let me think about');
      // Should contain at least "carefully" (might not have all chunks due to timing)
      expect(lastEdit[1]).toContain('carefully');
    });
  });
});
