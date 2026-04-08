import { describe, it, expect } from 'vitest';
import { truncate, shouldLog } from '../../src/utils/logger.ts';

describe('truncate', () => {
  it('should truncate long strings with ellipsis', () => {
    const longText = 'This is a very long string that exceeds the limit';
    const result = truncate(longText, 20);
    expect(result).toBe('This is a very lo...');
  });

  it('should not truncate short strings', () => {
    const shortText = 'Short text';
    const result = truncate(shortText, 20);
    expect(result).toBe('Short text');
  });

  it('should handle empty strings', () => {
    const result = truncate('', 20);
    expect(result).toBe('');
  });
});

describe('shouldLog', () => {
  it('should allow debug when threshold is debug', () => {
    expect(shouldLog('debug', 'debug')).toBe(true);
  });

  it('should block debug when threshold is info', () => {
    expect(shouldLog('debug', 'info')).toBe(false);
  });

  it('should allow info when threshold is info', () => {
    expect(shouldLog('info', 'info')).toBe(true);
  });

  it('should block info when threshold is warn', () => {
    expect(shouldLog('info', 'warn')).toBe(false);
  });

  it('should allow error at all thresholds', () => {
    expect(shouldLog('error', 'info')).toBe(true);
    expect(shouldLog('error', 'warn')).toBe(true);
    expect(shouldLog('error', 'error')).toBe(true);
  });
});
