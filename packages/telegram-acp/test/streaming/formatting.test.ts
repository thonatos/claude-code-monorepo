import { describe, it, expect } from 'vitest';
import { escapeHtml, markdownToHtml, formatThought, formatThoughtFinal } from '../../src/streaming/formatting.ts';

describe('Formatting', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    it('should escape ampersand', () => {
      expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });
  });

  describe('markdownToHtml', () => {
    it('should convert bold markdown to HTML', () => {
      expect(markdownToHtml('**bold text**')).toBe('<b>bold text</b>');
    });

    it('should convert italic markdown to HTML', () => {
      expect(markdownToHtml('*italic text*')).toBe('<i>italic text</i>');
    });

    it('should convert inline code to HTML', () => {
      expect(markdownToHtml('`code snippet`')).toBe('<code>code snippet</code>');
    });

    it('should convert code blocks to HTML', () => {
      const result = markdownToHtml('```javascript\nconst x = 1;\n```');
      expect(result).toContain('<pre><code>');
      expect(result).toContain('const x = 1;');
    });

    it('should convert links to HTML', () => {
      expect(markdownToHtml('[link text](https://example.com)')).toBe('<a href="https://example.com">link text</a>');
    });
  });

  describe('formatThought', () => {
    it('should format thought with emoji prefix', () => {
      expect(formatThought('thinking...')).toContain('💭 Thinking...');
      expect(formatThought('thinking...')).toContain('thinking...');
    });
  });

  describe('formatThoughtFinal', () => {
    it('should format thought complete message', () => {
      expect(formatThoughtFinal('final thought')).toContain('💭 Thought complete');
    });
  });
});
