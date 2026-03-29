# Telegram Markdown Formatting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert agent Markdown output to Telegram HTML format with fallback to plain text on parse errors.

**Architecture:** Add `escapeHtml()` helper, rewrite `formatForTelegram()` to convert Markdown to HTML, update `messageHandler()` to use `parse_mode: "HTML"` with graceful fallback.

**Tech Stack:** grammy, TypeScript, Telegram Bot API (HTML formatting)

---

## Files

| Action | File | Purpose |
|--------|------|---------|
| Create | `packages/telegram-acp/test/format.test.ts` | Unit tests for formatting functions |
| Modify | `packages/telegram-acp/src/bot.ts` | Implement formatting and fallback |

---

### Task 1: Write tests for formatting functions

**Files:**
- Create: `packages/telegram-acp/test/format.test.ts`

- [ ] **Step 1: Create test file with test cases**

```typescript
import { describe, it, expect } from 'vitest';
import { escapeHtml, formatForTelegram } from '../src/bot.ts';

describe('escapeHtml', () => {
  it('should escape special HTML characters', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml('< & >')).toBe('&lt; &amp; &gt;');
  });

  it('should not modify safe text', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
    expect(escapeHtml('code: fn() {}')).toBe('code: fn() {}');
  });
});

describe('formatForTelegram', () => {
  it('should convert bold markdown to HTML', () => {
    expect(formatForTelegram('**bold text**')).toBe('<b>bold text</b>');
  });

  it('should convert italic markdown to HTML', () => {
    expect(formatForTelegram('*italic text*')).toBe('<i>italic text</i>');
    expect(formatForTelegram('_italic text_')).toBe('<i>italic text</i>');
  });

  it('should convert inline code to HTML', () => {
    expect(formatForTelegram('use `console.log` to debug')).toBe('use <code>console.log</code> to debug');
  });

  it('should escape HTML inside inline code', () => {
    expect(formatForTelegram('`<div>` element')).toBe('<code>&lt;div&gt;</code> element');
  });

  it('should convert code blocks to HTML', () => {
    const input = '```js\nconst x = 1;\n```';
    const expected = '<pre><code>const x = 1;\n</code></pre>';
    expect(formatForTelegram(input)).toBe(expected);
  });

  it('should escape HTML inside code blocks', () => {
    const input = '```html\n<div>content</div>\n```';
    const expected = '<pre><code>&lt;div&gt;content&lt;/div&gt;\n</code></pre>';
    expect(formatForTelegram(input)).toBe(expected);
  });

  it('should convert links to HTML', () => {
    expect(formatForTelegram('[grammy](https://grammy.dev)')).toBe('<a href="https://grammy.dev">grammy</a>');
  });

  it('should handle mixed formatting', () => {
    const input = '**bold** and `code` and *italic*';
    const expected = '<b>bold</b> and <code>code</code> and <i>italic</i>';
    expect(formatForTelegram(input)).toBe(expected);
  });

  it('should process code blocks before other formatting', () => {
    // Text inside code blocks should not be processed for bold/italic
    const input = '```\n**not bold**\n```';
    const expected = '<pre><code>**not bold**\n</code></pre>';
    expect(formatForTelegram(input)).toBe(expected);
  });

  it('should handle plain text without modification', () => {
    expect(formatForTelegram('just plain text')).toBe('just plain text');
  });

  it('should trim output', () => {
    expect(formatForTelegram('  text  ')).toBe('text');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/telegram-acp && pnpm run test`
Expected: Tests fail because `escapeHtml` is not exported and `formatForTelegram` has different behavior

---

### Task 2: Implement formatting functions

**Files:**
- Modify: `packages/telegram-acp/src/bot.ts:283-309`

- [ ] **Step 1: Add escapeHtml helper function**

Add after line 283 (after `// --- Helpers ---`):

```typescript
// --- Helpers ---
/**
 * Escape special HTML characters for safe embedding in HTML tags.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
```

- [ ] **Step 2: Replace formatForTelegram function**

Replace the existing `formatForTelegram` function (lines 302-309) with:

```typescript
/**
 * Convert Markdown to Telegram HTML format.
 * Processes code blocks first to prevent their content from being modified.
 */
export function formatForTelegram(text: string): string {
  let result = text;

  // 1. Code blocks (multiline) - must process first
  // Match ```lang\ncode\n``` and convert to <pre><code>escaped</code></pre>
  result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => {
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  });

  // 2. Inline code - `code` → <code>escaped</code>
  result = result.replace(/`([^`]+)`/g, (_, code) => {
    return `<code>${escapeHtml(code)}</code>`;
  });

  // 3. Bold - **text** → <b>text</b>
  result = result.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

  // 4. Italic - *text* or _text_ → <i>text</i>
  result = result.replace(/\*([^*]+)\*/g, '<i>$1</i>');
  result = result.replace(/_([^_]+)_/g, '<i>$1</i>');

  // 5. Links - [text](url) → <a href="url">text</a>
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  return result.trim();
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd packages/telegram-acp && pnpm run test`
Expected: All tests pass

- [ ] **Step 4: Commit changes**

```bash
git add packages/telegram-acp/src/bot.ts packages/telegram-acp/test/format.test.ts
git commit -m "$(cat <<'EOF'
feat(bot): add Markdown to HTML formatting for Telegram

- Add escapeHtml() helper for HTML special characters
- Rewrite formatForTelegram() to convert Markdown to HTML
- Support: bold, italic, inline code, code blocks, links
- Process code blocks first to preserve their content

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add HTML parse mode with fallback

**Files:**
- Modify: `packages/telegram-acp/src/bot.ts:268-274`

- [ ] **Step 1: Update messageHandler to use HTML parse mode with fallback**

Replace the reply logic in `messageHandler` (lines 268-274):

```typescript
    // 5. Clear reaction + send reply
    try {
      await ctx.react([]); // Clear reaction
    } catch {}
    if (replyText.trim()) {
      const formatted = formatForTelegram(replyText);
      try {
        await ctx.reply(formatted, { parse_mode: "HTML" });
      } catch (err) {
        // Fallback to plain text on parse error
        if (err instanceof GrammyError && err.description?.includes("Cannot parse entities")) {
          await ctx.reply(replyText);
        } else {
          throw err;
        }
      }
    }
```

- [ ] **Step 2: Build and verify compilation**

Run: `cd packages/telegram-acp && pnpm run build`
Expected: Build succeeds without errors

- [ ] **Step 3: Commit changes**

```bash
git add packages/telegram-acp/src/bot.ts
git commit -m "$(cat <<'EOF'
feat(bot): use HTML parse mode with fallback for message replies

- Send formatted messages with parse_mode: "HTML"
- Fallback to plain text on "Cannot parse entities" error
- Graceful degradation for broken markdown

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Manual verification

- [ ] **Step 1: Start bot and test formatting**

Run: `cd packages/telegram-acp && pnpm run start -- --preset claude`

- [ ] **Step 2: Verify formatting in Telegram**

Send messages to the bot and verify:
1. Code blocks render with background color
2. Inline code renders with monospace font
3. Bold and italic text styled correctly
4. Links are clickable
5. Plain text messages still work

- [ ] **Step 3: Push changes**

```bash
git push origin main
```