import { spawn, type ChildProcess } from 'child_process';
import { Injectable, ScopeEnum } from '@artusx/core';
import type { AgentConfig } from './types';
import { InjectEnum } from './constants';

@Injectable({
  id: InjectEnum.ProcessManager,
  scope: ScopeEnum.SINGLETON,
})
export class ProcessManager {
  async spawnAgent(config: AgentConfig): Promise<ChildProcess> {
    const childProcess = spawn(config.command, config.args, {
      cwd: config.cwd,
      env: {
        ...process.env,
        ...config.env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    childProcess.on('error', (err: Error) => {
      console.error('[acp-process] Process error:', err);
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[acp-process] stderr:', data.toString());
    });

    return childProcess;
  }

  async killProcess(childProcess: ChildProcess): Promise<void> {
    if (!childProcess.pid) return;

    childProcess.kill('SIGTERM');

    await new Promise<void>((resolve) => {
      childProcess.on('exit', () => resolve());
      setTimeout(() => {
        childProcess.kill('SIGKILL');
        resolve();
      }, 5000);
    });
  }
}
