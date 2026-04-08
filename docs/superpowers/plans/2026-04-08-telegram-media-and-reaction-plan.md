# Telegram Media Support and Reaction Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bidirectional media support (images/audio) and phase-specific emoji reactions to telegram-acp bridge.

**Architecture:** Modular implementation with two independent subsystems: MediaHandler (download/upload) and ReactionManager (state tracking). Minimal intrusion to existing code (4 modified files).

**Tech Stack:** TypeScript, grammy Bot API, vitest, ACP SDK 0.16.1

---

## Phase 1: Foundation - Types & Constants

### Task 1: Media Type Definitions

**Files:**
- Create: `packages/telegram-acp/src/media/types.ts`

- [ ] **Step 1: Create media type definitions**

```typescript
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
```

- [ ] **Step 2: Create media module exports**

```typescript
// packages/telegram-acp/src/media/index.ts
export * from './types.ts';
export { MediaDownloader } from './downloader.ts';
export { MediaUploader } from './uploader.ts';
export { TempFileManager } from './temp-manager.ts';
```

- [ ] **Step 3: Commit types**

```bash
git add packages/telegram-acp/src/media/types.ts packages/telegram-acp/src/media/index.ts
git commit -m "feat(media): add media type definitions"
```

### Task 2: Reaction Type Definitions & Emoji Mapping

**Files:**
- Create: `packages/telegram-acp/src/reaction/types.ts`
- Create: `packages/telegram-acp/src/reaction/emoji-mapping.ts`

- [ ] **Step 1: Create reaction type definitions**

```typescript
/**
 * Reaction type definitions for Telegram-ACP bridge.
 */

export type ReactionPhase = 'thought' | 'tool' | 'media_in' | 'media_out' | 'done';

export interface ReactionState {
  currentPhase: ReactionPhase | null;
  lastUpdateAt: number;
}
```

- [ ] **Step 2: Create emoji mapping constants**

```typescript
/**
 * Emoji mapping for reaction phases.
 */

import type { ReactionPhase } from './types.ts';

export const DEFAULT_EMOJI_MAP: Record<ReactionPhase, string> = {
  thought: '🤔',
  tool: '🔧',
  media_in: '📤',
  media_out: '📥',
  done: '✅',
};

/**
 * Minimum delay between reaction API calls (ms).
 */
export const REACTION_DEBOUNCE_MS = 500;
```

- [ ] **Step 3: Create reaction module exports**

```typescript
// packages/telegram-acp/src/reaction/index.ts
export * from './types.ts';
export { DEFAULT_EMOJI_MAP, REACTION_DEBOUNCE_MS } from './emoji-mapping.ts';
export { ReactionManager } from './manager.ts';
```

- [ ] **Step 4: Commit types and constants**

```bash
git add packages/telegram-acp/src/reaction/types.ts packages/telegram-acp/src/reaction/emoji-mapping.ts packages/telegram-acp/src/reaction/index.ts
git commit -m "feat(reaction): add reaction type definitions and emoji mapping"
```

---

## Phase 2: Media Module Implementation

### Task 3: Media Downloader

**Files:**
- Create: `packages/telegram-acp/src/media/downloader.ts`
- Create: `packages/telegram-acp/test/media/downloader.test.ts`

- [ ] **Step 1: Write failing test for download success**

```typescript
// packages/telegram-acp/test/media/downloader.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MediaDownloader } from '../../src/media/downloader.ts';
import type { TelegramApiWrapper } from '../../src/telegram-api.ts';
import fs from 'node:fs';
import path from 'node:path';

describe('MediaDownloader', () => {
  let mockApi: TelegramApiWrapper;
  let downloader: MediaDownloader;

  beforeEach(() => {
    mockApi = {
      getFile: vi.fn(),
    } as any;
    downloader = new MediaDownloader(mockApi, '/tmp/telegram-acp-media');
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter telegram-acp test test/media/downloader.test.ts`
Expected: FAIL with "Cannot find module '../../src/media/downloader'"

- [ ] **Step 3: Implement MediaDownloader**

```typescript
// packages/telegram-acp/src/media/downloader.ts
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
```

- [ ] **Step 4: Extend TelegramApiWrapper**

```typescript
// packages/telegram-acp/src/telegram-api.ts (add to existing file)
import type { BotApi } from "./bot/index.ts";

export class TelegramApiWrapper {
  constructor(private api: BotApi, public readonly token: string) {}

  async getFile(fileId: string): Promise<{ file_path: string }> {
    const file = await this.api.getFile(fileId);
    return { file_path: file.file_path };
  }

  // ... existing methods (sendMessage, editMessage, etc.)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter telegram-acp test test/media/downloader.test.ts`
Expected: PASS

- [ ] **Step 6: Write failing test for error handling**

```typescript
// packages/telegram-acp/test/media/downloader.test.ts (add to existing file)
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
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter telegram-acp test test/media/downloader.test.ts`
Expected: PASS

- [ ] **Step 8: Commit downloader**

