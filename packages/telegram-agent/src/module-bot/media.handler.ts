import fs from "node:fs";
import path from "node:path";
import { ArtusInjectEnum, Inject, Injectable } from "@artusx/core";
import { defaultMediaDir } from "../constants";
import { BotService } from "./bot.service";

@Injectable()
export class MediaHandler {
  @Inject(ArtusInjectEnum.Application)
  app!: any;

  @Inject(BotService)
  botService!: BotService;

  private get tempDir(): string {
    return this.app?.config?.media?.tempDir || defaultMediaDir();
  }

  async downloadPhoto(userId: string, photo: any): Promise<string> {
    const fileId = photo[photo.length - 1].file_id;
    // Download file path from Telegram server (placeholder implementation)
    await this.botService.downloadFile(fileId);

    const localPath = path.join(this.tempDir, userId, `${fileId}.jpg`);
    return localPath;
  }

  async uploadPhoto(userId: string, filePath: string): Promise<number> {
    return await this.botService.sendPhoto(userId, filePath);
  }

  async uploadAudio(userId: string, filePath: string): Promise<number> {
    return await this.botService.sendAudio(userId, filePath);
  }

  cleanupFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
