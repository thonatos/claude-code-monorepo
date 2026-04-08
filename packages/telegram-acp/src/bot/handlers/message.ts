/**
 * Message handler for Telegram bot.
 */

import { Context } from "grammy";
import type * as acp from "@agentclientprotocol/sdk";
import type { AcpContext } from "../middleware/session.ts";
import type { HistoryInjector } from "../../history.ts";
import type { MediaInfo, MediaDownloadResult } from "../../media/types.ts";
import { MediaDownloader, TempFileManager } from "../../media/index.ts";
import type { ReactionPhase } from "../../reaction/types.ts";
import { ReactionManager, DEFAULT_EMOJI_MAP } from "../../reaction/index.ts";
import fs from "node:fs";

export interface MessageHandlerModules {
  downloader: MediaDownloader;
  tempManager: TempFileManager;
}

export function createMessageHandler(
  historyInjector: HistoryInjector,
  modules?: MessageHandlerModules
) {
  return async (ctx: Context) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const acpCtx = ctx as AcpContext;
    const messageId = ctx.message?.message_id;

    // Create per-message ReactionManager with ctx.react() callback
    // Cast emoji to the proper type for grammy
    const reactionManager = new ReactionManager(async (emoji: string) => {
      try {
        if (emoji === '') {
          await ctx.react([]); // Clear reaction
        } else {
          // Cast to any to satisfy grammy's strict emoji type
          await ctx.react(emoji as any);
        }
      } catch {
        // Best-effort - don't block if fails
      }
    });

    // 1. React with acknowledgment
    try {
      await ctx.react("👀");
    } catch {
      // Best-effort - don't block if fails
    }

    // 2. Extract message content
    let prompt = extractPrompt(ctx);
    const mediaInfo = modules ? extractMediaInfo(ctx) : null;

    // 3. Handle media download
    let mediaResult: MediaDownloadResult | null = null;
    if (mediaInfo && modules?.downloader) {
      try {
        await reactionManager.setReaction('media_in');
        mediaResult = await modules.downloader.downloadToTemp(userId, mediaInfo);
      } catch (err) {
        console.warn(`[message] Media download failed: ${String(err)}`);
        prompt += `\n[Media unavailable: ${String(err)}]`;
      }
    }

    // 4. Inject history if needed
    const cachedMessages = historyInjector.getCachedMessages(userId);
    if (cachedMessages && cachedMessages.length > 0 && !historyInjector.hasInjected(userId)) {
      historyInjector.markInjected(userId, cachedMessages);
      prompt = historyInjector.buildContext(cachedMessages, prompt);
    }

    // 5. Record user message
    await acpCtx.sessionManager.recordMessage(userId, 'user', prompt);

    // 6. Update reaction based on content type
    try {
      await reactionManager.setReaction('thought');
    } catch {
      // Best-effort
    }

    // 7. Build ACP prompt with media
    const content: acp.ContentBlock[] = [];

    // Add text
    if (prompt) {
      content.push({ type: "text", text: prompt });
    }

    // Add media (image/audio)
    if (mediaResult && mediaResult.type === 'image') {
      // ImageContent supports uri property
      content.push({
        type: "image",
        data: "", // Base64 data (empty for local file approach via uri)
        mimeType: mediaResult.mimeType,
        uri: mediaResult.path, // Agent can access via readTextFile
      });
    } else if (mediaResult && mediaResult.type === 'audio') {
      // AudioContent doesn't support uri, need to use base64 data
      try {
        const audioBuffer = await fs.promises.readFile(mediaResult.path);
        const base64Data = audioBuffer.toString('base64');
        content.push({
          type: "audio",
          data: base64Data,
          mimeType: mediaResult.mimeType,
        });
      } catch (err) {
        console.warn(`[message] Failed to encode audio: ${String(err)}`);
        prompt += `\n[Audio encoding failed: ${String(err)}]`;
      }
    }

    const session = acpCtx.session;

    // Store reaction manager for client callbacks
    if (session.client) {
      session.client.updateReactionCallback(async (phase: ReactionPhase) => {
        await reactionManager.setReaction(phase);
      });
    }

    try {
      // Reset streaming state for new prompt
      session.client.reset();

      // Mark session as healthy
      session.healthMonitor.markHealthy();

      // 8. Send prompt to ACP agent
      const result = await session.connection.prompt({
        sessionId: session.sessionId,
        prompt: content,
      });

      // Collect agent reply
      let replyText = await session.client.flush();

      // Handle stop reasons
      if (result.stopReason === "cancelled") {
        replyText += "\n[cancelled]";
      } else if (result.stopReason === "refusal") {
        replyText += "\n[agent refused]";
      }

      // Record agent reply
      await acpCtx.sessionManager.recordMessage(userId, 'agent', replyText);

      // 9. Show done reaction and clear
      try {
        await reactionManager.setReaction('done');
        await new Promise(r => setTimeout(r, 500)); // Show done for 500ms
        await reactionManager.clearReaction();
      } catch {}

      // 10. Schedule temp file cleanup
      if (mediaResult && modules?.tempManager) {
        modules.tempManager.scheduleCleanup(userId, 60000);
      }
    } catch (err) {
      // Mark as unhealthy
      session.healthMonitor.markUnhealthy(String(err));

      try {
        await reactionManager.clearReaction();
      } catch {}
      await ctx.reply(`⚠️ Error: ${String(err)}`);
    }
  };
}

// --- Helpers ---

function extractPrompt(ctx: Context): string {
  const msg = ctx.message;

  if (msg?.text) return msg.text;
  if (msg?.photo) return msg.caption ?? `[Photo]`;
  if (msg?.animation) return msg.caption ?? `[GIF]`;
  if (msg?.video) return msg.caption ?? `[Video]`;
  if (msg?.audio) return msg.caption ?? `[Audio]`;
  if (msg?.voice) return `[Voice message]`;
  if (msg?.document) return msg.caption ?? `[Document]`;
  return `[Unknown]`;
}

function extractMediaInfo(ctx: Context): MediaInfo | null {
  const msg = ctx.message;

  if (msg?.photo) {
    const largest = msg.photo[msg.photo.length - 1]; // Get largest photo
    return {
      type: 'image',
      fileId: largest.file_id,
      mimeType: 'image/jpeg',
      fileSize: largest.file_size,
    };
  }

  if (msg?.audio) {
    return {
      type: 'audio',
      fileId: msg.audio.file_id,
      mimeType: msg.audio.mime_type ?? 'audio/mpeg',
      fileSize: msg.audio.file_size,
    };
  }

  if (msg?.voice) {
    return {
      type: 'audio',
      fileId: msg.voice.file_id,
      mimeType: msg.voice.mime_type ?? 'audio/ogg',
      fileSize: msg.voice.file_size,
    };
  }

  return null;
}