import { Injectable, Inject } from '@artusx/core';
import path from 'path';
import fs from 'fs';
import { BotService } from './bot.service';

@Injectable()
export class MediaHandler {
  @Inject(BotService)
  botService!: BotService;

  private tempDir: string;

  constructor() {
    this.tempDir = path.join(process.env.HOME || '/tmp', '.telegram-agent', 'media');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async downloadPhoto(userId: string, photo: any): Promise<string> {
    const fileId = photo[photo.length - 1].file_id;
    // Download file path from Telegram server (placeholder implementation)
    await this.botService.downloadFile(fileId);
    
    const localPath = path.join(this.tempDir, userId, `${fileId}.jpg`);
    const userDir = path.dirname(localPath);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

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