```bash
git add packages/telegram-acp/src/media/downloader.ts packages/telegram-acp/src/telegram-api.ts packages/telegram-acp/test/media/downloader.test.ts
git commit -m "feat(media): implement MediaDownloader with error handling"
```

### Task 4: Media Uploader

**Files:**
- Create: `packages/telegram-acp/src/media/uploader.ts`
- Create: `packages/telegram-acp/test/media/uploader.test.ts`

- [ ] **Step 1: Write failing test for image upload**

```typescript
// packages/telegram-acp/test/media/uploader.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaUploader } from '../../src/media/uploader.ts';
import type { TelegramApiWrapper } from '../../src/telegram-api.ts';
import fs from 'node:fs';
import path from 'node:path';

describe('MediaUploader', () => {
  let mockApi: TelegramApiWrapper;
  let uploader: MediaUploader;

  beforeEach(async () => {
    mockApi = {
      sendPhoto: vi.fn().mockResolvedValue({ message_id: 123 }),
      sendAudio: vi.fn().mockResolvedValue({ message_id: 124 }),
    } as any;
    uploader = new MediaUploader(mockApi);

    // Create test image file
    const testDir = '/tmp/telegram-acp-test';
    await fs.promises.mkdir(testDir, { recursive: true });
    await fs.promises.writeFile(path.join(testDir, 'test.jpg'), 'fake-image-data');
  });

  it('should upload image to Telegram', async () => {
    const imagePath = path.join('/tmp/telegram-acp-test', 'test.jpg');
    const msgId = await uploader.uploadImage('user123', imagePath);

    expect(msgId).toBe(123);
    expect(mockApi.sendPhoto).toHaveBeenCalledWith('user123', imagePath);
  });

  it('should upload audio to Telegram', async () => {
    const audioPath = path.join('/tmp/telegram-acp-test', 'test.mp3');
    await fs.promises.writeFile(audioPath, 'fake-audio-data');

    const msgId = await uploader.uploadAudio('user123', audioPath);

    expect(msgId).toBe(124);
    expect(mockApi.sendAudio).toHaveBeenCalledWith('user123', audioPath);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter telegram-acp test test/media/uploader.test.ts`
Expected: FAIL with "Cannot find module '../../src/media/uploader'"

- [ ] **Step 3: Implement MediaUploader**

```typescript
// packages/telegram-acp/src/media/uploader.ts
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
```

- [ ] **Step 4: Extend TelegramApiWrapper for upload methods**

```typescript
// packages/telegram-acp/src/telegram-api.ts (add to existing file)
async sendPhoto(userId: string, filePath: string): Promise<{ message_id: number }> {
  const msg = await this.api.sendPhoto(userId, { source: filePath });
  return { message_id: msg.message_id };
}

async sendAudio(userId: string, filePath: string): Promise<{ message_id: number }> {
  const msg = await this.api.sendAudio(userId, { source: filePath });
  return { message_id: msg.message_id };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter telegram-acp test test/media/uploader.test.ts`
Expected: PASS

- [ ] **Step 6: Write failing test for error handling**

```typescript
// packages/telegram-acp/test/media/uploader.test.ts (add to existing file)
it('should throw error when file not found', async () => {
  await expect(uploader.uploadImage('user123', '/nonexistent/file.jpg')).rejects.toThrow('Image file not found');
});

it('should throw error when API fails', async () => {
  mockApi.sendPhoto.mockRejectedValue(new Error('API error'));

  const imagePath = path.join('/tmp/telegram-acp-test', 'test.jpg');
  await expect(uploader.uploadImage('user123', imagePath)).rejects.toThrow('API error');
});
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter telegram-acp test test/media/uploader.test.ts`
Expected: PASS

- [ ] **Step 8: Commit uploader**

```bash
git add packages/telegram-acp/src/media/uploader.ts packages/telegram-acp/src/telegram-api.ts packages/telegram-acp/test/media/uploader.test.ts
git commit -m "feat(media): implement MediaUploader with file validation"
```

### Task 5: Temp File Manager

**Files:**
- Create: `packages/telegram-acp/src/media/temp-manager.ts`
- Create: `packages/telegram-acp/test/media/temp-manager.test.ts`

- [ ] **Step 1: Write failing test for cleanup**

```typescript
// packages/telegram-acp/test/media/temp-manager.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TempFileManager } from '../../src/media/temp-manager.ts';
import fs from 'node:fs';
import path from 'node:path';

describe('TempFileManager', () => {
  let manager: TempFileManager;
  const testBaseDir = '/tmp/telegram-acp-temp-test';

  beforeEach(async () => {
    manager = new TempFileManager(testBaseDir);
    // Create test directory
    await fs.promises.mkdir(testBaseDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup
    try {
      await fs.promises.rm(testBaseDir, { recursive: true });
    } catch {}
  });

  it('should schedule cleanup after delay', async () => {
    const userId = 'user123';
    const userDir = path.join(testBaseDir, userId);
    await fs.promises.mkdir(userDir, { recursive: true });
    await fs.promises.writeFile(path.join(userDir, 'test.jpg'), 'data');

    // Schedule cleanup (100ms delay for testing)
    manager.scheduleCleanup(userId, 100);

    // Verify file still exists immediately
    expect(fs.existsSync(userDir)).toBe(true);

    // Wait for cleanup
    await new Promise(r => setTimeout(r, 150));

    // Verify file is deleted
    expect(fs.existsSync(userDir)).toBe(false);
  });

  it('should not throw when cleanup fails', async () => {
    const userId = 'nonexistent-user';

    // Should not throw error
    await expect(manager.cleanup(userId)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter telegram-acp test test/media/temp-manager.test.ts`
