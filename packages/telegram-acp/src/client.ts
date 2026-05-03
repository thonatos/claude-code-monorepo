/**
 * ACP Client implementation for Telegram.
 */

import fs from 'node:fs';
import type * as acp from '@agentclientprotocol/sdk';
import { StreamingMessageState, DEFAULT_STREAMING_CONFIG } from './streaming/index.js';
import { truncate, shouldLog, type LogLevel } from './utils/logger.ts';
import type { ReactionPhase } from './reaction/types.ts';
import { MarkdownMediaParser } from './media/markdown-parser.ts';

export interface TelegramAcpClientOpts {
  sendTyping?: () => Promise<void>;
  onThoughtFlush: (text: string) => Promise<void>;
  log: (msg: string) => void;
  showThoughts: boolean;
  sendMessage: (text: string, parseMode?: 'HTML') => Promise<number>;
  editMessage: (msgId: number, text: string, parseMode?: 'HTML') => Promise<number>;
  logLevel?: LogLevel;
  onMediaUpload?: (path: string, type: 'image' | 'audio') => Promise<void>;
  onReactionChange?: (phase: ReactionPhase) => Promise<void>;
  mediaParser?: MarkdownMediaParser;
}

export class TelegramAcpClient implements acp.Client {
  private opts: TelegramAcpClientOpts;
  private streamingState: StreamingMessageState;
  private chunks: string[] = [];
  private logLevel: LogLevel;
  private mediaParser?: MarkdownMediaParser;

