/**
 * ACP Client implementation for Telegram.
 */

import fs from "node:fs";
import type * as acp from "@agentclientprotocol/sdk";
import { StreamingMessageState, DEFAULT_STREAMING_CONFIG } from "./streaming/index.js";

export interface TelegramAcpClientOpts {
  sendTyping?: () => Promise<void>;
  onThoughtFlush: (text: string) => Promise<void>;
  log: (msg: string) => void;
  showThoughts: boolean;
  sendMessage: (text: string, parseMode?: 'HTML') => Promise<number>;
  editMessage: (msgId: number, text: string, parseMode?: 'HTML') => Promise<number>;
}

export class TelegramAcpClient implements acp.Client {
  private opts: TelegramAcpClientOpts;
  private streamingState: StreamingMessageState;
  private chunks: string[] = [];

  constructor(opts: TelegramAcpClientOpts) {
    this.opts = opts;
    
    const sendTyping = opts.sendTyping ? opts.sendTyping : async () => { };
    
    this.streamingState = new StreamingMessageState(
      {
        sendMessage: opts.sendMessage,
        editMessage: opts.editMessage,
        sendTyping: sendTyping,
        log: opts.log,
      },
      DEFAULT_STREAMING_CONFIG
    );
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

  reset(): void {
    this.streamingState.reset();
    this.chunks = [];
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
        await this.handleMessageChunk(update);
        break;

      case "tool_call":
        await this.handleToolCall(update);
        break;

      case "agent_thought_chunk":
        await this.handleThoughtChunk(update);
        break;

      case "tool_call_update":
        await this.handleToolCallUpdate(update);
        break;

      case "plan":
        await this.handlePlan(update);
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
    const text = await this.streamingState.finalizeAll();
    this.chunks = [];
    return text;
  }

  private async handleMessageChunk(update: any): Promise<void> {
    if (update.content.type === "text") {
      const chunk = update.content.text;
      this.chunks.push(chunk);
      await this.streamingState.appendText(chunk);
    }
  }

  private async handleThoughtChunk(update: any): Promise<void> {
    if (!this.opts.showThoughts) return;
    
    if (update.content.type === "text") {
      await this.streamingState.appendThought(update.content.text);
    }
  }

  private async handleToolCall(update: any): Promise<void> {
    const toolKey = update.toolCallId;
    const formatted = this.formatToolCall(update);
    await this.streamingState.updateToolCall(toolKey, () => formatted);
    this.opts.log(`[tool] ${update.title} (${update.status})`);
  }

  private async handleToolCallUpdate(update: any): Promise<void> {
    const toolKey = update.toolCallId;
    const formatted = this.formatToolCallUpdate(update);
    await this.streamingState.editToolCall(toolKey, () => formatted);
    
    if (update.status) {
      this.opts.log(`[tool] ${toolKey} → ${update.status}`);
    }
  }

  private async handlePlan(update: any): Promise<void> {
    if (update.entries) {
      const items = update.entries
        .map((e: acp.PlanEntry, i: number) => `  ${i + 1}. [${e.status}] ${e.content}`)
        .join("\n");
      this.opts.log(`[plan]\n${items}`);
    }
  }

  private formatToolCall(update: { title: string; status?: string }): string {
    const status = update.status ?? '';
    const icon = status === 'running' ? '⏳' :
                 status === 'completed' ? '✅' : '❌';
    const title = this.escapeHtml(update.title);
    return `<b>${icon} 🔧 ${title}</b>`;
  }

  private formatToolCallUpdate(update: { 
    toolCallId: string; 
    status?: string | null; 
    title?: string | null; 
    content?: any[] | null 
  }): string {
    const status = update.status ?? '';
    const icon = status === 'running' ? '⏳' :
                 status === 'completed' ? '✅' : '❌';
    const title = this.escapeHtml(update.title ?? 'Tool');
    const content = update.content ? this.formatToolContent(update.content) : '';
    return `<b>${icon} 🔧 ${title}</b>\n${content}`;
  }

  private formatToolContent(content: any[]): string {
    const parts: string[] = [];
    for (const c of content) {
      if (c.type === 'text') {
        parts.push(this.escapeHtml(c.text));
      } else if (c.type === 'diff') {
        const diff = c;
        const lines = [`--- ${diff.path}`];
        if (diff.oldText) lines.push(...diff.oldText.split('\n').map((l: string) => `- ${l}`));
        if (diff.newText) lines.push(...diff.newText.split('\n').map((l: string) => `+ ${l}`));
        parts.push(`<pre><code>${this.escapeHtml(lines.join('\n'))}</code></pre>`);
      }
    }
    return parts.join('\n');
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
