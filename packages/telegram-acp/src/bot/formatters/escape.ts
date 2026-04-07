/**
 * HTML escaping utilities for Telegram messages.
 */

/**
 * Escape special HTML characters for safe embedding in HTML tags.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
