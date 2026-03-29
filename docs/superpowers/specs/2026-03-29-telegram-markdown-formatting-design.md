# Telegram Markdown Formatting Design

**Date:** 2026-03-29
**Status:** Draft

## Problem

Agent replies are sent as plain text, making code blocks and formatted content difficult to read. Users want structured formatting for better readability.

## Solution

Convert agent Markdown output to Telegram HTML format with fallback to plain text on parse errors.

### Architecture

**Format flow:**
```
Agent output (Markdown)
    ↓
formatForTelegram() - Convert to HTML
    ↓
ctx.reply(text, { parse_mode: "HTML" })
    ↓
On "Cannot parse entities" error → fallback to plain text
```

### Components

**1. `escapeHtml(text: string): string`**

Escape only 3 characters for HTML safety:
- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`

**2. `formatForTelegram(text: string): string`**

Convert Markdown to Telegram HTML:

| Markdown | HTML | Priority |
|----------|------|----------|
| ` ```lang\ncode\n``` ` | `<pre><code>escaped-code</code></pre>` | First (multiline) |
| `` `inline` `` | `<code>escaped-inline</code></code>` | Second |
| `**bold**` | `<b>bold</b>` | Third |
| `*italic*` or `_italic_` | `<i>italic</i>` | Fourth |
| `[text](url)` | `<a href="url">text</a>` | Fifth |

**Processing order matters:** Code blocks must be processed first to prevent their content being modified by later rules.

**Escaping rule:** Only content inside `<code>` and `<pre>` blocks gets HTML-escaped. For links, the URL in `href` attribute is used as-is (Telegram handles URL encoding).

**3. Fallback mechanism in `messageHandler()`**

```typescript
const formattedText = formatForTelegram(replyText);
try {
  await ctx.reply(formattedText, { parse_mode: "HTML" });
} catch (err) {
  // Fallback on parse error
  if (err instanceof GrammyError && err.description?.includes("Cannot parse entities")) {
    await ctx.reply(replyText); // Plain text fallback
  } else {
    throw err;
  }
}
```

### Edge Cases

1. **Nested formatting:** `**`code`**` → Process code first, bold won't apply inside
2. **Broken Markdown:** Unclosed backticks → Treat as plain text, no crash
3. **Empty code blocks:** ` ``` ``` ` → Render as empty `<pre><code></code></pre>`
4. **Links with special chars:** URL with `&` → Escape in href attribute

### Files Changed

- `packages/telegram-acp/src/bot.ts`: Update `formatForTelegram()` and `messageHandler()`

### Testing

Manual verification:
1. Agent sends code block → Renders with background
2. Agent sends inline code → Monospace font
3. Agent sends bold/italic → Styled text
4. Broken markdown → Falls back to plain text
5. Long code block → Telegram truncates gracefully (no error)