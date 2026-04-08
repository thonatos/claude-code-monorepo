/**
 * Parses Markdown media syntax from text.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MediaExtractResult } from './types.ts';

export class MarkdownMediaParser {
  private readonly IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  private readonly AUDIO_EXTS = ['mp3', 'ogg', 'm4a', 'wav'];

  parse(text: string): MediaExtractResult {
    const media: MediaExtractResult['media'] = [];
    const seen = new Set<string>();

    // Match all ![alt](path) patterns
    const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const rawPath = match[2];

      // Skip empty paths
      if (!rawPath || rawPath.trim() === '') continue;

      // Skip external URLs (http/https)
      if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) continue;

      // Deduplicate identical paths
      if (seen.has(rawPath)) continue;
      seen.add(rawPath);

      const type = this.detectMediaType(rawPath);
      if (type) {
        media.push({
          type,
          path: this.resolvePath(rawPath),
          syntax: match[0], // Full match: ![alt](path)
        });
      }
    }

    return { media, text };
  }

  private detectMediaType(filePath: string): 'image' | 'audio' | null {
    const ext = filePath.split('.').pop()?.toLowerCase();

    if (this.IMAGE_EXTS.includes(ext || '')) return 'image';
    if (this.AUDIO_EXTS.includes(ext || '')) return 'audio';

    return null;
  }

  private resolvePath(rawPath: string): string {
    // Handle file:// URI
    if (rawPath.startsWith('file://')) {
      return fileURLToPath(rawPath);
    }

    // Already absolute
    if (path.isAbsolute(rawPath)) {
      return rawPath;
    }

    // Resolve relative path
    return path.resolve(process.cwd(), rawPath);
  }
}