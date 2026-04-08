# Agent Media Detection via Markdown Syntax Design

**Date**: 2026-04-09
**Author**: Claude Code
**Status**: Draft

## Overview

Enable automatic media sending when agents return text containing Markdown image syntax. The system will parse Markdown syntax, extract file paths, validate files, and send media to Telegram users separately from text messages.

## Problem Statement

Currently, agents return text content via ACP protocol. However, there's no mechanism to:
- Detect media file references in agent responses
- Automatically send media files to Telegram users
- Preserve the reference information in a user-friendly format

This design introduces a Markdown-based convention for agents to indicate media content.

## Requirements

### Core Requirements

1. **Markdown Syntax Support**: Parse `![alt](path)` syntax for media detection
2. **Media Types**: Support images (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`) and audio (`.mp3`, `.ogg`, `.m4a`, `.wav`)
3. **Separate Messages**: Send media as separate Telegram messages before text
4. **Code Format Preservation**: Convert extracted Markdown syntax to inline code format in text
5. **Silent Error Handling**: Skip media if files don't exist, continue with text

### Non-Requirements

- Inline media in text messages (Telegram doesn't support)
- Media from external URLs (only local files)
- Video file support (future consideration)

## Architecture

### Module Structure

```
packages/telegram-acp/src/media/
├── markdown-parser.ts    # NEW: Parse Markdown media syntax
├── types.ts              # EXTENDED: Add MediaExtractResult type
├── downloader.ts         # EXISTING
├── uploader.ts           # EXISTING
└── temp-manager.ts       # EXISTING
```

### Key Interfaces

```typescript
// media/types.ts
interface MediaExtractResult {
  media: Array<{
    type: 'image' | 'audio';
    path: string;        // Absolute file path
    syntax: string;      // Original markdown syntax: ![alt](path)
  }>;
  text: string;          // Original text (unchanged)
}

// media/markdown-parser.ts
class MarkdownMediaParser {
  parse(text: string): MediaExtractResult;
  private detectMediaType(path: string): 'image' | 'audio' | null;
  private resolvePath(path: string): string;
}
```

## Implementation

### 1. Markdown Parser

**Responsibility**: Extract media references from Markdown text

**Parsing Rules**:
- Regex: `/!\[([^\]]*)\]\(([^)]+)\)/g`
- Match all `![alt](path)` patterns
- Detect media type by file extension
- Resolve relative paths to absolute
- Deduplicate identical paths

**Code Example**:
```typescript
export class MarkdownMediaParser {
  private readonly IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  private readonly AUDIO_EXTS = ['mp3', 'ogg', 'm4a', 'wav'];

  parse(text: string): MediaExtractResult {
    const media: MediaExtractResult['media'] = [];
    const seen = new Set<string>();

    const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const rawPath = match[2];

      // Skip empty paths
      if (!rawPath || rawPath.trim() === '') continue;

      // Skip external URLs (http/https)
      if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) continue;

      // Deduplicate
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

