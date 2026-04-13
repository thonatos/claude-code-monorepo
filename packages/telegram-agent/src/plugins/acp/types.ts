export interface AgentConfig {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  showThoughts?: boolean;
}

export interface ACPClientOpts {
  sendMessage: (text: string, parseMode?: 'HTML') => Promise<number>;
  editMessage: (msgId: number, text: string, parseMode?: 'HTML') => Promise<number>;
  sendTyping?: () => Promise<void>;
  onThoughtFlush?: (text: string) => Promise<void>;
  onMediaUpload?: (path: string, type: 'image' | 'audio') => Promise<void>;
  log?: (msg: string) => void;
  showThoughts?: boolean;
}

export interface ACPPluginConfig {
  agent: AgentConfig;
}
