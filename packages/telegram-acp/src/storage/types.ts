/**
 * Storage types and interfaces.
 */

export type SessionStatus = 'active' | 'inactive' | 'terminated';

export interface StoredMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
}

export interface StoredSession {
  userId: string;
  sessionId: string;
  agentConfig: {
    preset?: string;
    command: string;
    args: string[];
    cwd: string;
  };
  createdAt: number;
  lastActivity: number;
  status: SessionStatus;
  messages: StoredMessage[];
}

export interface StorageBackend {
  save(session: StoredSession): Promise<void>;
  load(userId: string, sessionId: string): Promise<StoredSession | null>;
  loadRestorable(userId: string): Promise<StoredSession | null>;
  list(userId: string): Promise<StoredSession[]>;
  updateStatus(userId: string, sessionId: string, status: SessionStatus): Promise<void>;
  clearHistory(userId: string, sessionId: string): Promise<void>;
  markTerminated(userId: string, sessionId: string): Promise<void>;
  delete(userId: string, sessionId: string): Promise<void>;
  stop(): void;
}