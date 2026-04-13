/**
 * ACP Client implementation for Telegram Agent.
 */

import fs from 'fs';
import type * as acp from '@agentclientprotocol/sdk';
import { Injectable, ScopeEnum, Inject, ArtusInjectEnum } from '@artusx/core';
import type { ArtusApplication } from '@artusx/core';
import type { ACPClientOpts } from './types';
import { InjectEnum } from './constants';

@Injectable({
  id: InjectEnum.ACPClient,
  scope: ScopeEnum.SINGLETON,
})
export class ACPClient implements acp.Client {
  @Inject(ArtusInjectEnum.Application)
  private readonly app!: ArtusApplication;

  private opts: ACPClientOpts;
  private chunks: string[] = [];
  private currentMessageId: number = 0;
  private pendingText: string = '';

  get logger() {
    return this.app.logger;
  }

  constructor() {
    // Default options, will be set via init
    this.opts = {
      sendMessage: async () => 0,
      editMessage: async () => 0,
    };    
  }

  init(opts: ACPClientOpts): void {
    this.opts = opts;
  }

  reset(): void {
    this.chunks = [];
    this.pendingText = '';
    this.currentMessageId = 0;
  }

  async requestPermission(params: acp.RequestPermissionRequest): Promise<acp.RequestPermissionResponse> {
    const allowOpt = params.options.find(o => o.kind === 'allow_once' || o.kind === 'allow_always');
    const optionId = allowOpt?.optionId ?? params.options[0]?.optionId ?? 'allow';

    this.logger.info(`[permission] auto-allowed: ${params.toolCall?.title ?? 'unknown'}`);

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
    const text = this.pendingText;
    this.chunks = [];
    this.pendingText = '';
    return text;
  }

  private async handleMessageChunk(update: any): Promise<void> {
    if (update.content.type === 'text') {
      const chunk = update.content.text;
      this.chunks.push(chunk);
      const fullText = this.chunks.join('');

      // Simple streaming: send first message, then edit
      if (!this.currentMessageId) {
        this.currentMessageId = await this.opts.sendMessage(fullText);
        this.pendingText = fullText;
      } else {
        // Only edit if text changed significantly
        if (fullText.length - this.pendingText.length > 10 || fullText.endsWith('\n')) {
          await this.opts.editMessage(this.currentMessageId, fullText);
          this.pendingText = fullText;
        }
      }
    } else if (update.content.type === 'image') {
      const imagePath = update.content.uri || update.content.data || update.content.path;
      if (this.opts.onMediaUpload && imagePath) {
        await this.opts.onMediaUpload(imagePath, 'image');
      }
    } else if (update.content.type === 'audio') {
      const audioPath = update.content.uri || update.content.data || update.content.path;
      if (this.opts.onMediaUpload && audioPath) {
        await this.opts.onMediaUpload(audioPath, 'audio');
      }
    }
  }

  private async handleThoughtChunk(update: any): Promise<void> {
    if (update.content.type === 'text') {
      const thought = update.content.text;
      this.logger.info(`[thought] ${thought.substring(0, 100)}${thought.length > 100 ? '...' : ''}`);

      if (this.opts.showThoughts && this.opts.onThoughtFlush) {
        await this.opts.onThoughtFlush(thought);
      }
    }
  }

  private async handleToolCall(update: any): Promise<void> {
    const title = update.title;
    const status = update.status || 'pending';

    this.logger.info(`[tool] ${title} (${status})`);

    if (this.opts.sendTyping) {
      await this.opts.sendTyping();
    }
  }

  private async handleToolCallUpdate(update: any): Promise<void> {
    const title = update.title || 'Tool';
    const status = update.status || 'completed';

    this.logger.info(`[tool] ${title} → ${status}`);
  }

  private async handlePlan(update: any): Promise<void> {
    if (update.entries) {
      const items = update.entries
        .map((e: acp.PlanEntry, i: number) => `  ${i + 1}. [${e.status}] ${e.content}`)
        .join('\n');
      this.logger.info(`[plan]\n${items}`);
    }
  }
}
