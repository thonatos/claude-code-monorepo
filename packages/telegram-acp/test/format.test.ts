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