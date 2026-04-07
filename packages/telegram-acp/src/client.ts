/**
 * ACP Client implementation for Telegram.
 */

import fs from "node:fs";
import type * as acp from "@agentclientprotocol/sdk";
import { escapeHtml, formatForTelegram } from "./bot.ts";

export interface TelegramAcpClientOpts {
  sendTyping?: () => Promise<void>;
  onThoughtFlush: (text: string) => Promise<void>;
  log: (msg: string) => void;
  showThoughts: boolean;

  // 流式消息支持
  sendMessage?: (text: string, parseMode?: 'HTML') => Promise<number>;
  editMessage?: (msgId: number, text: string, parseMode?: 'HTML') => Promise<number>;
}

export class TelegramAcpClient implements acp.Client {
  private chunks: string[] = [];
  private thoughtChunks: string[] = [];
  private opts: TelegramAcpClientOpts;
  private lastTypingAt = 0;
  private static readonly TYPING_INTERVAL_MS = 5_000;

  // 流式消息追踪
  private thoughtMsgId: number | null = null;
  private textMsgId: number | null = null;
  private toolMsgIds: Map<string, number> = new Map();

  // 累积计数器
  private thoughtCharCount: number = 0;
  private textCharCount: number = 0;

  // 常量
  private static readonly FIRST_SEND_THRESHOLD = 30;
  private static readonly EDIT_THRESHOLD = 80;

  constructor(opts: TelegramAcpClientOpts) {
    this.opts = opts;
  }

  updateCallbacks(callbacks: {
    sendTyping?: () => Promise<void>;
    onThoughtFlush: (text: string) => Promise<void>;
  }): void {
    this.opts = {
      ...this.opts,
      ...callbacks,
    };
  }

  /**
   * Reset streaming state for new prompt.
   */
  reset(): void {
    this.thoughtMsgId = null;
    this.textMsgId = null;
    this.toolMsgIds.clear();
    this.thoughtCharCount = 0;
    this.textCharCount = 0;
    this.thoughtChunks = [];
    this.chunks = [];
  }

  /**
   * Format thought message during thinking process.
   */
  private formatThought(text: string): string {
    const escaped = escapeHtml(text);
    return `<i>💭 Thinking...</i>\n${escaped}`;
  }

  /**
   * Format thought message after thinking is complete.
   */
  private formatThoughtFinal(text: string): string {
    const escaped = escapeHtml(text);
    return `<i>💭 Thought complete</i>\n${escaped}`;
  }

  /**
   * Format tool call message (without content).
   */
  private formatToolCall(update: { title: string; status?: string }): string {
    const status = update.status ?? '';
    const icon = status === 'running' ? '⏳' :
                 status === 'completed' ? '✅' : '❌';
    const title = escapeHtml(update.title);
    return `<b>${icon} 🔧 ${title}</b>`;
  }

  /**
   * Format tool call update message (with content).
   */
  private formatToolCallUpdate(update: { toolCallId: string; status?: string | null; title?: string | null; content?: any[] | null }): string {
    const status = update.status ?? '';
    const icon = status === 'running' ? '⏳' :
                 status === 'completed' ? '✅' : '❌';
    const title = escapeHtml(update.title ?? 'Tool');
    const content = update.content ? this.formatToolContent(update.content) : '';
    return `<b>${icon} 🔧 ${title}</b>\n${content}`;
  }

  /**
   * Format tool content (text and diff blocks).
   */
  private formatToolContent(content: any[]): string {
    const parts: string[] = [];
    for (const c of content) {
      if (c.type === 'text') {
        parts.push(escapeHtml(c.text));
      } else if (c.type === 'diff') {
        const diff = c;
        const lines = [`--- ${diff.path}`];
        if (diff.oldText) lines.push(...diff.oldText.split('\n').map((l: string) => `- ${l}`));
        if (diff.newText) lines.push(...diff.newText.split('\n').map((l: string) => `+ ${l}`));
        parts.push(`<pre><code>${escapeHtml(lines.join('\n'))}</code></pre>`);
      }
    }
    return parts.join('\n');
  }

  async requestPermission(
    params: acp.RequestPermissionRequest
  ): Promise<acp.RequestPermissionResponse> {
    const allowOpt = params.options.find(
      (o) => o.kind === "allow_once" || o.kind === "allow_always"
    );
    const optionId = allowOpt?.optionId ?? params.options[0]?.optionId ?? "allow";

    this.opts.log(`[permission] auto-allowed: ${params.toolCall?.title ?? "unknown"}`);

    return {
      outcome: {
        outcome: "selected",
        optionId,
      },
    };
  }

