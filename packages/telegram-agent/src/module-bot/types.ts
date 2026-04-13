export interface SendMessageOptions {
  parseMode?: 'HTML' | 'Markdown';
}

export interface SendMediaOptions {
  type: 'image' | 'audio';
}

export interface ReactionOptions {
  emoji: string;
}
