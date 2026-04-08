// packages/telegram-acp/test/media/downloader.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MediaDownloader } from '../../src/media/downloader.ts';
import type { TelegramApiWrapper } from '../../src/telegram-api.ts';
import fs from 'node:fs';
import path from 'node:path';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('MediaDownloader', () => {
  let mockApi: TelegramApiWrapper;
  let downloader: MediaDownloader;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = {
      getFile: vi.fn(),
      token: 'test-token',
    } as any;
    downloader = new MediaDownloader(mockApi, '/tmp/telegram-acp-media');

    // Default successful fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    });
  });

  afterEach(async () => {
    // Cleanup test temp files
    try {
      await fs.promises.rm('/tmp/telegram-acp-media', { recursive: true });
    } catch {}
  });

  it('should download image to temp file', async () => {
    const fileInfo = { file_path: 'photos/test.jpg' };
    mockApi.getFile.mockResolvedValue(fileInfo);

    const mediaInfo = {
      type: 'image' as const,
      fileId: 'test-file-id',
      mimeType: 'image/jpeg',
    };

    const result = await downloader.downloadToTemp('user123', mediaInfo);

    expect(result.path).toContain('user123');
    expect(result.type).toBe('image');
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('should throw error when download fails', async () => {
    mockApi.getFile.mockRejectedValue(new Error('Network error'));

    const mediaInfo = {
      type: 'image' as const,
      fileId: 'test-file-id',
      mimeType: 'image/jpeg',
    };

    await expect(downloader.downloadToTemp('user123', mediaInfo)).rejects.toThrow('Network error');
  });

  it('should create user directory if not exists', async () => {
    const fileInfo = { file_path: 'photos/test.jpg' };
    mockApi.getFile.mockResolvedValue(fileInfo);

    const mediaInfo = {
      type: 'image' as const,
      fileId: 'test-file-id',
      mimeType: 'image/jpeg',
    };

    await downloader.downloadToTemp('newuser456', mediaInfo);

    const userDir = path.join('/tmp/telegram-acp-media', 'newuser456');
    expect(fs.existsSync(userDir)).toBe(true);
  });
});