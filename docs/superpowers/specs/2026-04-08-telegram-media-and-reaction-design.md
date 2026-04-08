# Telegram Media Support and Reaction Enhancement Design

**Date**: 2026-04-08
**Author**: Claude Code
**Status**: Draft

## Overview

This design enhances telegram-acp with two major features:

1. **Media Content Support**: Enable bidirectional transfer of images and audio between Telegram users and ACP agents
2. **Reaction System**: Display phase-specific emoji reactions to indicate agent execution status

## Requirements

### Media Content Support

- **Scope**: Images (photos) and audio (voice/music)
- **Direction**: Bidirectional (User → Agent, Agent → User)
- **Transfer Method**: Local file path (download from Telegram, pass path to agent)
- **Exclusions**: Video files not supported in this iteration

### Reaction System

- **Phases**: thought, tool execution, media transfer, output generation
- **Strategy**: Fixed emoji per phase (simple and clear)
- **Emoji Set**:
  - 🤔 - Thought/analysis phase
  - 🔧 - Tool execution
  - 📤 - Media upload (incoming from user)
  - 📥 - Media download (outgoing to user)
  - ✅ - Completion

## Architecture

### Module Structure

```
packages/telegram-acp/src/
├── media/                      # NEW
│   ├── index.ts               # Module exports
│   ├── downloader.ts          # Telegram media → local file
│   ├── uploader.ts            # Local file → Telegram
│   ├── temp-manager.ts        # Temporary file lifecycle
│   └── types.ts               # Media type definitions
├── reaction/                   # NEW
│   ├── index.ts               # Module exports
│   ├── manager.ts             # Reaction state management
│   ├── emoji-mapping.ts       # Phase → emoji mappings
│   └── types.ts               # Reaction type definitions
└── ... (existing modules)
```

### Design Principles

1. **Module Independence**: Media and Reaction modules are independent, easy to test and maintain
2. **Minimal Intrusion**: Existing code changes limited to 3-5 files
3. **Graceful Degradation**: Errors don't block main flow, use fallback strategies

## Media Processing Module

### Key Interfaces

```typescript
// media/types.ts
interface MediaInfo {
  type: 'image' | 'audio';
  fileId: string;
  mimeType: string;
  fileSize?: number;
}

// media/downloader.ts
class MediaDownloader {
  constructor(telegramApi: TelegramApi);

  async downloadToTemp(info: MediaInfo): Promise<string>;
  // Returns: /tmp/telegram-acp/media/{userId}/{fileId}.{ext}
}

// media/uploader.ts
class MediaUploader {
  constructor(telegramApi: TelegramApi);

  async uploadImage(filePath: string): Promise<MessageId>;
  async uploadAudio(filePath: string): Promise<MessageId>;
}

// media/temp-manager.ts
class TempFileManager {
  scheduleCleanup(userId: string, delayMs: number = 60000);
  // Auto-cleanup when session ends
}
```

### Integration Points

- `message.ts`: Extend `extractPrompt()` → `extractContent()` returning `ContentBlock[]`
- Media download occurs between message processing steps (step 2-3)
- File paths passed via ACP `readTextFile` or directly as `ImageContent`

## Reaction System Module

### Key Interfaces

```typescript
// reaction/types.ts
type ReactionPhase = 'thought' | 'tool' | 'media_in' | 'media_out' | 'done';

// reaction/emoji-mapping.ts
const DEFAULT_EMOJI_MAP: Record<ReactionPhase, string> = {
  thought: '🤔',
  tool: '🔧',
  media_in: '📤',
  media_out: '📥',
  done: '✅',
};

// reaction/manager.ts
class ReactionManager {
  constructor(ctx: Context);

  private currentPhase: ReactionPhase | null = null;

  async setReaction(phase: ReactionPhase): Promise<void>;
  // Checks if phase changed, avoids duplicate API calls

  async clearReaction(): Promise<void>;
}
```

### Integration Points

- `client.ts`: Call `reactionManager.setReaction()` in callback functions
  - `handleThoughtChunk()` → `setReaction('thought')`
  - `handleToolCall()` → `setReaction('tool')`
  - Media download → `setReaction('media_in')`
  - Media upload → `setReaction('media_out')`
  - Completion → `setReaction('done')` → `clearReaction()`

### Optimizations

- **Debouncing**: Avoid frequent Telegram API calls
- **Phase Priority**: media > tool > thought (media is most time-consuming)

## Data Flow

### User Sends Media Message

```
1. User sends image/audio
   ↓
2. message.ts: Detect media type
   ↓
3. MediaDownloader: Download to temp file
   reaction: 📤 (media_in)
   ↓
4. Build ContentBlock[]:
   - TextContent (caption)
   - ImageContent/AudioContent (path + mime type)
   ↓
5. Send to ACP agent
   reaction: 🤔 (thought) / 🔧 (tool)
   ↓
6. Agent processes and may generate media response
   ↓
7. If agent returns ImageContent/AudioContent:
   MediaUploader: Upload to Telegram
   reaction: 📥 (media_out)
   ↓
8. Send text reply to Telegram
   reaction: ✅ (done)
   ↓
9. Clear reaction
   ↓
10. TempFileManager: Cleanup (60s delay)
```

### Agent Generates Media

```typescript
// client.ts extension
async handleMessageChunk(update: any): Promise<void> {
  if (update.content.type === "image") {
    const imagePath = update.content.path;
    await this.reactionManager.setReaction('media_out');
    await this.mediaUploader.uploadImage(imagePath);
  }
  // ... existing text handling
}
```

### ACP ContentBlock Adaptation

```typescript
// Current: Only text
const content: acp.ContentBlock = { type: "text", text: prompt };

// Extended: Multi-type
const content: acp.ContentBlock[] = [
  { type: "text", text: caption },
  { type: "image", data: imagePath, mimeType: "image/jpeg" },
];
```

