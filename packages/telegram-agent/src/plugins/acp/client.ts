/**
 * ACP Client - Fixed: don't clear timeout on reset.
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

  private opts!: ACPClientOpts;
  private chunks: string[] = [];
  private currentMessageId: number | null = null;
  private pendingText: string = '';
  private lastEditTime: number = 0;
  private editCount: number = 0;
  private isMessageSent: boolean = false;
  private sessionId: string | null = null;
  private userMessageId: number | null = null;
  private minEditInterval: number = 300;
  private reactionRemoved: boolean = false;
  private reactionTimeout: NodeJS.Timeout | null = null;
  private readonly REACTION_TIMEOUT_MS = 5000;

  get logger() {
    return this.app.logger;
  }

  init(opts: ACPClientOpts): void {
    this.opts = opts;
    this.logger.info(`[acp] Client initialized`);
  }

  setUserMessageId(messageId: number): void {
    this.logger.info(`[acp] setUserMessageId(${messageId})`);
    this.userMessageId = messageId;
    this.reactionRemoved = false;

    // Set timeout - DON'T clear previous timeout here
    this.logger.info(`[reaction] ⏰ Setting timeout (5000ms) for message ${messageId}`);

    this.reactionTimeout = setTimeout(async () => {
      this.logger.warn(`[reaction] ⏱️ TIMEOUT triggered!`);

      if (!this.reactionRemoved && this.userMessageId && this.opts.removeReaction) {
        this.logger.info(`[reaction] 🔄 Removing via timeout...`);
        try {
          await this.opts.removeReaction(this.userMessageId);
          this.reactionRemoved = true;
          this.logger.info(`[reaction] ✅ Removed (timeout)`);
          this.userMessageId = null;
          this.reactionTimeout = null;
        } catch (err) {
          this.logger.error(`[reaction] ❌ Timeout removal failed: ${String(err)}`);
        }
      }
    }, this.REACTION_TIMEOUT_MS);
  }

  reset(): void {
    this.logger.info(`[acp] reset() - keeping reaction timeout`);

    // DON'T clear timeout here! Let it run to completion
    // Just reset message state

    this.chunks = [];
    this.pendingText = '';
    this.currentMessageId = null;
    this.lastEditTime = 0;
    this.editCount = 0;
    this.isMessageSent = false;
  }

  async requestPermission(params: acp.RequestPermissionRequest): Promise<acp.RequestPermissionResponse> {
    const allowOpt = params.options.find((o) => o.kind === 'allow_once' || o.kind === 'allow_always');
    const optionId = allowOpt?.optionId ?? params.options[0]?.optionId ?? 'allow';

    return {
      outcome: {
        outcome: 'selected',
        optionId,
      },
    };
  }

  async sessionUpdate(params: acp.SessionNotification): Promise<void> {
    const update = params.update;
    const sessionId = params.sessionId;

    if (this.sessionId && this.sessionId !== sessionId) {
      this.logger.info(`[acp] Session changed`);
      await this.removeReactionIfNeeded();

      // Clear timeout on session change
      if (this.reactionTimeout) {
        clearTimeout(this.reactionTimeout);
        this.reactionTimeout = null;
      }

      this.chunks = [];
      this.pendingText = '';
      this.currentMessageId = null;
      this.lastEditTime = 0;
      this.editCount = 0;
      this.isMessageSent = false;
      this.userMessageId = null;
      this.reactionRemoved = false;
    }
    this.sessionId = sessionId;

    try {
      switch (update.sessionUpdate) {
        case 'agent_message_chunk':
          await this.handleMessageChunk(update);
          break;
        case 'agent_thought_chunk':
          await this.handleThoughtChunk(update);
          break;
        case 'tool_call':
          await this.handleToolCall(update);
          break;
        case 'tool_call_update':
          await this.handleToolCallUpdate(update);
          break;
        case 'plan':
          await this.handlePlan(update);
          break;
        case 'usage_update':
          this.logger.info(`[usage] 💰 Completed`);
          await this.removeReactionIfNeeded();
          break;
        default:
          this.logger.debug(`[acp] ${update.sessionUpdate}`);
      }
    } catch (err) {
      this.logger.error(`[acp] Error: ${String(err)}`);
    }
  }

  async readTextFile(params: acp.ReadTextFileRequest): Promise<acp.ReadTextFileResponse> {
    try {
      const content = await fs.promises.readFile(params.path, 'utf-8');
      return { content };
    } catch (err) {
      throw new Error(`Failed to read: ${String(err)}`);
    }
  }

  async writeTextFile(params: acp.WriteTextFileRequest): Promise<acp.WriteTextFileResponse> {
    try {
      await fs.promises.writeFile(params.path, params.content, 'utf-8');
      return {};
    } catch (err) {
      throw new Error(`Failed to write: ${String(err)}`);
    }
  }

  async flush(): Promise<string> {
    const text = this.pendingText;
    this.chunks = [];
    this.pendingText = '';

    // Call onMessageFlush callback if provided
    if (this.opts.onMessageFlush && text) {
      await this.opts.onMessageFlush(text);
    }

    return text;
  }

  private async removeReactionIfNeeded(): Promise<void> {
    // Clear timeout first
    if (this.reactionTimeout) {
      clearTimeout(this.reactionTimeout);
      this.reactionTimeout = null;
    }

    if (this.userMessageId && !this.reactionRemoved && this.opts.removeReaction) {
      this.logger.info(`[reaction] 🔄 Removing...`);
      try {
        await this.opts.removeReaction(this.userMessageId);
        this.logger.info(`[reaction] ✅ Removed`);
        this.reactionRemoved = true;
        this.userMessageId = null;
      } catch (err) {
        this.logger.error(`[reaction] ❌ Failed: ${String(err)}`);
      }
    }
  }

  private async handleMessageChunk(update: any): Promise<void> {
    if (update.content.type === 'text') {
      const chunk = update.content.text;

      if (!chunk || chunk.trim().length === 0) return;

      this.chunks.push(chunk);
      const fullText = this.chunks.join('');

      if (!fullText || fullText.trim().length === 0) return;

      if (!this.isMessageSent) {
        this.isMessageSent = true;
        this.currentMessageId = await this.opts.sendMessage(fullText);
        this.pendingText = fullText;
        this.lastEditTime = Date.now();
        this.logger.info(`[stream] 📤 Sent (ID: ${this.currentMessageId})`);
      } else if (this.currentMessageId) {
        const now = Date.now();
        const timeSinceLastEdit = now - this.lastEditTime;
        const textChanged = fullText.length - this.pendingText.length;

        if (timeSinceLastEdit >= this.minEditInterval || textChanged > 50 || fullText.endsWith('\n\n')) {
          try {
            await this.opts.editMessage(this.currentMessageId, fullText);
            this.pendingText = fullText;
            this.lastEditTime = now;
            this.editCount++;

            if (this.editCount % 10 === 0) {
              this.logger.info(`[stream] ✏️ #${this.editCount}`);
            }
          } catch (err) {
            this.logger.warn(`[stream] ⚠️ ${String(err)}`);
            if (String(err).includes('Too Many Requests')) {
              this.minEditInterval = Math.min(this.minEditInterval * 1.5, 1000);
            }
          }
        }
      }
    }
  }

  private async handleThoughtChunk(update: any): Promise<void> {
    if (update.content.type === 'text') {
      this.logger.info(`[thought] 💭 ${update.content.text}`);
    }
  }

  private async handleToolCall(update: any): Promise<void> {
    this.logger.info(`[tool] 🔧 ${update.title} (${update.status || 'pending'})`);
    if (this.opts.sendTyping) await this.opts.sendTyping();
  }

  private async handleToolCallUpdate(update: any): Promise<void> {
    this.logger.info(`[tool] ✅ ${update.title || 'Tool'} → ${update.status || 'completed'}`);
  }

  private async handlePlan(update: any): Promise<void> {
    if (update.entries) {
      const items = update.entries
        .map((e: acp.PlanEntry, i: number) => `${i + 1}. [${e.status}] ${e.content}`)
        .join('\n');
      this.logger.info(`[plan] 📋\n${items}`);
    }
  }
}
