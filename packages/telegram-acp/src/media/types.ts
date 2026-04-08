/**
 * Media type definitions for Telegram-ACP bridge.
 */

export interface MediaInfo {
  type: 'image' | 'audio';
  fileId: string;
  mimeType: string;
  fileSize?: number;
}

export interface MediaDownloadResult {
  path: string;
  type: 'image' | 'audio';
  mimeType: string;
}

export interface MediaUploadOptions {
  userId: string;
  filePath: string;
  type: 'image' | 'audio';
}