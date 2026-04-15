export interface AgentConfig {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  showThoughts?: boolean;
}

export interface ACPClientOpts {
  sendMessage: (text: string) => Promise<number>;
  editMessage: (msgId: number, text: string) => Promise<void>;
  removeReaction?: (msgId: number) => Promise<void>;
  sendTyping?: () => Promise<void>;
  onThoughtFlush?: (text: string) => Promise<void>;
  onMessageFlush?: (text: string) => Promise<void>;
  onMediaUpload?: (path: string, type: 'image' | 'audio') => Promise<void>;
  showThoughts?: boolean;
}

export interface ACPPluginConfig {
  agent: AgentConfig;
}
