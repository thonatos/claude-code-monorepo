/**
 * Uploads local media files to Telegram.
 */

import fs from 'node:fs';
import type { TelegramApiWrapper } from '../telegram-api.ts';

export class MediaUploader {
  constructor(private api: TelegramApiWrapper) {}

  async uploadImage(userId: string, filePath: string): Promise<number> {
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Image file not found: ${filePath}`);
    }

    // Upload via Telegram API
    const msg = await this.api.sendPhoto(userId, filePath);
    return msg.message_id;
  }

  async uploadAudio(userId: string, filePath: string): Promise<number> {
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Audio file not found: ${filePath}`);
    }

    // Upload via Telegram API
    const msg = await this.api.sendAudio(userId, filePath);
    return msg.message_id;
  }
}