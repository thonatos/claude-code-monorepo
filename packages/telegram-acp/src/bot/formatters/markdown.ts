/**
 * Markdown to Telegram HTML conversion.
 */

import { escapeHtml } from './escape.ts';

/**
 * Convert Markdown to Telegram HTML format.
 * Processes code blocks first to prevent their content from being modified.
 */
export function formatForTelegram(text: string): string {
  // Use placeholders to protect code blocks from further processing
  const codeBlocks: string[] = [];

  // 1. Extract and protect code blocks (multiline) first
  let result = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => {
    const index = codeBlocks.length;
    codeBlocks.push(`<pre><code>${escapeHtml(code)}</code></pre>`);
    return `\x00CODEBLOCK${index}\x00`;
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

  // 6. Restore code blocks
  codeBlocks.forEach((block, index) => {
    result = result.replace(`\x00CODEBLOCK${index}\x00`, block);
  });

  return result.trim();
}
