export interface UserMessage {
  text?: string;
  photo?: any;
  audio?: any;
}

export interface AgentReply {
  type: 'text' | 'media';
  content: string;
  mediaType?: 'image' | 'audio';
}

export interface WebhookRequest {
  action: 'send-message' | 'send-media' | 'edit-message' | 'send-reaction';
  userId: string;
  data: any;
}