## Error Handling

### Key Error Scenarios

1. **Media Download Failure**
   - Telegram API error (network, permissions)
   - File size exceeds limits
   - Disk space insufficient

2. **Media Upload Failure**
   - Agent-generated file not found
   - Telegram API limits (size, format)
   - Unsupported MIME type

3. **Reaction API Failure**
   - Message deleted
   - Insufficient user permissions
   - API rate limit

### Handling Strategies

```typescript
// message.ts
try {
  const mediaPath = await downloader.downloadToTemp(mediaInfo);
  await reactionManager.setReaction('media_in');
} catch (err) {
  logger.warn(`Media download failed: ${err}`);
  // Fallback: Use placeholder text
  const content = [{
    type: "text",
    text: `[Media unavailable: ${err.message}]`
  }];
}

// client.ts
try {
  await reactionManager.setReaction(phase);
} catch {
  // Don't block main flow on reaction failure
  logger.debug('Reaction API call failed (non-critical)');
}
```

### Cleanup Guarantee

```typescript
// temp-manager.ts
class TempFileManager {
  async cleanup(userId: string): Promise<void> {
    try {
      await fs.rm(this.getUserDir(userId), { recursive: true });
    } catch {
      // Log but don't throw, avoid blocking other cleanup
      logger.warn(`Failed to cleanup temp files for ${userId}`);
    }
  }
}
```

### Degradation Principles

- Reaction failure → Don't block, continue processing
- Media failure → Use text placeholder, inform user
- Cleanup failure → Log warning, don't affect main flow

## Testing Strategy

### Unit Tests

```typescript
// media/downloader.test.ts
- Download image success → Returns valid path
- Download failure → Throws error and cleanup
- File size check → Reject oversized files

// reaction/manager.test.ts
- Phase switch correct → API called
- Duplicate phase → API not called twice (debouncing)
- Clear works → Emoji removed

// media/temp-manager.test.ts
- Cleanup normal → Files deleted
- Cleanup failure → Doesn't throw
- Delay cleanup → Executes after specified time
```

### Integration Tests

```typescript
// integration/media-flow.test.ts
- User sends image → Agent receives ImageContent
- Agent returns image → User sees in Telegram
- Media transfer failure → User gets error message

// integration/reaction-flow.test.ts
- Thought phase → 🤔 shown
- Tool phase → 🔧 shown
- Media phase → 📤/📥 shown
- Completion → ✅ shown then cleared
```

### E2E Tests (Manual)

1. Test image upload in real Telegram bot
2. Test large files (near Telegram limits)
3. Test network interruption scenarios
4. Test concurrent media sending from multiple users

### Test Data Preparation

- Mock Telegram API responses (grammy test tools)
- Prepare test images/audio files of different sizes
- Mock ACP agent responses (return ImageContent)

## Implementation Approach

**Recommended**: Modular implementation (Approach 1)

1. Create `MediaHandler` module for download/upload
2. Extend `client.ts` with reaction callbacks
3. Integrate media extraction in `message.ts`
4. Trigger reaction updates in ACP callbacks

**Benefits**:
- Independent modules, easy testing and maintenance
- Gradual iteration, core features first
- Matches existing architecture pattern

## File Changes Summary

### New Files (9)

- `src/media/index.ts`
- `src/media/downloader.ts`
- `src/media/uploader.ts`
- `src/media/temp-manager.ts`
- `src/media/types.ts`
- `src/reaction/index.ts`
- `src/reaction/manager.ts`
- `src/reaction/emoji-mapping.ts`
- `src/reaction/types.ts`

### Modified Files (4)

- `src/bot/handlers/message.ts` - Extract media, download, build ContentBlock[]
- `src/client.ts` - Handle agent-generated media, trigger reactions
- `src/streaming/state.ts` - Integrate reaction callbacks (optional)
- `src/config.ts` - Add reaction config (optional, for customization)

### Documentation Updates

- `packages/telegram-acp/README.md` - Document media support and reaction behavior
- `CLAUDE.md` - Update architecture diagram with new modules

## Success Criteria

1. ✅ Users can send images/audio to agents
2. ✅ Agents can generate images/audio for users
3. ✅ Reactions display correctly in all phases
4. ✅ Temporary files are cleaned up properly
5. ✅ Errors don't block main conversation flow
6. ✅ All unit and integration tests pass

## Open Questions

1. Should reaction emojis be configurable via YAML?
   - **Decision**: Start with hardcoded DEFAULT_EMOJI_MAP, add config support in future iteration

2. How to handle agent-generated audio files?
   - **Decision**: Upload as voice message if duration < 60s, otherwise as audio file

3. Should media be stored in session history?
   - **Decision**: Only store file metadata (path, type) in history, not actual file content

4. Maximum temp file retention time?
   - **Decision**: 60s after session end, configurable via `tempCleanupDelayMs`

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Telegram API rate limits on reactions | Debounce manager, max 1 call per 500ms |
| Large media files exhaust disk space | Size check before download, cleanup schedule |
| Media format incompatibility | MIME type validation, fallback to text |
| Concurrent media from multiple users | User-scoped temp directories, isolated cleanup |

## Dependencies

- ACP SDK 0.16.1+ (supports ImageContent, AudioContent)
- grammy Bot API (file download/upload methods)
- Node.js fs module (temp file operations)

## Timeline Estimate

- **Media Module**: 2-3 days (download, upload, cleanup)
- **Reaction Module**: 1-2 days (manager, integration)
- **Integration & Testing**: 2-3 days
- **Documentation**: 1 day

**Total**: 6-9 days for complete implementation and testing

---

**Next Steps**: Invoke writing-plans skill to create detailed implementation plan.