import type { ChildProcess } from 'child_process';

export interface AgentConfig {
  preset?: string;
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  showThoughts: boolean;
}

export interface Session {
  id: string;
  userId: string;
  agentProcess: ChildProcess | null;
  status: 'active' | 'idle' | 'closed';
  agentConfig: AgentConfig;
  createdAt: Date;
  lastActivityAt: Date;
}

export interface SessionConfig {
  idleTimeoutMs: number;
  maxConcurrentUsers: number;
  autoRecover: boolean;
}
