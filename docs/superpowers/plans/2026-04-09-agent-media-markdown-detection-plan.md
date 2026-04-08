# Agent Media Markdown Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable automatic media sending when agents return text containing Markdown image/audio syntax

**Architecture:** Add MarkdownMediaParser to extract media paths from `![alt](path)` syntax, integrate in client before markdown-to-HTML conversion, send media separately, convert syntax to code format in text

**Tech Stack:** TypeScript, vitest, Node.js fs module

---

## Phase 1: Type Definitions

### Task 1: Extend Media Types

**Files:**
- Modify: `packages/telegram-acp/src/media/types.ts`

- [ ] **Step 1: Add MediaExtractResult interface**

```typescript
// packages/telegram-acp/src/media/types.ts (add to end of file)

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
```

- [ ] **Step 2: Commit types**

```bash
git add packages/telegram-acp/src/media/types.ts
git commit -m "feat(media): add MediaExtractResult interface for markdown parsing"
```

---

## Phase 2: Markdown Parser Implementation

### Task 2: Create MarkdownMediaParser Class

**Files:**
- Create: `packages/telegram-acp/src/media/markdown-parser.ts`
- Create: `packages/telegram-acp/test/media/markdown-parser.test.ts`

- [ ] **Step 1: Write failing test for image extraction**

```typescript
// packages/telegram-acp/test/media/markdown-parser.test.ts
import { describe, it, expect } from 'vitest';
import { MarkdownMediaParser } from '../../src/media/markdown-parser.ts';

describe('MarkdownMediaParser', () => {
  const parser = new MarkdownMediaParser();

  it('should extract image from markdown syntax', () => {
    const result = parser.parse('Text ![image](/tmp/test.jpg) more text');

    expect(result.media).toHaveLength(1);
    expect(result.media[0].type).toBe('image');
    expect(result.media[0].path).toBe('/tmp/test.jpg');
    expect(result.media[0].syntax).toBe('![image](/tmp/test.jpg)');
    expect(result.text).toBe('Text ![image](/tmp/test.jpg) more text');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter telegram-acp test test/media/markdown-parser.test.ts`
Expected: FAIL with "Cannot find module '../../src/media/markdown-parser'"

- [ ] **Step 3: Implement MarkdownMediaParser**

