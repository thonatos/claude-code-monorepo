/**
 * Authentication middleware for Telegram bot.
 */

import { Context } from 'grammy';
import type { TelegramAcpConfig } from '../../config.ts';

export function authMiddleware(config: TelegramAcpConfig) {
  return async (ctx: Context, next: () => Promise<void>) => {
    // Skip if no user info
    if (!ctx.from?.id) {
      return;
    }

    const userId = ctx.from.id.toString();

    // Open mode: allow all users
    if (config.open) {
      return next();
    }

    // Check whitelist
    if (config.allowedUsers && !config.allowedUsers.includes(userId)) {
      return;
    }

    // Group chats: reject
    if (ctx.chat?.type !== 'private') {
      return;
    }

    return next();
  };
}
