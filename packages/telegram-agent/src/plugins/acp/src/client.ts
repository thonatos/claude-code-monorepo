import fs from 'fs';
import type * as acp from '@agentclientprotocol/sdk';

export interface ACPClientCallbacks {
  sendMessage: (text: string) => Promise<void>;
  sendTyping: () => Promise<void>;
  onMediaUpload?: (path: string, type: 'image' | 'audio') => Promise<void>;
}

export class ACPClient implements acp.Client {
  private callbacks: ACPClientCallbacks;

  constructor(callbacks: ACPClientCallbacks) {
    this.callbacks = callbacks;
  }

  async requestPermission(params: acp.RequestPermissionRequest): Promise<acp.RequestPermissionResponse> {
    const allowOption = params.options.find(o => o.kind === 'allow_once' || o.kind === 'allow_always');
    const optionId = allowOption?.optionId ?? params.options[0]?.optionId ?? 'allow';

    return {
      outcome: {
        outcome: 'selected',
        optionId,
      },
    };
  }

  async sessionUpdate(params: acp.SessionNotification): Promise<void> {
    const update = params.update;

    switch (update.sessionUpdate) {
      case 'agent_message_chunk':
        await this.handleMessageChunk(update);
        break;
      case 'agent_thought_chunk':
        if ('content' in update && update.content && 'text' in update.content) {
          console.log('[acp-client] Thought:', (update.content as any).text);
        }
        break;
      case 'tool_call':
        await this.callbacks.sendTyping();
        console.log('[acp-client] Tool:', update.title);
        break;
    }
  }

  async readTextFile(params: acp.ReadTextFileRequest): Promise<acp.ReadTextFileResponse> {
    try {
      const content = await fs.promises.readFile(params.path, 'utf-8');
      return { content };
    } catch (err) {
      throw new Error(`Failed to read file ${params.path}: ${String(err)}`);
    }
  }

  async writeTextFile(params: acp.WriteTextFileRequest): Promise<acp.WriteTextFileResponse> {
    try {
      await fs.promises.writeFile(params.path, params.content, 'utf-8');
      return {};
    } catch (err) {
      throw new Error(`Failed to write file ${params.path}: ${String(err)}`);
    }
  }

  private async handleMessageChunk(update: any): Promise<void> {
    if (update.content?.type === 'text') {
      const text = update.content.text;
      await this.callbacks.sendMessage(text);
    } else if (update.content?.type === 'image') {
      const imagePath = update.content.uri || update.content.path;
      if (this.callbacks.onMediaUpload && imagePath) {
        await this.callbacks.onMediaUpload(imagePath, 'image');
      }
    } else if (update.content?.type === 'audio') {
      const audioPath = update.content.uri || update.content.path;
      if (this.callbacks.onMediaUpload && audioPath) {
        await this.callbacks.onMediaUpload(audioPath, 'audio');
      }
    }
  }
}
