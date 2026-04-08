/**
 * Logger utilities for telegram-acp.
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Truncate a string to a maximum length, adding ellipsis if needed.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format tool parameters for display.
 */
export function formatToolParams(params: Record<string, any>): string {
  return JSON.stringify(params, null, 2);
}

/**
 * Check if a log level should be displayed given a threshold.
 * Log levels: error (0), warn (1), info (2), debug (3)
 * Only log if level index <= threshold index
 */
export function shouldLog(level: LogLevel, threshold: LogLevel): boolean {
  const levels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
  return levels.indexOf(level) <= levels.indexOf(threshold);
}