```typescript
// packages/telegram-acp/src/media/markdown-parser.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter telegram-acp test test/media/markdown-parser.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing test for audio detection**

```typescript
// packages/telegram-acp/test/media/markdown-parser.test.ts (add to existing file)
it('should detect audio by extension', () => {
  const result = parser.parse('![audio](/tmp/test.mp3)');

  expect(result.media).toHaveLength(1);
  expect(result.media[0].type).toBe('audio');
  expect(result.media[0].path).toBe('/tmp/test.mp3');
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter telegram-acp test test/media/markdown-parser.test.ts`
Expected: PASS

- [ ] **Step 7: Write failing test for multiple media**

```typescript
// packages/telegram-acp/test/media/markdown-parser.test.ts (add to existing file)
it('should handle multiple media', () => {
  const result = parser.parse('First ![a](/tmp/x.jpg) and ![b](/tmp/y.png)');

  expect(result.media).toHaveLength(2);
  expect(result.media[0].path).toBe('/tmp/x.jpg');
  expect(result.media[1].path).toBe('/tmp/y.png');
});
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter telegram-acp test test/media/markdown-parser.test.ts`
Expected: PASS

- [ ] **Step 9: Write failing test for deduplication**

```typescript
// packages/telegram-acp/test/media/markdown-parser.test.ts (add to existing file)
it('should deduplicate same paths', () => {
  const result = parser.parse('![a](/tmp/x.jpg) and ![b](/tmp/x.jpg)');

  expect(result.media).toHaveLength(1);
  expect(result.media[0].path).toBe('/tmp/x.jpg');
});
```

- [ ] **Step 10: Run test to verify it passes**

Run: `pnpm --filter telegram-acp test test/media/markdown-parser.test.ts`
Expected: PASS

- [ ] **Step 11: Write failing test for skip invalid paths**

```typescript
// packages/telegram-acp/test/media/markdown-parser.test.ts (add to existing file)
it('should skip empty paths and external URLs', () => {
  const result = parser.parse('![a]() and ![b](http://example.com/img.jpg)');

  expect(result.media).toHaveLength(0);
});

it('should skip non-media extensions', () => {
  const result = parser.parse('![doc](/tmp/file.pdf)');

  expect(result.media).toHaveLength(0);
});
```

- [ ] **Step 12: Run test to verify it passes**

Run: `pnpm --filter telegram-acp test test/media/markdown-parser.test.ts`
Expected: PASS

- [ ] **Step 13: Write failing test for relative paths**

```typescript
// packages/telegram-acp/test/media/markdown-parser.test.ts (add to existing file)
import path from 'node:path';

it('should resolve relative paths', () => {
  const result = parser.parse('![img](./test.jpg)');

  expect(result.media).toHaveLength(1);
  expect(path.isAbsolute(result.media[0].path)).toBe(true);
  expect(result.media[0].path).toContain('test.jpg');
});
```

- [ ] **Step 14: Run test to verify it passes**

Run: `pnpm --filter telegram-acp test test/media/markdown-parser.test.ts`
Expected: PASS

- [ ] **Step 15: Update media/index.ts to export parser**

```typescript
// packages/telegram-acp/src/media/index.ts (update file)
export * from './types.ts';
export { MediaDownloader } from './downloader.ts';
export { MediaUploader } from './uploader.ts';
export { TempFileManager } from './temp-manager.ts';
export { MarkdownMediaParser } from './markdown-parser.ts'; // NEW
```

- [ ] **Step 16: Commit parser**

```bash
git add packages/telegram-acp/src/media/markdown-parser.ts packages/telegram-acp/src/media/index.ts packages/telegram-acp/test/media/markdown-parser.test.ts
git commit -m "feat(media): implement MarkdownMediaParser with comprehensive tests"
```

---

## Phase 3: Client Integration

### Task 3: Integrate Parser in Client

**Files:**
- Modify: `packages/telegram-acp/src/client.ts`

- [ ] **Step 1: Add parser to client options**

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
  onMediaUpload?: (path: string, type: 'image' | 'audio') => Promise<void>;
  onReactionChange?: (phase: ReactionPhase) => Promise<void>;
  mediaParser?: MarkdownMediaParser; // NEW
}
```

- [ ] **Step 2: Import parser type**

```typescript
// packages/telegram-acp/src/client.ts (add to imports)
import { MarkdownMediaParser } from './media/markdown-parser.ts';
```

- [ ] **Step 3: Store parser in client**

```typescript
// packages/telegram-acp/src/client.ts (update constructor)
export class TelegramAcpClient implements acp.Client {
  private opts: TelegramAcpClientOpts;
  private streamingState: StreamingMessageState;
  private chunks: string[] = [];
  private logLevel: LogLevel;
  private mediaParser?: MarkdownMediaParser; // NEW

  constructor(opts: TelegramAcpClientOpts) {
    this.opts = opts;
    this.logLevel = opts.logLevel || 'info';
    this.mediaParser = opts.mediaParser; // NEW

    const sendTyping = opts.sendTyping ? opts.sendTyping : async () => { };

    this.streamingState = new StreamingMessageState(
      {
        sendMessage: opts.sendMessage,
        editMessage: opts.editMessage,
        sendTyping: sendTyping,
        log: opts.log,
      },
      DEFAULT_STREAMING_CONFIG
    );
  }
```

- [ ] **Step 4: Update handleMessageChunk to parse media**

```typescript
// packages/telegram-acp/src/client.ts (update handleMessageChunk method)
private async handleMessageChunk(update: any): Promise<void> {
  if (update.content.type === "text") {
    const chunk = update.content.text;
    this.chunks.push(chunk);

    // Parse media BEFORE markdown-to-HTML conversion
    if (this.opts.onMediaUpload && this.mediaParser) {
      const fullText = this.chunks.join('');
      const result = this.mediaParser.parse(fullText);

      // Send detected media
      for (const media of result.media) {
        try {
          // Validate file exists
          if (!fs.existsSync(media.path)) {
            console.debug(`[media] File not found: ${media.path}`);
            continue;
          }

          // Send media via callback
          await this.opts.onMediaUpload(media.path, media.type);
          console.debug(`[media] Sent ${media.type}: ${media.path}`);
        } catch (err) {
          // Silent fail - don't block text flow
          console.warn(`[media] Failed to send: ${String(err)}`);
        }
      }

      // Convert media syntax to code format
      if (result.media.length > 0) {
        let modifiedText = fullText;
        for (const media of result.media) {
          // ![alt](path) → `![alt](path)`
          modifiedText = modifiedText.replace(
            media.syntax,
            `\`${media.syntax}\``
          );
        }
        // Update chunks with modified text
        this.chunks = [modifiedText];
      }
    }

    // Continue with text streaming (will be converted to HTML later)
    await this.streamingState.appendText(chunk);
  } else if (update.content.type === "image") {
    // Agent generated image (existing code)
    const imagePath = update.content.uri || update.content.data || update.content.path;
    if (this.opts.onMediaUpload && imagePath) {
      await this.opts.onMediaUpload(imagePath, 'image');
    }
  } else if (update.content.type === "audio") {
    // Agent generated audio (existing code)
    const audioPath = update.content.uri || update.content.data || update.content.path;
    if (this.opts.onMediaUpload && audioPath) {
      await this.opts.onMediaUpload(audioPath, 'audio');
    }
  }
}
```

- [ ] **Step 5: Import fs module**

```typescript
// packages/telegram-acp/src/client.ts (add to imports)
import fs from 'node:fs';
```

- [ ] **Step 6: Write integration test**

```typescript
// packages/telegram-acp/test/client.test.ts (add to existing file)
describe('Media markdown parsing', () => {
  it('should send media when markdown detected', async () => {
    const mockUpload = vi.fn().mockResolvedValue(undefined);
    const mockExists = vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const client = new TelegramAcpClient({
      sendMessage: vi.fn(),
      editMessage: vi.fn(),
      onThoughtFlush: vi.fn(),
      log: vi.fn(),
      showThoughts: false,
      onMediaUpload: mockUpload,
      mediaParser: new MarkdownMediaParser(),
    });

    await client.sessionUpdate({
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: '![image](/tmp/test.jpg)' },
      },
    });

    expect(mockUpload).toHaveBeenCalledWith('/tmp/test.jpg', 'image');

    mockExists.mockRestore();
  });

  it('should convert media syntax to code format', async () => {
    const sendMessage = vi.fn().mockResolvedValue(123);
    const mockExists = vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const client = new TelegramAcpClient({
      sendMessage,
      editMessage: vi.fn(),
      onThoughtFlush: vi.fn(),
      log: vi.fn(),
      showThoughts: false,
      onMediaUpload: vi.fn(),
      mediaParser: new MarkdownMediaParser(),
    });

    await client.sessionUpdate({
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: 'See ![img](/tmp/test.jpg)' },
      },
    });

    const text = await client.flush();
    expect(text).toContain('<code>![img](/tmp/test.jpg)</code>');

    mockExists.mockRestore();
  });

  it('should skip non-existent files', async () => {
    const mockUpload = vi.fn();
    const mockExists = vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const client = new TelegramAcpClient({
      sendMessage: vi.fn(),
      editMessage: vi.fn(),
      onThoughtFlush: vi.fn(),
      log: vi.fn(),
      showThoughts: false,
      onMediaUpload: mockUpload,
      mediaParser: new MarkdownMediaParser(),
    });

    await client.sessionUpdate({
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: '![missing](/tmp/nonexistent.jpg)' },
      },
    });

    expect(mockUpload).not.toHaveBeenCalled();

    mockExists.mockRestore();
  });
});
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter telegram-acp test test/client.test.ts`
Expected: PASS

- [ ] **Step 8: Commit client changes**

```bash
git add packages/telegram-acp/src/client.ts packages/telegram-acp/test/client.test.ts
git commit -m "feat(client): integrate MarkdownMediaParser for automatic media sending"
```

---

## Phase 4: Bridge Integration

### Task 4: Initialize Parser in Bridge

**Files:**
- Modify: `packages/telegram-acp/src/bridge.ts`

- [ ] **Step 1: Import MarkdownMediaParser**

```typescript
// packages/telegram-acp/src/bridge.ts (add to imports)
import { MediaDownloader, MediaUploader, TempFileManager, MarkdownMediaParser } from './media/index.js';
```

- [ ] **Step 2: Add parser to client options**

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

  // Media upload callback
  onMediaUpload: async (path, type) => {
    await this.reactionManager.setReaction('media_out');
    if (type === 'image') {
      await this.uploader.uploadImage(userId, path);
    } else {
      await this.uploader.uploadAudio(userId, path);
    }
  },

  // Reaction change callback
  onReactionChange: async (phase) => {
    await this.reactionManager.setReaction(phase);
  },

  // NEW: Media parser
  mediaParser: new MarkdownMediaParser(),
};
```

