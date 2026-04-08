/**
 * Integration tests for media flow.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MediaDownloader, MediaUploader, TempFileManager } from '../../src/media/index.js';
import { ReactionManager, DEFAULT_EMOJI_MAP, REACTION_DEBOUNCE_MS } from '../../src/reaction/index.js';
import type { TelegramApiWrapper } from '../../src/telegram-api.ts';
import fs from 'node:fs';
import path from 'node:path';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Media Flow Integration', () => {
  let mockApi: TelegramApiWrapper;
  let downloader: MediaDownloader;
  let uploader: MediaUploader;
  let tempManager: TempFileManager;
  let reactionManager: ReactionManager;
  let mockReact: ReturnType<typeof vi.fn>;
  const testBaseDir = '/tmp/telegram-acp-integration-test';

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create mock API
    mockApi = {
      getFile: vi.fn().mockResolvedValue({ file_path: 'photos/test.jpg' }),
      sendPhoto: vi.fn().mockResolvedValue({ message_id: 123 }),
      sendAudio: vi.fn().mockResolvedValue({ message_id: 124 }),
      token: 'test-token',
    } as any;

    // Initialize modules
    tempManager = new TempFileManager(testBaseDir);
    downloader = new MediaDownloader(mockApi, testBaseDir);
    uploader = new MediaUploader(mockApi);

    // Create reaction manager with mock callback
    mockReact = vi.fn().mockResolvedValue(undefined);
    reactionManager = new ReactionManager(mockReact);

    // Mock fetch for download tests
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });

    // Create test directory
    await fs.promises.mkdir(testBaseDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup
    try {
      await fs.promises.rm(testBaseDir, { recursive: true });
    } catch {}
  });

  describe('Download Flow', () => {
    it('should download media and set reaction', async () => {
      const mediaInfo = {
        type: 'image' as const,
        fileId: 'test-id',
        mimeType: 'image/jpeg',
      };

      // Simulate message handler flow
      await reactionManager.setReaction('media_in');
      const result = await downloader.downloadToTemp('user123', mediaInfo);

      // Verify reaction was set
      expect(mockReact).toHaveBeenCalledWith(DEFAULT_EMOJI_MAP.media_in);

      // Verify download result
      expect(result.path).toContain('user123');
      expect(result.type).toBe('image');
      expect(result.mimeType).toBe('image/jpeg');
    });

    it('should transition reactions correctly (with debounce delay)', async () => {
      // Simulate full reaction flow with proper delays
      await reactionManager.setReaction('media_in');
      expect(mockReact).toHaveBeenLastCalledWith(DEFAULT_EMOJI_MAP.media_in);

      // Wait for debounce to pass
      await new Promise(r => setTimeout(r, REACTION_DEBOUNCE_MS + 50));

      await reactionManager.setReaction('thought');
      expect(mockReact).toHaveBeenLastCalledWith(DEFAULT_EMOJI_MAP.thought);

      await new Promise(r => setTimeout(r, REACTION_DEBOUNCE_MS + 50));

      await reactionManager.setReaction('tool');
      expect(mockReact).toHaveBeenLastCalledWith(DEFAULT_EMOJI_MAP.tool);

      await new Promise(r => setTimeout(r, REACTION_DEBOUNCE_MS + 50));

      await reactionManager.setReaction('done');
      expect(mockReact).toHaveBeenLastCalledWith(DEFAULT_EMOJI_MAP.done);

      await reactionManager.clearReaction();
      expect(mockReact).toHaveBeenLastCalledWith('');
    });

    it('should debounce duplicate reactions (same phase)', async () => {
      // Set same phase multiple times (no debounce for same phase - it's skipped entirely)
      await reactionManager.setReaction('thought');
      await reactionManager.setReaction('thought'); // Skipped - same phase
      await reactionManager.setReaction('thought'); // Skipped - same phase

      // Should only call API once (first call, subsequent same-phase calls skipped)
      expect(mockReact).toHaveBeenCalledTimes(1);
      expect(mockReact).toHaveBeenCalledWith(DEFAULT_EMOJI_MAP.thought);
    });

    it('should debounce rapid phase changes', async () => {
      // First phase always works
      await reactionManager.setReaction('thought');
      expect(mockReact).toHaveBeenCalledTimes(1);

      // Rapid change within debounce window - skipped
      await reactionManager.setReaction('tool');
      expect(mockReact).toHaveBeenCalledTimes(1); // Still 1, skipped due to debounce

      // After debounce window - allowed
      await new Promise(r => setTimeout(r, REACTION_DEBOUNCE_MS + 50));
      await reactionManager.setReaction('tool');
      expect(mockReact).toHaveBeenCalledTimes(2);
      expect(mockReact).toHaveBeenLastCalledWith(DEFAULT_EMOJI_MAP.tool);
    });
  });

  describe('Upload Flow', () => {
    it('should upload media and set reaction', async () => {
      // Create test file
      const imagePath = path.join(testBaseDir, 'test-upload.jpg');
      await fs.promises.writeFile(imagePath, 'fake-image-data');

      // Simulate upload flow (with debounce delay since previous tests set reactions)
      await new Promise(r => setTimeout(r, REACTION_DEBOUNCE_MS + 50));
      await reactionManager.setReaction('media_out');
      const msgId = await uploader.uploadImage('user123', imagePath);

      // Verify reaction was set
      expect(mockReact).toHaveBeenCalledWith(DEFAULT_EMOJI_MAP.media_out);

      // Verify upload result
      expect(msgId).toBe(123);
      expect(mockApi.sendPhoto).toHaveBeenCalledWith('user123', imagePath);
    });

    it('should upload audio file', async () => {
      const audioPath = path.join(testBaseDir, 'test-upload.mp3');
      await fs.promises.writeFile(audioPath, 'fake-audio-data');

      const msgId = await uploader.uploadAudio('user123', audioPath);

      expect(msgId).toBe(124);
      expect(mockApi.sendAudio).toHaveBeenCalledWith('user123', audioPath);
    });

    it('should throw error when file not found', async () => {
      await expect(
        uploader.uploadImage('user123', '/nonexistent/file.jpg')
      ).rejects.toThrow('Image file not found');
    });
  });

  describe('Cleanup Flow', () => {
    it('should cleanup files after delay', async () => {
      const mediaInfo = {
        type: 'image' as const,
        fileId: 'cleanup-test',
        mimeType: 'image/jpeg',
      };

      const result = await downloader.downloadToTemp('user456', mediaInfo);

      // Verify file exists
      expect(fs.existsSync(result.path)).toBe(true);

      // Schedule cleanup (100ms delay for testing)
      tempManager.scheduleCleanup('user456', 100);

      // Wait for cleanup
      await new Promise(r => setTimeout(r, 150));

      // File should be deleted
      expect(fs.existsSync(result.path)).toBe(false);
    });

    it('should cleanup user directory', async () => {
      // Create multiple files in user directory
      const userDir = tempManager.getUserDir('user789');
      await fs.promises.mkdir(userDir, { recursive: true });
      await fs.promises.writeFile(path.join(userDir, 'file1.jpg'), 'data1');
      await fs.promises.writeFile(path.join(userDir, 'file2.jpg'), 'data2');

      // Cleanup user directory
      await tempManager.cleanup('user789');

      // Directory should be deleted
      expect(fs.existsSync(userDir)).toBe(false);
    });

    it('should not throw when cleanup fails', async () => {
      // Cleanup nonexistent user should not throw
      await expect(tempManager.cleanup('nonexistent-user')).resolves.toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle download errors gracefully', async () => {
      mockApi.getFile = vi.fn().mockRejectedValue(new Error('Network error'));

      const mediaInfo = {
        type: 'image' as const,
        fileId: 'error-test',
        mimeType: 'image/jpeg',
      };

      await expect(
        downloader.downloadToTemp('user123', mediaInfo)
      ).rejects.toThrow('Network error');
    });

    it('should handle upload errors gracefully', async () => {
      const imagePath = path.join(testBaseDir, 'error-upload.jpg');
      await fs.promises.writeFile(imagePath, 'fake-image-data');

      mockApi.sendPhoto = vi.fn().mockRejectedValue(new Error('API error'));

      await expect(
        uploader.uploadImage('user123', imagePath)
      ).rejects.toThrow('API error');
    });

    it('should not throw when reaction API fails', async () => {
      mockReact.mockRejectedValue(new Error('Reaction API error'));

      // Should not throw - errors are caught internally
      await expect(reactionManager.setReaction('thought')).resolves.toBeUndefined();
    });

    it('should handle fetch failure in download', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      const mediaInfo = {
        type: 'image' as const,
        fileId: 'fetch-fail-test',
        mimeType: 'image/jpeg',
      };

      await expect(
        downloader.downloadToTemp('user999', mediaInfo)
      ).rejects.toThrow('Failed to download file');
    });
  });
});