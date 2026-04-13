export interface TelegramMessage {
  userId: string;
  text?: string;
  photo?: any;
  audio?: any;
  messageId: number;
}