- [ ] **Step 3: Commit bridge changes**

```bash
git add packages/telegram-acp/src/bridge.ts
git commit -m "feat(bridge): initialize MarkdownMediaParser in client options"
```

---

## Phase 5: Final Testing & Documentation

### Task 5: Run Full Test Suite

**Files:**
- Test all functionality

- [ ] **Step 1: Run all tests**

Run: `pnpm --filter telegram-acp test`
Expected: All tests PASS

- [ ] **Step 2: Build project**

Run: `pnpm --filter telegram-acp run build`
Expected: Build SUCCESS with no TypeScript errors

- [ ] **Step 3: Manual smoke test**

Create a test scenario where agent returns:
```
Here's the result: ![output](/tmp/result.jpg)
```

Expected behavior:
1. Media sent to Telegram (if file exists)
2. Text sent with code-formatted syntax: `Here's the result: <code>![output](/tmp/result.jpg)</code>`

- [ ] **Step 4: Create final commit**

```bash
git add .
git commit -m "feat: complete agent media markdown detection implementation

- Add MarkdownMediaParser to extract media from markdown syntax
- Support image and audio files via extension detection
- Send media separately before text
- Convert media syntax to code format in text
- Handle errors gracefully (skip non-existent files)
- All tests passing

Closes #<issue-number>"
```

