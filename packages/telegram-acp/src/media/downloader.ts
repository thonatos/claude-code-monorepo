/**
 * Downloads media files from Telegram Bot API to local temp files.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { TelegramApiWrapper } from '../telegram-api.ts';
import type { MediaInfo, MediaDownloadResult } from './types.ts';

export class MediaDownloader {
  constructor(
    private api: TelegramApiWrapper,
    private tempBaseDir: string = '/tmp/telegram-acp/media'
  ) {}

  async downloadToTemp(userId: string, info: MediaInfo): Promise<MediaDownloadResult> {
    // 1. Get file path from Telegram API
    const fileInfo = await this.api.getFile(info.fileId);
    const filePath = fileInfo.file_path;

    // 2. Create user-specific temp directory
    const userDir = path.join(this.tempBaseDir, userId);
    await fs.promises.mkdir(userDir, { recursive: true });

    // 3. Generate local file path
    const ext = this.getExtension(info.mimeType);
    const localPath = path.join(userDir, `${info.fileId}.${ext}`);

    // 4. Download file from Telegram servers
    const url = `https://api.telegram.org/file/bot${this.api.token}/${filePath}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    // 5. Save to local temp file
    const buffer = await response.arrayBuffer();
    await fs.promises.writeFile(localPath, Buffer.from(buffer));

    return {
      path: localPath,
      type: info.type,
      mimeType: info.mimeType,
    };
  }

  private getExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'audio/mpeg': 'mp3',
      'audio/ogg': 'ogg',
    };
    return map[mimeType] || 'bin';
  }
}