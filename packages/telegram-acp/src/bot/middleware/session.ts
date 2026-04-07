/**
 * Session middleware for Telegram bot.
 */

import { Context } from "grammy";
import type { SessionManager, UserSession } from "../../session.ts";

interface AcpContext extends Context {
  session: UserSession;
  sessionManager: SessionManager;
}

export function sessionMiddleware(sessionManager: SessionManager) {
  return async (ctx: Context, next: () => Promise<void>) => {
    const userId = ctx.from?.id.toString();
    if (!userId) {
      return;
    }

    // Get or create session
    const session = await sessionManager.getOrCreate(userId);

    // Attach to context
    const acpCtx = ctx as AcpContext;
    acpCtx.session = session;
    acpCtx.sessionManager = sessionManager;

    return next();
  };
}

export type { AcpContext };
