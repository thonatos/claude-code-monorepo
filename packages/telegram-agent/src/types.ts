export interface SendMessageOptions {
  parseMode?: 'HTML' | 'MarkdownV2';
}

export interface TelegramAgentConfig {
  telegram: {
    botToken: string;
  };
  proxy?: string;
  agent: {
    preset?: string;
    command: string;
    args: string[];
    cwd: string;
    env?: Record<string, string>;
    showThoughts: boolean;
  };
  session: {
    idleTimeoutMs: number;
    maxConcurrentUsers: number;
    autoRecover: boolean;
  };
  webhook?: {
    token: string;
    enableAuth: boolean;
  };
  media?: {
    tempDir?: string;
  };
  allowedUsers?: string[];
}

export interface AppConfig {
  artusx: {
    keys: string;
    port: number;
  };
  telegram: TelegramAgentConfig['telegram'];
  agent: TelegramAgentConfig['agent'];
  session: TelegramAgentConfig['session'];
  webhook?: TelegramAgentConfig['webhook'];
  media?: TelegramAgentConfig['media'];
  allowedUsers?: TelegramAgentConfig['allowedUsers'];
}

export interface SendMessageRequest {
  userId: string;
  text: string;
  parseMode?: SendMessageOptions['parseMode'];
}

export interface SendMediaRequest {
  userId: string;
  filePath: string;
  type: 'image' | 'audio';
}

export interface EditMessageRequest {
  userId: string;
  messageId: number;
  text: string;
  parseMode?: SendMessageOptions['parseMode'];
}

export interface SendReactionRequest {
  userId: string;
  messageId: number;
  emoji?: string;
}

export interface WebhookRequest {
  userId: string;
  action: string;
  data: any;
}

export interface WebhookResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface UserSession {
  sessionId: string;
  lastActivity: Date;
}

export type ReactionPhase = "thought" | "tool" | "done";
