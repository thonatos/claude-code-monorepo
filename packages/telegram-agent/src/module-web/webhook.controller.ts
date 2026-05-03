import type { ArtusXContext } from '@artusx/core';
import { Controller, Inject, POST } from '@artusx/core';
import { WebhookService } from './webhook.service';

@Controller('/api/telegram')
export default class WebhookController {
  @Inject(WebhookService)
  webhookService!: WebhookService;

  @POST('/send-message')
  async sendMessage(ctx: ArtusXContext) {
    const body = ctx.request.body as any;
    const result = await this.webhookService.sendMessage({
      userId: body.userId,
      text: body.text,
      parseMode: body.parseMode,
    });
    ctx.body = result;
  }

  @POST('/send-media')
  async sendMedia(ctx: ArtusXContext) {
    const body = ctx.request.body as any;
    const result = await this.webhookService.sendMedia({
      userId: body.userId,
      filePath: body.filePath,
      type: body.type,
    });
    return result;
  }

  @POST('/edit-message')
  async editMessage(ctx: ArtusXContext) {
    const body = ctx.request.body as any;
    const result = await this.webhookService.editMessage({
      userId: body.userId,
      messageId: body.messageId,
      text: body.text,
      parseMode: body.parseMode,
    });
    return result;
  }

  @POST('/send-reaction')
  async sendReaction(ctx: ArtusXContext): Promise<{ success: boolean }> {
    const body = ctx.request.body as any;
    await this.webhookService.sendReaction({
      userId: body.userId,
      messageId: body.messageId,
      emoji: body.emoji,
    });
    return { success: true };
  }
}
