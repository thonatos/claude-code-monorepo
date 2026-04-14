import { Readable, Writable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";
import { ArtusInjectEnum, Inject, Injectable } from "@artusx/core";
import type { ArtusApplication } from "@artusx/core";
import { BotService } from "../module-bot/bot.service";
import { MediaHandler } from "../module-bot/media.handler";
import { AuthService } from "../module-auth/auth.service";
import { AgentProcessManager } from "./agent-process-manager";
import { type ACPClient, InjectEnum as ACPInjectEnum } from "../plugins/acp";
import type { WebhookRequest, UserSession, AppConfig } from "../types";

@Injectable()
export class BridgeService {
  @Inject(ArtusInjectEnum.Application)
  app!: ArtusApplication;

  @Inject(ArtusInjectEnum.Config)
  config!: AppConfig;

  @Inject(BotService)
  botService!: BotService;

  @Inject(MediaHandler)
  mediaHandler!: MediaHandler;

  @Inject(ACPInjectEnum.ACPClient)
  acpClient!: ACPClient;

  @Inject(AuthService)
  authService!: AuthService;

  @Inject(AgentProcessManager)
  processManager!: AgentProcessManager;

  // Session management (will be used in subsequent tasks)
  private sessions: Map<string, UserSession> = new Map();
  private connections: Map<string, acp.ClientSideConnection> = new Map();
  private readonly MAX_CONCURRENT_USERS: number;

  constructor() {
    this.MAX_CONCURRENT_USERS = 10;
    // Silence TypeScript unused variable warnings - these will be used in subsequent tasks
    void this.sessions;
    void this.connections;
    void this.MAX_CONCURRENT_USERS;
    void this.logger;
    void this.processManager;
    void this.ensureUserSession;
  }

  private get logger() {
    return {
      info: (msg: string) => console.log(msg),
      warn: (msg: string) => console.warn(msg),
      error: (msg: string) => console.error(msg),
    };
  }

  /**
   * Ensure user session exists, create if needed
   */
  private async ensureUserSession(userId: string): Promise<UserSession> {
    const existing = this.sessions.get(userId);
    if (existing) {
      existing.lastActivity = new Date();
      return existing;
    }

    // Check concurrent limit
    const maxUsers = this.config.session?.maxConcurrentUsers ?? this.MAX_CONCURRENT_USERS;
    if (this.sessions.size >= maxUsers) {
      throw new Error(`Maximum concurrent users (${maxUsers}) reached`);
    }

    // Create new session
    const session: UserSession = {
      sessionId: `${userId}-${Date.now()}`,
      lastActivity: new Date(),
    };
    this.sessions.set(userId, session);
    this.logger.info(`[bridge] Created session for user ${userId}`);
    return session;
  }

  /**
   * Close user session and cleanup resources
   */
  async closeUserSession(userId: string): Promise<void> {
    const connection = this.connections.get(userId);
    if (connection) {
      this.connections.delete(userId);
    }
    this.sessions.delete(userId);
    this.logger.info(`[bridge] Closed session for user ${userId}`);
  }

  async ensureConnection(userId: string): Promise<void> {
    // Check for existing connection
    if (this.connections.has(userId)) return;

    const session = await this.ensureUserSession(userId);
    const agentConfig = this.config.agent;

    this.logger.info(`[bridge] Initializing connection for user ${userId}`);

    // Initialize client callbacks
    this.acpClient.init({
      sendMessage: async (text: string) => {
        return await this.botService.sendMessage(userId, text);
      },
      editMessage: async (msgId: number, text: string) => {
        await this.botService.editMessage(userId, msgId, text);
      },
      removeReaction: async (msgId: number) => {
        await this.botService.removeReaction(userId, msgId);
      },
      sendTyping: async () => {
        await this.botService.sendTyping(userId);
      },
      onMediaUpload: async (path: string, type: "image" | "audio") => {
        if (type === "image") {
          await this.mediaHandler.uploadPhoto(userId, path);
        } else {
          await this.mediaHandler.uploadAudio(userId, path);
        }
      },
      showThoughts: agentConfig.showThoughts,
    });

    // Spawn agent process using ProcessManager
    const agentProcess = this.processManager.spawn(agentConfig, this.logger);

    // Verify streams exist
    if (!agentProcess.stdin || !agentProcess.stdout) {
      throw new Error("Failed to create agent process streams");
    }

    // Create streams
    const input = Writable.toWeb(agentProcess.stdin);
    const output = Readable.toWeb(agentProcess.stdout);

    // Create the connection
    const stream = acp.ndJsonStream(input, output);
    const connection = new acp.ClientSideConnection((_agent) => this.acpClient, stream);

    // Initialize
    const initResult = await connection.initialize({
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: {
        fs: {
          readTextFile: true,
          writeTextFile: true,
        },
      },
    });

    this.logger.info(`[bridge] Connected to agent (protocol v${initResult.protocolVersion})`);

    // Create session
    const sessionResult = await connection.newSession({
      cwd: agentConfig.cwd || process.cwd(),
      mcpServers: [],
    });

    session.sessionId = sessionResult.sessionId;
    this.connections.set(userId, connection);

    // TODO: Remove these legacy field assignments after subsequent refactoring
    // These are kept temporarily for compatibility with handleUserMessage/sendPrompt
    this.connection = connection;
    this.currentSessionId = sessionResult.sessionId;
  }

  // Legacy fields - will be removed in subsequent refactoring
  private connection: acp.ClientSideConnection | null = null;
  private currentSessionId: string | null = null;

  async handleUserMessage(userId: string, message: any): Promise<void> {
    await this.ensureConnection(userId);

    if (!this.connection || !this.currentSessionId) {
      throw new Error("Connection not initialized");
    }

    // Set user message ID for reaction tracking
    if (message.message_id) {
      this.acpClient.setUserMessageId(message.message_id);
    }

    // Reset message state
    this.acpClient.reset();

    if (message.photo) {
      const filePath = await this.mediaHandler.downloadPhoto(userId, message.photo);
      await this.sendPrompt(`User sent image: ${filePath}`);
    } else if (message.text) {
      await this.botService.sendReaction(userId, message.message_id);
      await this.sendPrompt(message.text);
    }
  }

  private async sendPrompt(prompt: string): Promise<void> {
    if (!this.connection || !this.currentSessionId) return;

    await this.connection.prompt({
      sessionId: this.currentSessionId,
      prompt: [
        {
          type: "text",
          text: prompt,
        },
      ],
    });
  }

  async handleWebhookRequest(request: WebhookRequest): Promise<any> {
    const { userId, action, data } = request;

    switch (action) {
      case "send-message":
        return await this.botService.sendMessage(userId, data.text, data.options);
      case "send-media":
        if (data.type === "image") {
          return await this.mediaHandler.uploadPhoto(userId, data.filePath);
        } else {
          return await this.mediaHandler.uploadAudio(userId, data.filePath);
        }
      case "edit-message":
        return await this.botService.editMessage(userId, data.messageId, data.text, data.options);
      case "send-reaction":
        return await this.botService.sendReaction(userId, data.messageId);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async close(): Promise<void> {
    this.logger.info("[bridge] Closing all connections...");

    // Close all user sessions
    for (const userId of this.sessions.keys()) {
      await this.closeUserSession(userId);
    }

    // Graceful shutdown of agent process
    await this.processManager.gracefulShutdown(this.logger);

    this.sessions.clear();
    this.connections.clear();
    this.acpClient.reset();

    this.logger.info("[bridge] All connections closed");
  }
}
