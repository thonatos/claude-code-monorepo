import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramAcpClient } from '../src/client.ts';

describe('TelegramAcpClient streaming', () => {
  let mockSendMessage: ReturnType<typeof vi.fn>;
  let mockEditMessage: ReturnType<typeof vi.fn>;
  let client: TelegramAcpClient;

  beforeEach(() => {
    mockSendMessage = vi.fn().mockResolvedValue(123);
    mockEditMessage = vi.fn().mockResolvedValue(123);
    client = new TelegramAcpClient({
      sendMessage: mockSendMessage,
      editMessage: mockEditMessage,
      onThoughtFlush: vi.fn(),
      log: vi.fn(),
      showThoughts: true,
    });
  });

  describe('threshold triggers', () => {
    it('should send message when thought reaches FIRST_SEND_THRESHOLD', async () => {
      // FIRST_SEND_THRESHOLD = 30
      await client.sessionUpdate({
        update: {
          sessionUpdate: 'agent_thought_chunk',
          content: { type: 'text', text: 'This is a thinking process that has more than thirty characters' },
        },
      });

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.stringContaining('Thinking'),
        'HTML'
      );
    });

    it('should edit message when thought reaches EDIT_THRESHOLD with enough delay', async () => {
      // 首次发送
      await client.sessionUpdate({
        update: {
          sessionUpdate: 'agent_thought_chunk',
          content: { type: 'text', text: 'This is a thinking process that has more than thirty characters' },
        },
      });

      // Wait for rate limit delay (> 100ms)
      await new Promise(r => setTimeout(r, 150));

      // 第二次 chunk 超过 EDIT_THRESHOLD (80)
      await client.sessionUpdate({
        update: {
          sessionUpdate: 'agent_thought_chunk',
          content: { type: 'text', text: ' and then continues with even more thinking content to reach the edit threshold limit and more characters here' },
        },
      });

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockEditMessage).toHaveBeenCalled();
    });

    it('should not edit before reaching threshold', async () => {
      await client.sessionUpdate({
        update: {
          sessionUpdate: 'agent_thought_chunk',
          content: { type: 'text', text: 'short' }, // 5 chars, below threshold
        },
      });

      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockEditMessage).not.toHaveBeenCalled();
    });
  });

  describe('formatting', () => {
    it('should format thought with italic prefix', async () => {
      await client.sessionUpdate({
        update: {
          sessionUpdate: 'agent_thought_chunk',
          content: { type: 'text', text: 'This is a thinking process that has more than thirty characters' },
        },
      });

      const sentText = mockSendMessage.mock.calls[0][0];
      expect(sentText).toMatch(/^<i>💭 Thinking\.\.\.<\/i>\n/);
      expect(sentText).toContain('This is a thinking');
    });

    it('should escape HTML in thought content', async () => {
      await client.sessionUpdate({
        update: {
          sessionUpdate: 'agent_thought_chunk',
          content: { type: 'text', text: 'This has <script> tags and more than thirty characters total' },
        },
      });

      const sentText = mockSendMessage.mock.calls[0][0];
      expect(sentText).toContain('&lt;script&gt;');
      expect(sentText).not.toContain('<script>');
    });

    it('should format tool call with bold and icon', async () => {
      await client.sessionUpdate({
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tool-123',
          title: 'Read File',
          status: 'running',
        },
      });

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      const sentText = mockSendMessage.mock.calls[0][0];
      expect(sentText).toMatch(/⏳.*🔧.*Read File/);
      expect(sentText).toContain('<b>');
    });
  });

  describe('reset', () => {
    it('should clear all streaming state on reset', async () => {
      // 触发一些流式消息
      await client.sessionUpdate({
        update: {
          sessionUpdate: 'agent_thought_chunk',
          content: { type: 'text', text: 'This is a thinking process that has more than thirty characters' },
        },
      });

      await client.sessionUpdate({
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'This is a response message with enough characters to trigger first send' },
        },
      });

      await client.sessionUpdate({
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tool-1',
          title: 'Test Tool',
          status: 'running',
        },
      });

      // 重置
      client.reset();

      // 新的消息应该重新发送（不编辑旧消息）
      await client.sessionUpdate({
        update: {
          sessionUpdate: 'agent_thought_chunk',
          content: { type: 'text', text: 'New thought with more than thirty characters here' },
        },
      });

      // 应该有新的 sendMessage
      const sendCount = mockSendMessage.mock.calls.length;
      expect(sendCount).toBeGreaterThanOrEqual(4); // thought + message + tool + new thought
    });
  });
});
