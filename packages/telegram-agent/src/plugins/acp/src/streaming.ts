export interface StreamingMessage {
  id: number;
  text: string;
  status: 'streaming' | 'completed';
}

export class StreamingManager {
  private messages: Map<number, StreamingMessage> = new Map();
  private currentMessageId: number = 0;

  startNewMessage(): number {
    const id = ++this.currentMessageId;
    this.messages.set(id, {
      id,
      text: '',
      status: 'streaming',
    });
    return id;
  }

  appendToMessage(id: number, chunk: string): void {
    const message = this.messages.get(id);
    if (!message) return;
    message.text += chunk;
  }

  completeMessage(id: number): string {
    const message = this.messages.get(id);
    if (!message) return '';
    message.status = 'completed';
    return message.text;
  }

  getMessage(id: number): StreamingMessage | undefined {
    return this.messages.get(id);
  }
}
