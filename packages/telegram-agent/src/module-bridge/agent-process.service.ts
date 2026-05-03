import { type ChildProcess, spawn } from 'node:child_process';
import { Injectable } from '@artusx/core';
import type { TelegramAgentConfig } from '../types';

@Injectable()
export class AgentProcessService {
  private process: ChildProcess | null = null;
  private readonly SHUTDOWN_TIMEOUT_MS = 5000;

  private exitCallbacks: Array<(code: number, signal: string) => void> = [];
  private errorCallbacks: Array<(err: Error) => void> = [];

  get isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  get pid(): number | null {
    return this.process?.pid ?? null;
  }

  spawn(
    config: TelegramAgentConfig['agent'],
    logger?: {
      info: (msg: string) => void;
      warn: (msg: string) => void;
      error: (msg: string) => void;
    },
  ): ChildProcess {
    this.process = spawn(config.command, config.args, {
      cwd: config.cwd || process.cwd(),
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    this.process.on('spawn', () => {
      logger?.info('[process] Agent spawned');
    });

    this.process.on('exit', (code, signal) => {
      logger?.info(`[process] Agent exited (code: ${code}, signal: ${signal})`);
      for (const cb of this.exitCallbacks) {
        cb(code ?? 0, signal ?? 'unknown');
      }
      this.process = null;
    });

    this.process.on('error', (err) => {
      logger?.error(`[process] Agent error: ${err.message}`);
      for (const cb of this.errorCallbacks) {
        cb(err);
      }
    });

    return this.process;
  }

  async gracefulShutdown(logger?: { warn: (msg: string) => void }): Promise<void> {
    if (!this.process || this.process.killed) return;

    this.process.kill('SIGTERM');

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (this.process && !this.process.killed) {
          logger?.warn('[process] Force killing with SIGKILL');
          this.process.kill('SIGKILL');
        }
        resolve();
      }, this.SHUTDOWN_TIMEOUT_MS);

      this.process?.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });

    this.process = null;
  }

  kill(): void {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGKILL');
      this.process = null;
    }
  }

  onExit(callback: (code: number, signal: string) => void): void {
    this.exitCallbacks.push(callback);
  }

  onError(callback: (err: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  get stdin(): NodeJS.WritableStream | null {
    return this.process?.stdin ?? null;
  }

  get stdout(): NodeJS.ReadableStream | null {
    return this.process?.stdout ?? null;
  }
}