  private detectMediaType(path: string): 'image' | 'audio' | null {
    const ext = path.split('.').pop()?.toLowerCase();

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

### 2. Client Integration

**Location**: `client.ts` → `handleMessageChunk()`

**Flow**:
1. Agent returns text chunk
2. Accumulate chunks in `this.chunks`
3. Parse full text for Markdown media
4. Send detected media files
5. Convert media syntax to code format
6. Continue with normal text streaming

**Code Example**:
```typescript
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
  }
}
```

### 3. Initialization

**Location**: `bridge.ts`

Add parser to client options:
```typescript
const clientOpts: TelegramAcpClientOpts = {
  // ... existing options
  mediaParser: new MarkdownMediaParser(), // NEW
};
```

## Data Flow

### Success Case

```
1. Agent returns: "Here's the image: ![result](/tmp/output.jpg)"
   ↓
2. Client accumulates text chunks
   ↓
3. MarkdownMediaParser.parse() extracts:
   - media: [{ type: 'image', path: '/tmp/output.jpg', syntax: '![result](/tmp/output.jpg)' }]
   ↓
4. fs.existsSync('/tmp/output.jpg') → true
   ↓
5. onMediaUpload('/tmp/output.jpg', 'image')
   → MediaUploader.uploadImage()
   → Telegram API sends photo
   ↓
6. Convert syntax to code: "Here's the image: `![result](/tmp/output.jpg)`"
   ↓
7. markdownToHtml() converts: "Here's the image: <code>![result](/tmp/output.jpg)</code>"
   ↓
8. Telegram sends text message with code-formatted syntax
```

### Error Case (File Not Found)

```
1. Agent returns: "![missing](/tmp/nonexistent.jpg)"
   ↓
2. Parser extracts media
   ↓
3. fs.existsSync('/tmp/nonexistent.jpg') → false
   ↓
4. Skip media sending, log debug message
   ↓
5. Convert syntax to code: "`![missing](/tmp/nonexistent.jpg)`"
   ↓
6. Send text with code-formatted syntax
```

## User Experience

### What User Sees

**Message 1 (Media)**:
```
📷 [Image file]
```

**Message 2 (Text)**:
```
Here's the generated image: `![result](/tmp/output.jpg)`

The analysis shows...
```

### Benefits

- User receives media immediately
- Original syntax preserved in readable format
- No broken links or error messages
- Clear indication that media was processed

## Error Handling

### File Not Found

- **Detection**: `fs.existsSync(path)` returns false
- **Action**: Skip media sending
- **User Impact**: None (text still delivered with code-formatted syntax)
- **Logging**: Debug level

### Invalid Path Format

- **Detection**: Empty string, null, or external URL
- **Action**: Skip during parsing
- **User Impact**: None
- **Logging**: None

### Upload Failure

- **Detection**: `onMediaUpload()` throws error
- **Action**: Catch and log warning
- **User Impact**: Text still delivered
- **Logging**: Warning level

### Large File

- **Detection**: MediaUploader validates size
- **Action**: Propagate error from Telegram API
- **User Impact**: Error message from MediaUploader
- **Logging**: Warning level

## Testing Strategy

### Unit Tests

**File**: `test/media/markdown-parser.test.ts`

Test cases:
1. ✅ Extract image from `![](path)` syntax
2. ✅ Detect media type by extension (image/audio)
3. ✅ Handle multiple media in single text
4. ✅ Deduplicate identical paths
5. ✅ Skip empty paths
6. ✅ Skip external URLs (http/https)
7. ✅ Resolve relative paths to absolute
8. ✅ Handle file:// URI format
9. ✅ Preserve original text unchanged

### Integration Tests

**File**: `test/integration/media-markdown-flow.test.ts`

Test cases:
1. ✅ Client sends media when markdown detected
2. ✅ Client converts syntax to code format
3. ✅ Client skips non-existent files
4. ✅ Client handles multiple media
5. ✅ Client integrates with MediaUploader

### E2E Tests (Manual)

1. Agent generates image file → Returns path in markdown → User receives image + text
2. Agent references non-existent file → User receives text with code format
3. Agent returns multiple media → User receives all media in order

## Implementation Plan

### New Files

- `src/media/markdown-parser.ts` - Markdown parser implementation
- `test/media/markdown-parser.test.ts` - Unit tests

### Modified Files

- `src/media/types.ts` - Add MediaExtractResult interface
- `src/media/index.ts` - Export MarkdownMediaParser
- `src/client.ts` - Integrate parser in handleMessageChunk
- `src/bridge.ts` - Initialize parser

### Estimated Effort

- Implementation: 2-3 hours
- Testing: 1-2 hours
- Documentation: 30 minutes

**Total**: 3-5 hours

## Success Criteria

1. ✅ Agents can indicate media via Markdown syntax
2. ✅ Media files are automatically sent to Telegram
3. ✅ Text preserves syntax in readable code format
4. ✅ Errors don't block text delivery
5. ✅ All unit and integration tests pass
6. ✅ TypeScript compilation succeeds

## Future Enhancements

1. **File size validation** in parser (before sending to MediaUploader)
2. **Video support** via same syntax
3. **Inline media** support (if Telegram adds feature)
4. **Custom syntax** support (e.g., `[IMAGE:path]` for non-Markdown agents)
5. **Media metadata** extraction (dimensions, duration)
6. **Progressive loading** for large files

## Open Questions

1. **Should we support audio in image syntax?**
   - **Decision**: Yes, use same `![](path)` syntax, detect by extension

2. **How to handle mixed content (text + media)?**
   - **Decision**: Send all media first, then text

3. **Should we validate file exists before parsing?**
   - **Decision**: No, validate during send to avoid race conditions

4. **How to handle paths with spaces?**
   - **Decision**: Markdown parser handles URLs with spaces automatically

## References

- [Telegram Bot API - Sending Photos](https://core.telegram.org/bots/api#sendphoto)
- [Telegram Bot API - Sending Audio](https://core.telegram.org/bots/api#sendaudio)
- [CommonMark Spec - Images](https://spec.commonmark.org/0.30/#images)
- Existing `markdownToHtml()` implementation in `src/streaming/formatting.ts`