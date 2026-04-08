/**
 * Session types and interfaces.
 */

import type { ChildProcess } from "node:child_process";
import type { TelegramAcpClient } from "../client.ts";
import type * as acp from "@agentclientprotocol/sdk";
import type { HealthMonitor } from "../health.ts";
import type { SessionConfig, HistoryConfig } from "../config.ts";
import type { StoredMessage } from "../storage/types.ts";
import type { LogLevel } from "../utils/logger.ts";

export interface UserSession {
  userId: string;
  client: TelegramAcpClient;
  connection: acp.ClientSideConnection;
  sessionId: string;
  process: ChildProcess;
  lastActivity: number;
  healthMonitor: HealthMonitor;
}

export interface RestoredSession {
  session: UserSession;
  hadHistory: boolean;
  messages: StoredMessage[];
}

export interface SessionManagerOpts {
  agentPreset?: string;
  agentCommand: string;
  agentArgs: string[];
  agentCwd: string;
  agentEnv?: Record<string, string>;
  sessionConfig: SessionConfig;
  historyConfig: HistoryConfig;
  showThoughts: boolean;
  log: (msg: string) => void;
  onReply: (userId: string, text: string) => Promise<void>;
  sendTyping: (userId: string) => Promise<void>;
  sendMessage: (userId: string, text: string, parseMode?: 'HTML') => Promise<number>;
  editMessage: (userId: string, msgId: number, text: string, parseMode?: 'HTML') => Promise<number>;
  logLevel?: LogLevel;
  onMediaUpload?: (userId: string, filePath: string, type: 'image' | 'audio') => Promise<void>;
}