---

## File Changes Summary

### New Files (2)

- `packages/telegram-acp/src/media/markdown-parser.ts` - Markdown media parser implementation
- `packages/telegram-acp/test/media/markdown-parser.test.ts` - Comprehensive unit tests

### Modified Files (4)

- `packages/telegram-acp/src/media/types.ts` - Add MediaExtractResult interface
- `packages/telegram-acp/src/media/index.ts` - Export MarkdownMediaParser
- `packages/telegram-acp/src/client.ts` - Integrate parser in handleMessageChunk
- `packages/telegram-acp/src/bridge.ts` - Initialize parser in client options
- `packages/telegram-acp/test/client.test.ts` - Add integration tests

---

## Implementation Timeline

- **Phase 1 (Types)**: 15 minutes
- **Phase 2 (Parser)**: 1-2 hours
- **Phase 3 (Client)**: 1-2 hours
- **Phase 4 (Bridge)**: 15 minutes
- **Phase 5 (Testing)**: 30 minutes

**Total**: 3-5 hours

---

## Success Criteria

1. ✅ Agents can indicate media via Markdown `![alt](path)` syntax
2. ✅ Media files are automatically sent to Telegram users
3. ✅ Text preserves syntax in readable code format
4. ✅ Errors don't block text delivery
5. ✅ All unit and integration tests pass
6. ✅ TypeScript compilation succeeds

---

## Next Steps

After plan completion:
1. Use `superpowers:subagent-driven-development` to execute
2. Each task will be implemented by a fresh subagent
3. Two-stage review (spec + code quality) after each task