export interface SendMessageRequest {
  userId: string;
  text: string;
  parseMode?: 'HTML' | 'Markdown';
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
  parseMode?: 'HTML' | 'Markdown';
}

export interface SendReactionRequest {
  userId: string;
  messageId: number;
  emoji: string;
}
