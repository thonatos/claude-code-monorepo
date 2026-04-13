import { Injectable, Inject, ArtusInjectEnum } from '@artusx/core';
import { BotService } from '../module-bot/bot.service';
import { MediaHandler } from '../module-bot/media.handler';
import type { SessionManager } from '../plugins/acp/src/session';
import type { HistoryManager } from '../plugins/acp/src/history';
import { InjectEnum as ACPInjectEnum } from '../plugins/acp/src/constants';
import type { WebhookRequest } from './types';

@Injectable()
export class BridgeService {

  @Inject(ArtusInjectEnum.Application)
  app: any;

  @Inject(BotService)
  botService!: BotService;

  @Inject(MediaHandler)
  mediaHandler!: MediaHandler;

  @Inject(ACPInjectEnum.SessionManager)
  sessionManager!: SessionManager;

  @Inject(ACPInjectEnum.HistoryManager)
  historyManager!: HistoryManager;

  async handleUserMessage(userId: string, message: any): Promise<void> {
    let session = this.sessionManager.get(userId);
    if (!session) {
      const agentConfig = this.app?.config?.artusx?.agent;
      session = await this.sessionManager.create(userId, agentConfig);
    }

    if (message.photo) {
      const filePath = await this.mediaHandler.downloadPhoto(userId, message.photo);
      const prompt = `User sent image: ${filePath}`;
      await this.sendPromptToAgent(session, prompt);

      await this.historyManager.addEntry(userId, {
        role: 'user',
        content: `[Image: ${filePath}]`,
        timestamp: new Date(),
      });
    } else if (message.text) {
      await this.sendPromptToAgent(session, message.text);

      await this.historyManager.addEntry(userId, {
        role: 'user',
        content: message.text,
        timestamp: new Date(),
      });
    }

    await this.botService.sendReaction(userId, message.message_id);
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

  private async sendPromptToAgent(session: any, prompt: string): Promise<void> {
    if (!session.agentProcess) return;

    session.agentProcess.stdin.write(JSON.stringify({ prompt }) + '\n');
    session.lastActivityAt = new Date();
  }
}
