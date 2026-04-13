import { Injectable, Inject } from '@artusx/core';
import { BridgeService } from '../module-bridge/bridge.service';
import type { SendMessageRequest, SendMediaRequest, EditMessageRequest, SendReactionRequest } from './types';

@Injectable()
export class WebhookService {
  @Inject(BridgeService)
  bridgeService!: BridgeService;

  async sendMessage(request: SendMessageRequest): Promise<{ messageId: number }> {
    const messageId = await this.bridgeService.handleWebhookRequest({
      action: 'send-message',
      userId: request.userId,
      data: {
        text: request.text,
        options: { parseMode: request.parseMode },
      },
    });
    return { messageId };
  }

  async sendMedia(request: SendMediaRequest): Promise<{ messageId: number }> {
    const messageId = await this.bridgeService.handleWebhookRequest({
      action: 'send-media',
      userId: request.userId,
      data: {
        filePath: request.filePath,
        type: request.type,
      },
    });
    return { messageId };
  }

  async editMessage(request: EditMessageRequest): Promise<{ messageId: number }> {
    const messageId = await this.bridgeService.handleWebhookRequest({
      action: 'edit-message',
      userId: request.userId,
      data: {
        messageId: request.messageId,
        text: request.text,
        options: { parseMode: request.parseMode },
      },
    });
    return { messageId };
  }

  async sendReaction(request: SendReactionRequest): Promise<void> {
    await this.bridgeService.handleWebhookRequest({
      action: 'send-reaction',
      userId: request.userId,
      data: {
        messageId: request.messageId,
        emoji: request.emoji,
      },
    });
  }
}
