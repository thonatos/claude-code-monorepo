import path from 'path';
import fs from 'fs';
import { Injectable, ScopeEnum } from '@artusx/core';
import { InjectEnum } from './constants';

export interface HistoryEntry {
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

@Injectable({
  id: InjectEnum.HistoryManager,
  scope: ScopeEnum.SINGLETON,
})
export class HistoryManager {
  private historyDir: string | null = null;
  private maxMessages: number | null = null;
  private maxDays: number | null = null;

  init(historyDir: string, maxMessages?: number, maxDays?: number): void {
    this.historyDir = historyDir;
    this.maxMessages = maxMessages ?? null;
    this.maxDays = maxDays ?? null;
  }

  async addEntry(userId: string, entry: HistoryEntry): Promise<void> {
    if (!this.historyDir) {
      throw new Error('HistoryManager not initialized');
    }

    const userDir = path.join(this.historyDir, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    const historyFile = path.join(userDir, 'history.json');
    let history: HistoryEntry[] = [];

    if (fs.existsSync(historyFile)) {
      history = JSON.parse(await fs.promises.readFile(historyFile, 'utf-8'));
    }

    history.push(entry);

    if (this.maxMessages) {
      history = history.slice(-this.maxMessages);
    }

    if (this.maxDays) {
      const cutoff = Date.now() - this.maxDays * 24 * 60 * 60 * 1000;
      history = history.filter(e => new Date(e.timestamp).getTime() > cutoff);
    }

    await fs.promises.writeFile(historyFile, JSON.stringify(history, null, 2));
  }

  async getHistory(userId: string): Promise<HistoryEntry[]> {
    if (!this.historyDir) return [];

    const historyFile = path.join(this.historyDir, userId, 'history.json');
    if (!fs.existsSync(historyFile)) return [];

    return JSON.parse(await fs.promises.readFile(historyFile, 'utf-8'));
  }

  async clearHistory(userId: string): Promise<void> {
    if (!this.historyDir) return;

    const historyFile = path.join(this.historyDir, userId, 'history.json');
    if (fs.existsSync(historyFile)) {
      await fs.promises.unlink(historyFile);
    }
  }
}