Expected: FAIL with "Cannot find module '../../src/media/temp-manager'"

- [ ] **Step 3: Implement TempFileManager**

```typescript
// packages/telegram-acp/src/media/temp-manager.ts
/**
 * Manages temporary media files lifecycle with automatic cleanup.
 */

import fs from 'node:fs';
import path from 'node:path';

export class TempFileManager {
  constructor(private baseDir: string = '/tmp/telegram-acp/media') {}

  scheduleCleanup(userId: string, delayMs: number = 60000): void {
    setTimeout(async () => {
      await this.cleanup(userId);
    }, delayMs);
  }

  async cleanup(userId: string): Promise<void> {
    const userDir = path.join(this.baseDir, userId);

    try {
      if (fs.existsSync(userDir)) {
        await fs.promises.rm(userDir, { recursive: true });
      }
    } catch (err) {
      // Log but don't throw to avoid blocking other cleanup
      console.warn(`[temp-manager] Failed to cleanup ${userDir}: ${String(err)}`);
    }
  }

  getUserDir(userId: string): string {
    return path.join(this.baseDir, userId);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter telegram-acp test test/media/temp-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Write additional test for getUserDir**

```typescript
// packages/telegram-acp/test/media/temp-manager.test.ts (add to existing file)
it('should return correct user directory path', () => {
  const userDir = manager.getUserDir('user123');
  expect(userDir).toBe(path.join(testBaseDir, 'user123'));
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter telegram-acp test test/media/temp-manager.test.ts`
Expected: PASS

- [ ] **Step 7: Commit temp manager**

```bash
git add packages/telegram-acp/src/media/temp-manager.ts packages/telegram-acp/test/media/temp-manager.test.ts
git commit -m "feat(media): implement TempFileManager with scheduled cleanup"
```

---

## Phase 3: Reaction Module Implementation

### Task 6: Reaction Manager

**Files:**
- Create: `packages/telegram-acp/src/reaction/manager.ts`
- Create: `packages/telegram-acp/test/reaction/manager.test.ts`

- [ ] **Step 1: Write failing test for phase switching**

```typescript
// packages/telegram-acp/test/reaction/manager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReactionManager } from '../../src/reaction/manager.ts';
import { DEFAULT_EMOJI_MAP, REACTION_DEBOUNCE_MS } from '../../src/reaction/emoji-mapping.ts';

describe('ReactionManager', () => {
  let mockReact: ReturnType<typeof vi.fn>;
  let manager: ReactionManager;

  beforeEach(() => {
    mockReact = vi.fn().mockResolvedValue(undefined);
    manager = new ReactionManager(mockReact);
  });

  it('should set reaction for phase', async () => {
    await manager.setReaction('thought');

    expect(mockReact).toHaveBeenCalledTimes(1);
    expect(mockReact).toHaveBeenCalledWith(DEFAULT_EMOJI_MAP.thought);
  });

  it('should not call API for same phase twice (debouncing)', async () => {
    await manager.setReaction('thought');
    await manager.setReaction('thought'); // Same phase

    expect(mockReact).toHaveBeenCalledTimes(1); // Only called once
  });

  it('should call API when phase changes', async () => {
    await manager.setReaction('thought');
    await manager.setReaction('tool'); // Different phase

    expect(mockReact).toHaveBeenCalledTimes(2);
    expect(mockReact).toHaveBeenLastCalledWith(DEFAULT_EMOJI_MAP.tool);
  });

  it('should clear reaction', async () => {
    await manager.setReaction('thought');
    await manager.clearReaction();

    expect(mockReact).toHaveBeenLastCalledWith('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter telegram-acp test test/reaction/manager.test.ts`
Expected: FAIL with "Cannot find module '../../src/reaction/manager'"

- [ ] **Step 3: Implement ReactionManager**

```typescript
// packages/telegram-acp/src/reaction/manager.ts
/**
 * Manages reaction state with debouncing to avoid API spam.
 */

import { DEFAULT_EMOJI_MAP, REACTION_DEBOUNCE_MS } from './emoji-mapping.ts';
import type { ReactionPhase, ReactionState } from './types.ts';

export class ReactionManager {
  private state: ReactionState = {
    currentPhase: null,
    lastUpdateAt: 0,
  };

  constructor(private setReactionApi: (emoji: string) => Promise<void>) {}

  async setReaction(phase: ReactionPhase): Promise<void> {
    // Debouncing: check if phase changed
    if (this.state.currentPhase === phase) {
      return; // Skip duplicate update
    }

    // Check debounce delay
    const now = Date.now();
    if (now - this.state.lastUpdateAt < REACTION_DEBOUNCE_MS) {
      return; // Skip if too frequent
    }

    // Update state and call API
    this.state.currentPhase = phase;
    this.state.lastUpdateAt = now;

    const emoji = DEFAULT_EMOJI_MAP[phase];
    await this.setReactionApi(emoji);
  }

  async clearReaction(): Promise<void> {
    this.state.currentPhase = null;
    this.state.lastUpdateAt = Date.now();
    await this.setReactionApi('');
  }

  getCurrentPhase(): ReactionPhase | null {
    return this.state.currentPhase;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter telegram-acp test test/reaction/manager.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing test for error handling**

```typescript
// packages/telegram-acp/test/reaction/manager.test.ts (add to existing file)
it('should not throw when API fails', async () => {
  mockReact.mockRejectedValue(new Error('API error'));

  // Should not throw
  await expect(manager.setReaction('thought')).resolves.toBeUndefined();
});

it('should respect debounce delay', async () => {
  await manager.setReaction('thought');

  // Immediately change phase (within debounce window)
  await manager.setReaction('tool');

  // Should skip due to debounce
  expect(mockReact).toHaveBeenCalledTimes(1);

  // Wait for debounce to expire
  await new Promise(r => setTimeout(r, REACTION_DEBOUNCE_MS + 10));

  // Now should allow update
  await manager.setReaction('tool');
  expect(mockReact).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter telegram-acp test test/reaction/manager.test.ts`
Expected: FAIL - need to update implementation to catch API errors

- [ ] **Step 7: Fix implementation to handle API errors**

```typescript
// packages/telegram-acp/src/reaction/manager.ts (update setReaction method)
async setReaction(phase: ReactionPhase): Promise<void> {
  // Debouncing: check if phase changed
  if (this.state.currentPhase === phase) {
    return; // Skip duplicate update
  }

  // Check debounce delay
  const now = Date.now();
  if (now - this.state.lastUpdateAt < REACTION_DEBOUNCE_MS) {
    return; // Skip if too frequent
  }

  // Update state
  this.state.currentPhase = phase;
  this.state.lastUpdateAt = now;

  // Call API (best-effort, don't throw on failure)
  try {
    const emoji = DEFAULT_EMOJI_MAP[phase];
    await this.setReactionApi(emoji);
  } catch (err) {
    // Log but don't throw to avoid blocking main flow
    console.debug(`[reaction] API call failed: ${String(err)}`);
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter telegram-acp test test/reaction/manager.test.ts`
Expected: PASS

- [ ] **Step 9: Commit reaction manager**

```bash
git add packages/telegram-acp/src/reaction/manager.ts packages/telegram-acp/test/reaction/manager.test.ts
git commit -m "feat(reaction): implement ReactionManager with debouncing and error handling"
```

---

## Phase 4: Integration

### Task 7: Extend Message Handler for Media

**Files:**
- Modify: `packages/telegram-acp/src/bot/handlers/message.ts:1-113`

- [ ] **Step 1: Add media extraction helper**

```typescript
// packages/telegram-acp/src/bot/handlers/message.ts (add after isMediaMessage function)
function extractMediaInfo(ctx: Context): MediaInfo | null {
  const msg = ctx.message;

  if (msg?.photo) {
    const largest = msg.photo[msg.photo.length - 1]; // Get largest photo
    return {
      type: 'image',
      fileId: largest.file_id,
      mimeType: 'image/jpeg',
      fileSize: largest.file_size,
    };
  }

  if (msg?.audio) {
    return {
      type: 'audio',
      fileId: msg.audio.file_id,
      mimeType: msg.audio.mime_type,
      fileSize: msg.audio.file_size,
    };
  }

  if (msg?.voice) {
    return {
      type: 'audio',
      fileId: msg.voice.file_id,
      mimeType: msg.voice.mime_type,
      fileSize: msg.voice.file_size,
    };
  }

  return null;
}
```

- [ ] **Step 2: Import media modules**

```typescript
// packages/telegram-acp/src/bot/handlers/message.ts (add to imports)
import type { MediaInfo, MediaDownloadResult } from '../../media/types.ts';
import { MediaDownloader, TempFileManager } from '../../media/index.js';
import type { ReactionPhase } from '../../reaction/types.ts';
import { ReactionManager } from '../../reaction/index.js';
```

- [ ] **Step 3: Modify message handler to download media**

```typescript
// packages/telegram-acp/src/bot/handlers/message.ts (update createMessageHandler)
export function createMessageHandler(
  historyInjector: HistoryInjector,
  downloader: MediaDownloader,
  tempManager: TempFileManager,
  reactionManager: ReactionManager
) {
  return async (ctx: Context) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const acpCtx = ctx as AcpContext;

    // 1. React with acknowledgment
    try {
      await ctx.react("👀");
    } catch {}

    // 2. Extract message content
    let prompt = extractPrompt(ctx);
    const mediaInfo = extractMediaInfo(ctx);

    // 3. Handle media download
    let mediaResult: MediaDownloadResult | null = null;
    if (mediaInfo) {
      try {
        await reactionManager.setReaction('media_in');
        mediaResult = await downloader.downloadToTemp(userId, mediaInfo);
      } catch (err) {
        console.warn(`[message] Media download failed: ${String(err)}`);
        prompt += `\n[Media unavailable: ${String(err)}]`;
      }
    }

    // 4. Inject history if needed
    const cachedMessages = historyInjector.getCachedMessages(userId);
    if (cachedMessages && cachedMessages.length > 0 && !historyInjector.hasInjected(userId)) {
      historyInjector.markInjected(userId, cachedMessages);
      prompt = historyInjector.buildContext(cachedMessages, prompt);
    }

    // 5. Record user message
    await acpCtx.sessionManager.recordMessage(userId, 'user', prompt);

    // 6. Update reaction based on content type
    try {
      if (mediaResult) {
        await reactionManager.setReaction('thought');
      } else {
        await ctx.react("🤔");
      }
    } catch {}

    // 7. Build ACP prompt with media
    const content: acp.ContentBlock[] = [];

    // Add text
    if (prompt) {
      content.push({ type: "text", text: prompt });
    }

    // Add media (image/audio) via URI
    if (mediaResult && mediaResult.type === 'image') {
      content.push({
        type: "image",
        data: "", // Base64 data (empty for local file approach)
        mimeType: mediaResult.mimeType,
        uri: mediaResult.path, // Agent can access via readTextFile
      });
    } else if (mediaResult && mediaResult.type === 'audio') {
      content.push({
        type: "audio",
        data: "", // Base64 data (empty for local file approach)
        mimeType: mediaResult.mimeType,
        uri: mediaResult.path, // Agent can access via readTextFile
      });
    }

    const session = acpCtx.session;

    try {
      // Reset streaming state
      session.client.reset();

      // Mark healthy
      session.healthMonitor.markHealthy();

      // 8. Send to ACP agent
      const result = await session.connection.prompt({
        sessionId: session.sessionId,
        prompt: content,
      });

      // Collect reply
      let replyText = await session.client.flush();

      // Handle stop reasons
      if (result.stopReason === "cancelled") {
        replyText += "\n[cancelled]";
      } else if (result.stopReason === "refusal") {
        replyText += "\n[agent refused]";
      }

      // Record reply
      await acpCtx.sessionManager.recordMessage(userId, 'agent', replyText);

      // 9. Clear reaction
      try {
        await reactionManager.setReaction('done');
        await new Promise(r => setTimeout(r, 500)); // Show done for 500ms
        await reactionManager.clearReaction();
      } catch {}

      // 10. Schedule temp file cleanup
      if (mediaResult) {
        tempManager.scheduleCleanup(userId, 60000);
      }
    } catch (err) {
      session.healthMonitor.markUnhealthy(String(err));

      try {
        await reactionManager.clearReaction();
      } catch {}
      await ctx.reply(`⚠️ Error: ${String(err)}`);
    }
  };
}
```

- [ ] **Step 4: Commit message handler changes**

```bash
git add packages/telegram-acp/src/bot/handlers/message.ts
git commit -m "feat(message): integrate media download and reaction in message handler"
```

### Task 8: Extend Client for Agent-Generated Media

**Files:**
- Modify: `packages/telegram-acp/src/client.ts:126-132`

- [ ] **Step 1: Add media handling in handleMessageChunk**

```typescript
// packages/telegram-acp/src/client.ts (update handleMessageChunk method)
private async handleMessageChunk(update: any): Promise<void> {
  if (update.content.type === "text") {
    const chunk = update.content.text;
    this.chunks.push(chunk);
    await this.streamingState.appendText(chunk);
  } else if (update.content.type === "image") {
    // Agent generated image
    const imagePath = update.content.uri || update.content.data || update.content.path;
    if (this.opts.onMediaUpload && imagePath) {
      await this.opts.onMediaUpload(imagePath, 'image');
    }
  } else if (update.content.type === "audio") {
    // Agent generated audio
    const audioPath = update.content.uri || update.content.data || update.content.path;
    if (this.opts.onMediaUpload && audioPath) {
      await this.opts.onMediaUpload(audioPath, 'audio');
    }
  }
}
```

- [ ] **Step 2: Add onMediaUpload callback to opts**

```typescript
// packages/telegram-acp/src/client.ts (update TelegramAcpClientOpts interface)
export interface TelegramAcpClientOpts {
  sendTyping?: () => Promise<void>;
  onThoughtFlush: (text: string) => Promise<void>;
  log: (msg: string) => void;
  showThoughts: boolean;
  sendMessage: (text: string, parseMode?: 'HTML') => Promise<number>;
  editMessage: (msgId: number, text: string, parseMode?: 'HTML') => Promise<number>;
  logLevel?: LogLevel;
  onMediaUpload?: (path: string, type: 'image' | 'audio') => Promise<void>; // NEW
}
```

- [ ] **Step 3: Update reaction triggers in callbacks**

```typescript
// packages/telegram-acp/src/client.ts (update handleThoughtChunk)
private async handleThoughtChunk(update: any): Promise<void> {
  if (update.content.type === "text") {
    const thought = update.content.text;

    // Always log to CLI
    if (shouldLog('info', this.logLevel)) {
      this.opts.log(`[thought] ${truncate(thought, 100)}...`);
    }

    // Trigger reaction
    if (this.opts.onReactionChange) {
      await this.opts.onReactionChange('thought');
    }

    // Telegram thoughts if enabled
    if (this.opts.showThoughts) {
      await this.streamingState.appendThought(thought);
    }
  }
}

// Update handleToolCall
private async handleToolCall(update: any): Promise<void> {
  const title = update.title;
  const status = update.status || 'running';
  const params = this.extractToolParams(update);

  // CLI logging
  if (shouldLog('info', this.logLevel)) {
    this.opts.log(`[tool] ${title} (${status})`);
  }

  if (shouldLog('debug', this.logLevel) && params) {
    this.opts.log(`  params: ${JSON.stringify(params, null, 2)}`);
  }

  // Trigger reaction
  if (this.opts.onReactionChange) {
    await this.opts.onReactionChange('tool');
  }

  // Send typing
  if (this.opts.sendTyping) {
    await this.opts.sendTyping();
  }
}
```

- [ ] **Step 4: Add onReactionChange to opts**

```typescript
// packages/telegram-acp/src/client.ts (update TelegramAcpClientOpts)
export interface TelegramAcpClientOpts {
  // ... existing fields
  onReactionChange?: (phase: ReactionPhase) => Promise<void>; // NEW
}
```

- [ ] **Step 5: Import reaction types**

```typescript
// packages/telegram-acp/src/client.ts (add to imports)
import type { ReactionPhase } from './reaction/types.ts';
```

- [ ] **Step 6: Commit client changes**

```bash
git add packages/telegram-acp/src/client.ts
git commit -m "feat(client): add media upload and reaction callbacks to ACP client"
```

### Task 9: Update Bridge Orchestration

**Files:**
- Modify: `packages/telegram-acp/src/bridge.ts`

- [ ] **Step 1: Initialize media and reaction modules**

```typescript
// packages/telegram-acp/src/bridge.ts (update TelegramAcpBridge class)
import { MediaDownloader, MediaUploader, TempFileManager } from './media/index.js';
import { ReactionManager } from './reaction/index.js';

export class TelegramAcpBridge {
  private downloader: MediaDownloader;
  private uploader: MediaUploader;
  private tempManager: TempFileManager;
  private reactionManager: ReactionManager;

  constructor(private config: Config) {
    // Initialize modules
    this.tempManager = new TempFileManager();
    this.downloader = new MediaDownloader(this.telegramApi, this.tempManager.baseDir);
    this.uploader = new MediaUploader(this.telegramApi);
    this.reactionManager = new ReactionManager(async (emoji) => {
      // Will be set per-message context
      console.debug(`[reaction] Setting: ${emoji}`);
    });
  }

  async start(): Promise<void> {
    // ... existing startup logic

    // Pass modules to message handler
    const messageHandler = createMessageHandler(
      this.historyInjector,
      this.downloader,
      this.tempManager,
      this.reactionManager
    );

    // ... rest of startup
  }
}
```

- [ ] **Step 2: Update client opts to include media upload**

```typescript
// packages/telegram-acp/src/bridge.ts (update client initialization)
const clientOpts: TelegramAcpClientOpts = {
  sendMessage: async (text, parseMode) => {
    return this.telegramApi.sendMessage(userId, text, parseMode);
  },
  editMessage: async (msgId, text, parseMode) => {
    return this.telegramApi.editMessage(userId, msgId, text, parseMode);
  },
  sendTyping: async () => {
    await this.telegramApi.sendTyping(userId);
  },
  onThoughtFlush: async (text) => {
    console.log(`[thought-final] ${truncate(text, 100)}`);
  },
  log: (msg) => console.log(msg),
  showThoughts: this.config.showThoughts || false,
  logLevel: this.config.observability?.logging?.level || 'info',

  // NEW: Media upload callback
  onMediaUpload: async (path, type) => {
    await this.reactionManager.setReaction('media_out');
    if (type === 'image') {
      await this.uploader.uploadImage(userId, path);
    } else {
      await this.uploader.uploadAudio(userId, path);
    }
  },

  // NEW: Reaction change callback
  onReactionChange: async (phase) => {
    await this.reactionManager.setReaction(phase);
  },
};
```

- [ ] **Step 3: Import client opts type**

```typescript
// packages/telegram-acp/src/bridge.ts (add to imports)
import type { TelegramAcpClientOpts } from './client.ts';
```

- [ ] **Step 4: Commit bridge changes**

```bash
git add packages/telegram-acp/src/bridge.ts
git commit -m "feat(bridge): integrate media and reaction modules in bridge orchestration"
```

### Task 10: Update Bot Index

**Files:**
- Modify: `packages/telegram-acp/src/bot/index.ts`

- [ ] **Step 1: Update message handler registration**

```typescript
// packages/telegram-acp/src/bot/index.ts (update bot setup)
import { createMessageHandler } from './handlers/message.ts';

export function setupBot(config: Config, modules: {
  historyInjector: HistoryInjector;
  downloader: MediaDownloader;
  tempManager: TempFileManager;
  reactionManager: ReactionManager;
}): Bot {
  const bot = new Bot(config.telegram.botToken);

  // Register handlers
  bot.on('message:text', createMessageHandler(
    modules.historyInjector,
    modules.downloader,
    modules.tempManager,
    modules.reactionManager
  ));

  // Handle media messages
  bot.on('message:photo', createMessageHandler(
    modules.historyInjector,
    modules.downloader,
    modules.tempManager,
    modules.reactionManager
  ));

  bot.on('message:audio', createMessageHandler(
    modules.historyInjector,
    modules.downloader,
    modules.tempManager,
    modules.reactionManager
  ));

  // ... rest of setup

  return bot;
}
```

- [ ] **Step 2: Import media and reaction types**

```typescript
// packages/telegram-acp/src/bot/index.ts (add to imports)
import type { MediaDownloader, TempFileManager } from '../media/index.js';
import type { ReactionManager } from '../reaction/index.js';
```

- [ ] **Step 3: Commit bot index changes**

```bash
git add packages/telegram-acp/src/bot/index.ts
git commit -m "feat(bot): register media message handlers with modules"
```

---

## Phase 5: Documentation & Final Testing

### Task 11: Update README

**Files:**
- Modify: `packages/telegram-acp/README.md`

- [ ] **Step 1: Add media support section**

```markdown
## Media Support

### Supported Media Types

- **Images**: JPEG, PNG, GIF
- **Audio**: MP3, OGG (voice messages)

### User Experience

**Incoming Media:**
1. User sends image/audio
2. Bot shows 📤 reaction (uploading)
3. Agent processes the media
4. Bot shows 🤔/🔧 reactions during processing
5. Bot sends response
6. Bot shows ✅ reaction then clears

**Outgoing Media:**
- If agent generates images/audio, bot uploads them to Telegram automatically
- Bot shows 📥 reaction during upload

### Temporary Files

- Media files are downloaded to `/tmp/telegram-acp/media/{userId}/`
- Files are passed to agent via URI field in ContentBlock
- Agent can access files via ACP `readTextFile` or direct file system access
- Files are automatically cleaned up 60s after session ends
- Cleaned even if errors occur during processing
```

- [ ] **Step 2: Add reaction system section**

```markdown
## Reaction System

The bot displays emoji reactions to indicate processing status:

- 🤔 - Agent is thinking/analyzing
- 🔧 - Tool is being executed (ReadFile, Terminal, etc.)
- 📤 - Media is being downloaded from Telegram
- 📥 - Media is being uploaded to Telegram
- ✅ - Processing complete (shown for 500ms then cleared)

Reactions are debounced (500ms minimum delay) to avoid API spam.
```

- [ ] **Step 3: Update architecture diagram**

```markdown
## Architecture

```
packages/telegram-acp/src/
├── media/                      # NEW: Media handling
│   ├── downloader.ts          # Telegram → local file
│   ├── uploader.ts            # Local file → Telegram
│   ├── temp-manager.ts        # Auto cleanup
│   └── types.ts               # Media types
├── reaction/                   # NEW: Reaction management
│   ├── manager.ts             # State + debouncing
│   ├── emoji-mapping.ts       # Phase → emoji
│   └── types.ts               # Reaction types
├── bot/
│   ├── handlers/
│   │   └── message.ts         # Handles text + media
│   └── ...
└── ...
```
```

- [ ] **Step 4: Commit README**

```bash
git add packages/telegram-acp/README.md
git commit -m "docs: document media support and reaction system in README"
```

### Task 12: Integration Testing

**Files:**
- Create: `packages/telegram-acp/test/integration/media-flow.test.ts`

- [ ] **Step 1: Write integration test for media flow**

```typescript
// packages/telegram-acp/test/integration/media-flow.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaDownloader, MediaUploader, TempFileManager } from '../../src/media/index.js';
import { ReactionManager } from '../../src/reaction/index.js';
import type { TelegramApiWrapper } from '../../src/telegram-api.ts';

describe('Media Flow Integration', () => {
  let mockApi: TelegramApiWrapper;
  let downloader: MediaDownloader;
  let uploader: MediaUploader;
  let tempManager: TempFileManager;
  let reactionManager: ReactionManager;

  beforeEach(() => {
    mockApi = {
      getFile: vi.fn().mockResolvedValue({ file_path: 'photos/test.jpg' }),
      sendPhoto: vi.fn().mockResolvedValue({ message_id: 123 }),
      sendAudio: vi.fn().mockResolvedValue({ message_id: 124 }),
    } as any;

    tempManager = new TempFileManager('/tmp/test-media');
    downloader = new MediaDownloader(mockApi, '/tmp/test-media');
    uploader = new MediaUploader(mockApi);

    const mockReact = vi.fn();
    reactionManager = new ReactionManager(mockReact);
  });

  it('should download media and set reaction', async () => {
    const mediaInfo = {
      type: 'image' as const,
      fileId: 'test-id',
      mimeType: 'image/jpeg',
    };

    await reactionManager.setReaction('media_in');
    const result = await downloader.downloadToTemp('user123', mediaInfo);

    expect(result.path).toContain('user123');
    expect(result.type).toBe('image');
  });

  it('should cleanup files after delay', async () => {
    const mediaInfo = {
      type: 'image' as const,
      fileId: 'cleanup-test',
      mimeType: 'image/jpeg',
    };

    const result = await downloader.downloadToTemp('user456', mediaInfo);
    tempManager.scheduleCleanup('user456', 100);

    // Wait for cleanup
    await new Promise(r => setTimeout(r, 150));

    // File should be deleted
    expect(require('fs').existsSync(result.path)).toBe(false);
  });
});
```

- [ ] **Step 2: Run integration test**

Run: `pnpm --filter telegram-acp test test/integration/media-flow.test.ts`
Expected: PASS

- [ ] **Step 3: Commit integration test**

```bash
git add packages/telegram-acp/test/integration/media-flow.test.ts
git commit -m "test: add media flow integration test"
```

### Task 13: Final Verification

- [ ] **Step 1: Run all tests**

Run: `pnpm --filter telegram-acp test`
Expected: All tests PASS

- [ ] **Step 2: Build project**

Run: `pnpm --filter telegram-acp run build`
Expected: Build SUCCESS with no TypeScript errors

- [ ] **Step 3: Run linter (if configured)**

Run: `pnpm --filter telegram-acp run lint` (if available)
Expected: No lint errors

- [ ] **Step 4: Manual smoke test**

```bash
# Create test config
cat > ~/.telegram-acp/test-config.yaml << 'EOF'
telegram:
  botToken: "test_token"
agent:
  preset: claude
EOF

# Run bot (will fail without real token, but verifies startup)
pnpm --filter telegram-acp run start -- --config ~/.telegram-acp/test-config.yaml
```

Expected: Bot starts and logs initialization (will fail on Telegram API connection without real token)

- [ ] **Step 5: Create final commit**

```bash
git add .
git commit -m "feat: complete media and reaction enhancement implementation"

# Create tag
git tag v0.2.0-media-support
```

---

## Success Criteria Verification

After completion, verify:

1. ✅ Users can send images/audio to agents
2. ✅ Agents can generate images/audio for users
3. ✅ Reactions display correctly in all phases
4. ✅ Temporary files are cleaned up properly
5. ✅ Errors don't block main conversation flow
6. ✅ All unit and integration tests pass
7. ✅ TypeScript compilation succeeds
8. ✅ README documents new features

---

## File Changes Summary

### New Files (12)

- `src/media/types.ts` - Media type definitions
- `src/media/index.ts` - Media module exports
- `src/media/downloader.ts` - Telegram media downloader
- `src/media/uploader.ts` - Telegram media uploader
- `src/media/temp-manager.ts` - Temp file lifecycle manager
- `src/reaction/types.ts` - Reaction type definitions
- `src/reaction/emoji-mapping.ts` - Emoji mapping constants
- `src/reaction/index.ts` - Reaction module exports
- `src/reaction/manager.ts` - Reaction state manager
- `test/media/downloader.test.ts` - Downloader unit tests
- `test/media/uploader.test.ts` - Uploader unit tests
- `test/media/temp-manager.test.ts` - Temp manager unit tests
- `test/reaction/manager.test.ts` - Reaction manager tests
- `test/integration/media-flow.test.ts` - Integration tests

### Modified Files (5)

- `src/telegram-api.ts` - Add getFile, sendPhoto, sendAudio methods
- `src/bot/handlers/message.ts` - Extract/download media, build ContentBlock[]
- `src/client.ts` - Handle agent-generated media, trigger reactions
- `src/bridge.ts` - Initialize media/reaction modules, pass to handlers
- `src/bot/index.ts` - Register media message handlers
- `packages/telegram-acp/README.md` - Document new features

---

## Implementation Timeline

- **Phase 1 (Types)**: 1 hour
- **Phase 2 (Media Module)**: 4-6 hours
- **Phase 3 (Reaction Module)**: 2-3 hours
- **Phase 4 (Integration)**: 3-4 hours
- **Phase 5 (Docs & Testing)**: 2-3 hours

**Total**: 12-17 hours (can be split across 2-3 days)