  async sessionUpdate(params: acp.SessionNotification): Promise<void> {
    const update = params.update;

    switch (update.sessionUpdate) {
      case "agent_message_chunk":
        // 先完成 thought
        await this.finalizeThought();

        if (update.content.type === "text") {
          this.chunks.push(update.content.text);
          this.textCharCount += update.content.text.length;

          // 首次发送
          if (!this.textMsgId && this.textCharCount >= TelegramAcpClient.FIRST_SEND_THRESHOLD) {
            const text = formatForTelegram(this.chunks.join(""));
            this.textMsgId = await this.opts.sendMessage?.(text, "HTML") ?? null;
          }
          // 后续编辑
          else if (this.textMsgId && this.textCharCount >= TelegramAcpClient.EDIT_THRESHOLD) {
            const text = formatForTelegram(this.chunks.join(""));
            await this.opts.editMessage?.(this.textMsgId, text, "HTML");
            this.textCharCount = 0;
          }
        }
        await this.maybeSendTyping();
        break;

      case "tool_call":
        await this.finalizeThought();

        const toolKey = update.toolCallId;
        const formatted = this.formatToolCall(update);

        if (!this.toolMsgIds.has(toolKey)) {
          const msgId = await this.opts.sendMessage?.(formatted, "HTML") ?? 0;
          this.toolMsgIds.set(toolKey, msgId);
        }
        this.opts.log(`[tool] ${update.title} (${update.status})`);
        await this.maybeSendTyping();
        break;

      case "agent_thought_chunk":
        if (update.content.type === "text") {
          const text = update.content.text;
          this.thoughtChunks.push(text);
          this.thoughtCharCount += text.length;

          // 首次发送（快速展示）
          if (!this.thoughtMsgId && this.thoughtCharCount >= TelegramAcpClient.FIRST_SEND_THRESHOLD) {
            const formatted = this.formatThought(this.thoughtChunks.join(""));
            this.thoughtMsgId = await this.opts.sendMessage?.(formatted, "HTML") ?? null;
          }
          // 后续编辑（批量阈值）
          else if (this.thoughtMsgId && this.thoughtCharCount >= TelegramAcpClient.EDIT_THRESHOLD) {
            const formatted = this.formatThought(this.thoughtChunks.join(""));
            await this.opts.editMessage?.(this.thoughtMsgId, formatted, "HTML");
            this.thoughtCharCount = 0;
          }
        }
        await this.maybeSendTyping();
        break;

      case "tool_call_update":
        const msgId = this.toolMsgIds.get(update.toolCallId);
        if (msgId && update.status) {
          const formatted = this.formatToolCallUpdate(update);
          await this.opts.editMessage?.(msgId, formatted, "HTML");
        }
        if (update.status) {
          this.opts.log(`[tool] ${update.toolCallId} → ${update.status}`);
        }
        break;

      case "plan":
        if (update.entries) {
          const items = update.entries
            .map((e: acp.PlanEntry, i: number) => `  ${i + 1}. [${e.status}] ${e.content}`)
            .join("\n");
          this.opts.log(`[plan]\n${items}`);
        }
        break;
    }
  }

  async readTextFile(params: acp.ReadTextFileRequest): Promise<acp.ReadTextFileResponse> {
    try {
      const content = await fs.promises.readFile(params.path, "utf-8");
      return { content };
    } catch (err) {
      throw new Error(`Failed to read file ${params.path}: ${String(err)}`);
    }
  }

  async writeTextFile(params: acp.WriteTextFileRequest): Promise<acp.WriteTextFileResponse> {
    try {
      await fs.promises.writeFile(params.path, params.content, "utf-8");
      return {};
    } catch (err) {
      throw new Error(`Failed to write file ${params.path}: ${String(err)}`);
    }
  }

  async flush(): Promise<string> {
    await this.finalizeAll();
    const text = this.chunks.join("");
    this.chunks = [];
    return text;
  }

  private async finalizeThought(): Promise<void> {
    if (this.thoughtChunks.length > 0 && this.thoughtMsgId) {
      const formatted = this.formatThoughtFinal(this.thoughtChunks.join(""));
      await this.opts.editMessage?.(this.thoughtMsgId, formatted, "HTML");
    }
    this.thoughtChunks = [];
    this.thoughtCharCount = 0;
  }

  private async finalizeText(): Promise<void> {
    if (this.chunks.length > 0 && this.textMsgId) {
      const text = formatForTelegram(this.chunks.join(""));
      await this.opts.editMessage?.(this.textMsgId, text, "HTML");
    }
    this.chunks = [];
    this.textCharCount = 0;
  }

  private async finalizeAll(): Promise<void> {
    await this.finalizeThought();
    await this.finalizeText();
  }

  private async maybeFlushThoughts(): Promise<void> {
    if (this.thoughtChunks.length === 0) return;
    const thoughtText = this.thoughtChunks.join("");
    this.thoughtChunks = [];
    if (thoughtText.trim()) {
      try {
        await this.opts.onThoughtFlush(`💭 [Thinking]\n${thoughtText}`);
      } catch {
        // best effort
      }
    }
  }

  private async maybeSendTyping(): Promise<void> {
    if (!this.opts.sendTyping) return;
    const now = Date.now();
    if (now - this.lastTypingAt < TelegramAcpClient.TYPING_INTERVAL_MS) return;
    this.lastTypingAt = now;
    try {
      await this.opts.sendTyping();
    } catch {
      // typing is best-effort
    }
  }
}
