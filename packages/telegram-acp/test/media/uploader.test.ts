// packages/telegram-acp/test/media/uploader.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MediaUploader } from '../../src/media/uploader.ts';
import type { TelegramApiWrapper } from '../../src/telegram-api.ts';
import fs from 'node:fs';
import path from 'node:path';

describe('MediaUploader', () => {
  let mockApi: TelegramApiWrapper;
  let uploader: MediaUploader;
  const testDir = '/tmp/telegram-acp-upload-test';

  beforeEach(async () => {
    mockApi = {
      sendPhoto: vi.fn().mockResolvedValue({ message_id: 123 }),
      sendAudio: vi.fn().mockResolvedValue({ message_id: 124 }),
    } as any;
    uploader = new MediaUploader(mockApi);

    // Create test directory and files
    await fs.promises.mkdir(testDir, { recursive: true });
    await fs.promises.writeFile(path.join(testDir, 'test.jpg'), 'fake-image-data');
    await fs.promises.writeFile(path.join(testDir, 'test.mp3'), 'fake-audio-data');
  });

  afterEach(async () => {
    // Cleanup test files
    try {
      await fs.promises.rm(testDir, { recursive: true });
    } catch {}
  });

  it('should upload image to Telegram', async () => {
    const imagePath = path.join(testDir, 'test.jpg');
    const msgId = await uploader.uploadImage('user123', imagePath);

    expect(msgId).toBe(123);
    expect(mockApi.sendPhoto).toHaveBeenCalledWith('user123', imagePath);
  });

  it('should upload audio to Telegram', async () => {
    const audioPath = path.join(testDir, 'test.mp3');
    const msgId = await uploader.uploadAudio('user123', audioPath);

    expect(msgId).toBe(124);
    expect(mockApi.sendAudio).toHaveBeenCalledWith('user123', audioPath);
  });

  it('should throw error when image file not found', async () => {
    await expect(uploader.uploadImage('user123', '/nonexistent/file.jpg')).rejects.toThrow('Image file not found');
  });

  it('should throw error when audio file not found', async () => {
    await expect(uploader.uploadAudio('user123', '/nonexistent/file.mp3')).rejects.toThrow('Audio file not found');
  });

  it('should throw error when API fails for image upload', async () => {
    mockApi.sendPhoto = vi.fn().mockRejectedValue(new Error('API error'));

    const imagePath = path.join(testDir, 'test.jpg');
    await expect(uploader.uploadImage('user123', imagePath)).rejects.toThrow('API error');
  });

  it('should throw error when API fails for audio upload', async () => {
    mockApi.sendAudio = vi.fn().mockRejectedValue(new Error('API error'));

    const audioPath = path.join(testDir, 'test.mp3');
    await expect(uploader.uploadAudio('user123', audioPath)).rejects.toThrow('API error');
  });
});