  constructor(opts: TelegramAcpClientOpts) {
    this.opts = opts;
    this.logLevel = opts.logLevel || 'info';
    this.mediaParser = opts.mediaParser;

    const sendTyping = opts.sendTyping ? opts.sendTyping : async () => {};

    this.streamingState = new StreamingMessageState(
      {
        sendMessage: opts.sendMessage,
        editMessage: opts.editMessage,
        sendTyping: sendTyping,
        log: opts.log,
      },
      DEFAULT_STREAMING_CONFIG,
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

  updateReactionCallback(callback: (phase: ReactionPhase) => Promise<void>): void {
    this.opts.onReactionChange = callback;
  }

  reset(): void {
    this.streamingState.reset();
    this.chunks = [];
  }

  async requestPermission(params: acp.RequestPermissionRequest): Promise<acp.RequestPermissionResponse> {
    const allowOpt = params.options.find((o) => o.kind === 'allow_once' || o.kind === 'allow_always');
    const optionId = allowOpt?.optionId ?? params.options[0]?.optionId ?? 'allow';

    this.opts.log(`[permission] auto-allowed: ${params.toolCall?.title ?? 'unknown'}`);

    return {
      outcome: {
        outcome: 'selected',
        optionId,
      },
    };
  }

  async sessionUpdate(params: acp.SessionNotification): Promise<void> {
    const update = params.update;

    switch (update.sessionUpdate) {
      case 'agent_message_chunk':
        await this.handleMessageChunk(update);
        break;

      case 'tool_call':
        await this.handleToolCall(update);
        break;

      case 'agent_thought_chunk':
        await this.handleThoughtChunk(update);
        break;

      case 'tool_call_update':
        await this.handleToolCallUpdate(update);
        break;

      case 'plan':
        await this.handlePlan(update);
        break;
    }
  }

  async readTextFile(params: acp.ReadTextFileRequest): Promise<acp.ReadTextFileResponse> {
    try {
      const content = await fs.promises.readFile(params.path, 'utf-8');
      return { content };
    } catch (err) {
      throw new Error(`Failed to read file ${params.path}: ${String(err)}`);
    }
  }

  async writeTextFile(params: acp.WriteTextFileRequest): Promise<acp.WriteTextFileResponse> {
    try {
      await fs.promises.writeFile(params.path, params.content, 'utf-8');
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
    if (update.content.type === 'text') {
      const chunk = update.content.text;
      this.chunks.push(chunk);

      // Parse media BEFORE markdown-to-HTML conversion
      if (this.opts.onMediaUpload && this.mediaParser) {
        const fullText = this.chunks.join('');
        const result = this.mediaParser.parse(fullText);

        // Send detected media
        for (const media of result.media) {
          try {
            // Validate file exists
            if (!fs.existsSync(media.path)) {
              this.opts.log(`[media] File not found: ${media.path}`);
              continue;
            }

            // Send media via callback
            await this.opts.onMediaUpload(media.path, media.type);
            this.opts.log(`[media] Sent ${media.type}: ${media.path}`);
          } catch (err) {
            // Silent fail - don't block text flow
            this.opts.log(`[media] Failed to send: ${String(err)}`);
          }
        }

        // Convert media syntax to code format
        if (result.media.length > 0) {
          let modifiedText = fullText;
          for (const media of result.media) {
            // ![alt](path) → `![alt](path)`
            modifiedText = modifiedText.replace(media.syntax, `\`${media.syntax}\``);
          }
          // Update chunks with modified text
          this.chunks = [modifiedText];

          // Reset streaming state and append modified text
          // Note: This works for single-media scenarios; multi-chunk streaming
          // may need more sophisticated handling
          this.streamingState.reset();
          await this.streamingState.appendText(modifiedText);
          return; // Skip the regular appendText below
        }
      }

      // Continue with text streaming (will be converted to HTML later)
      await this.streamingState.appendText(chunk);
    } else if (update.content.type === 'image') {
      // Agent generated image
      const imagePath = update.content.uri || update.content.data || update.content.path;
      if (this.opts.onMediaUpload && imagePath) {
        await this.opts.onMediaUpload(imagePath, 'image');
      }
    } else if (update.content.type === 'audio') {
      // Agent generated audio
      const audioPath = update.content.uri || update.content.data || update.content.path;
      if (this.opts.onMediaUpload && audioPath) {
        await this.opts.onMediaUpload(audioPath, 'audio');
      }
    }
  }

  private async handleThoughtChunk(update: any): Promise<void> {
    if (update.content.type === 'text') {
      const thought = update.content.text;

      // Always log thoughts to CLI (default info level)
      if (shouldLog('info', this.logLevel)) {
        this.opts.log(`[thought] ${truncate(thought, 100)}`);
      }

      // Trigger reaction
      if (this.opts.onReactionChange) {
        await this.opts.onReactionChange('thought');
      }

      // Telegram thoughts only if showThoughts enabled
      if (this.opts.showThoughts) {
        await this.streamingState.appendThought(thought);
      }
    }
  }

  private async handleToolCall(update: any): Promise<void> {
    const title = update.title;
    const status = update.status || 'running';
    const params = this.extractToolParams(update);

    // CLI logging only
    if (shouldLog('info', this.logLevel)) {
      this.opts.log(`[tool] ${title} (${status})`);
    }

    if (shouldLog('debug', this.logLevel) && params) {
      this.opts.log(`  params: ${JSON.stringify(params, null, 2)}`);
    }

    // Trigger reaction
    if (this.opts.onReactionChange) {
      await this.opts.onReactionChange('tool');
    }

    // Send typing action to show activity
    if (this.opts.sendTyping) {
      await this.opts.sendTyping();
    }
  }

  private async handleToolCallUpdate(update: any): Promise<void> {
    const title = update.title || 'Tool';
    const status = update.status || 'completed';
    const result = this.extractToolResult(update.content);

    // CLI logging only
    if (shouldLog('info', this.logLevel)) {
      this.opts.log(`[tool] ${title} → ${status}`);
    }

    if (shouldLog('info', this.logLevel) && result) {
      const preview = shouldLog('debug', this.logLevel) ? result : truncate(result, 200);
      this.opts.log(`  result: ${preview}`);
    }
  }

  private async handlePlan(update: any): Promise<void> {
    if (update.entries) {
      const items = update.entries
        .map((e: acp.PlanEntry, i: number) => `  ${i + 1}. [${e.status}] ${e.content}`)
        .join('\n');
      this.opts.log(`[plan]\n${items}`);
    }
  }

  private extractToolParams(update: any): Record<string, any> | undefined {
    // Extract relevant params based on tool type
    if (update.input) {
      // Show path for file operations, command for terminal
      if (update.title === 'ReadFile' || update.title === 'WriteFile') {
        return { path: update.input.path };
      }
      if (update.title === 'Terminal') {
        return { command: update.input.command };
      }
      return update.input;
    }
    return undefined;
  }

  private extractToolResult(content: any[] | null): string | undefined {
    if (!content) return undefined;

    for (const c of content) {
      if (c.type === 'text') {
        return c.text;
      }
    }

    return undefined;
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
