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

/**
 * Result of parsing Markdown media syntax from text.
 */
export interface MediaExtractResult {
  media: Array<{
    type: 'image' | 'audio';
    path: string;        // Absolute file path
    syntax: string;      // Original markdown syntax: ![alt](path)
  }>;
  text: string;          // Original text (unchanged)
}