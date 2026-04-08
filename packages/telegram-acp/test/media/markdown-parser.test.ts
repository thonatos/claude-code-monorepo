// packages/telegram-acp/test/media/markdown-parser.test.ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
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

  it('should detect audio by extension', () => {
    const result = parser.parse('![audio](/tmp/test.mp3)');

    expect(result.media).toHaveLength(1);
    expect(result.media[0].type).toBe('audio');
    expect(result.media[0].path).toBe('/tmp/test.mp3');
  });

  it('should handle multiple media', () => {
    const result = parser.parse('First ![a](/tmp/x.jpg) and ![b](/tmp/y.png)');

    expect(result.media).toHaveLength(2);
    expect(result.media[0].path).toBe('/tmp/x.jpg');
    expect(result.media[1].path).toBe('/tmp/y.png');
  });

  it('should deduplicate same paths', () => {
    const result = parser.parse('![a](/tmp/x.jpg) and ![b](/tmp/x.jpg)');

    expect(result.media).toHaveLength(1);
    expect(result.media[0].path).toBe('/tmp/x.jpg');
  });

  it('should skip empty paths and external URLs', () => {
    const result = parser.parse('![a]() and ![b](http://example.com/img.jpg)');

    expect(result.media).toHaveLength(0);
  });

  it('should skip non-media extensions', () => {
    const result = parser.parse('![doc](/tmp/file.pdf)');

    expect(result.media).toHaveLength(0);
  });

  it('should resolve relative paths', () => {
    const result = parser.parse('![img](./test.jpg)');

    expect(result.media).toHaveLength(1);
    expect(path.isAbsolute(result.media[0].path)).toBe(true);
    expect(result.media[0].path).toContain('test.jpg');
  });
});