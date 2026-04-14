import { Injectable, Inject, ArtusInjectEnum } from '@artusx/core';
import { spawn, type ChildProcess } from 'child_process';
import { Writable, Readable } from 'stream';
import * as acp from '@agentclientprotocol/sdk';
import { BotService } from '../module-bot/bot.service';
import { MediaHandler } from '../module-bot/media.handler';
import { ACPClient, InjectEnum as ACPInjectEnum } from '../plugins/acp';
import type { WebhookRequest } from '../types';

@Injectable()
export class BridgeService {
  @Inject(ArtusInjectEnum.Application)
  app!: any;

  @Inject(BotService)
  botService!: BotService;

  @Inject(MediaHandler)
  mediaHandler!: MediaHandler;

  @Inject(ACPInjectEnum.ACPClient)
  acpClient!: ACPClient;

  private agentProcess: ChildProcess | null = null;
  private connection: acp.ClientSideConnection | null = null;
  private currentSessionId: string | null = null;
  private isInitialized = false;

async ensureConnection(userId: string): Promise<void> {
  if (this.isInitialized) return;

  const config = this.app?.config?.agent;
  console.log('[bridge] Initializing connection with config:', config);
   if (!config) {
    throw new Error('ACP agent config not found');
  }

  // Initialize client callbacks
  this.acpClient.init({
    sendMessage: async (text: string) => {
      return await this.botService.sendMessage(userId, text);
    },
    editMessage: async (msgId: number, text: string) => {
      await this.botService.editMessage(userId, msgId, text);
    },
    removeReaction: async (msgId: number) => {
      await this.botService.removeReaction(userId, msgId);
    },
    sendTyping: async () => {
      await this.botService.sendTyping(userId);
    },
    onMediaUpload: async (path: string, type: 'image' | 'audio') => {
      if (type === 'image') {
        await this.mediaHandler.uploadPhoto(userId, path);
      } else {
        await this.mediaHandler.uploadAudio(userId, path);
      }
    },
    showThoughts: config.showThoughts,
   });

   // Spawn agent process
    this.agentProcess = spawn(config.command, config.args, {
      cwd: config.cwd || process.cwd(),
     env: {
       ...process.env,
        ...config.env,
     },
     stdio: ['pipe', 'pipe', 'inherit'],
   });

   this.agentProcess.on('error', (err: Error) => {
     console.error('[bridge] Process error:', err);
   });

   // Create streams
   const input = Writable.toWeb(this.agentProcess.stdin!);
   const output = Readable.toWeb(this.agentProcess.stdout!);

   // Create the connection
   const stream = acp.ndJsonStream(input, output);
   this.connection = new acp.ClientSideConnection((_agent) => this.acpClient, stream);

   // Initialize
   const initResult = await this.connection.initialize({
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: {
        fs: {
          readTextFile: true,
          writeTextFile: true,
        },
      },
    });

    console.log(`[bridge] Connected to agent (protocol v${initResult.protocolVersion})`);

    // Create session
    const sessionResult = await this.connection.newSession({
      cwd: config.cwd || process.cwd(),
      mcpServers: [],
    });

    this.currentSessionId = sessionResult.sessionId;
    this.isInitialized = true;
  }

  async handleUserMessage(userId: string, message: any): Promise<void> {
    await this.ensureConnection(userId);

    if (!this.connection || !this.currentSessionId) {
      throw new Error('Connection not initialized');
    }

    // Set user message ID for reaction tracking
    if (message.message_id) {
      this.acpClient.setUserMessageId(message.message_id);
    }

    // Reset message state
    this.acpClient.reset();

    if (message.photo) {
      const filePath = await this.mediaHandler.downloadPhoto(userId, message.photo);
      await this.sendPrompt(`User sent image: ${filePath}`);
    } else if (message.text) {
      await this.botService.sendReaction(userId, message.message_id);
      await this.sendPrompt(message.text);
    }
  }

  private async sendPrompt(prompt: string): Promise<void> {
    if (!this.connection || !this.currentSessionId) return;

    await this.connection.prompt({
      sessionId: this.currentSessionId,
      prompt: [
        {
          type: 'text',
          text: prompt,
        },
      ],
    });
  }

  async handleWebhookRequest(request: WebhookRequest): Promise<any> {
    const { userId, action, data } = request;

    switch (action) {
      case 'send-message':
        return await this.botService.sendMessage(userId, data.text, data.options);
      case 'send-media':
        if (data.type === 'image') {
          return await this.mediaHandler.uploadPhoto(userId, data.filePath);
        } else {
          return await this.mediaHandler.uploadAudio(userId, data.filePath);
        }
      case 'edit-message':
        return await this.botService.editMessage(userId, data.messageId, data.text, data.options);
      case 'send-reaction':
        return await this.botService.sendReaction(userId, data.messageId);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async close(): Promise<void> {
    if (this.agentProcess) {
      this.agentProcess.kill();
      this.agentProcess = null;
    }
    this.connection = null;
    this.currentSessionId = null;
    this.isInitialized = false;
    this.acpClient.reset();
  }
}
