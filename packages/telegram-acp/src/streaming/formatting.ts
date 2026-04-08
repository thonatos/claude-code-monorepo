/**
 * Text formatting utilities for Telegram messages.
 */

/**
 * Escape HTML special characters.
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Convert Markdown to HTML for Telegram.
 */
export function markdownToHtml(text: string): string {
  const codeBlocks: string[] = [];

  // Preserve code blocks
  let result = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => {
    const index = codeBlocks.length;
    codeBlocks.push(`<pre><code>${escapeHtml(code)}</code></pre>`);
    return `\x00CODEBLOCK${index}\x00`;
  });

  // Inline code
  result = result.replace(/`([^`]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`);

  // Bold
  result = result.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

  // Italic
  result = result.replace(/\*([^*]+)\*/g, '<i>$1</i>');
  result = result.replace(/_([^_]+)_/g, '<i>$1</i>');

  // Links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Restore code blocks
  codeBlocks.forEach((block, index) => {
    result = result.replace(`\x00CODEBLOCK${index}\x00`, block);
  });

  return result.trim();
}

/**
 * Format thought message for display.
 */
export function formatThought(text: string): string {
  const escaped = escapeHtml(text);
  return `<i>💭 Thinking...</i>\n${escaped}`;
}

/**
 * Format thought final message.
 */
export function formatThoughtFinal(text: string): string {
  const escaped = escapeHtml(text);
  return `<i>💭 Thought complete</i>\n${escaped}`;
}