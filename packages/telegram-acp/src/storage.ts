/**
 * Storage types and service for session persistence.
 */

export type SessionStatus = 'active' | 'inactive' | 'terminated';

export interface StoredMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: number;  // Unix timestamp (ms)
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