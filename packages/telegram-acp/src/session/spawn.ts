/**
 * Agent process spawning and ACP connection initialization.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { Writable, Readable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';
import { TelegramAcpClient } from '../client.ts';
import packageJson from '../../package.json' with { type: 'json' };

export interface SpawnResult {
  process: ChildProcess;
  connection: acp.ClientSideConnection;
  sessionId: string;
}

export interface SpawnOpts {
  agentCommand: string;
  agentArgs: string[];
  agentCwd: string;
  agentEnv?: Record<string, string>;
  log: (msg: string) => void;
}

/**
 * Spawn agent process and initialize ACP connection.
 */
export async function spawnAgent(userId: string, client: TelegramAcpClient, opts: SpawnOpts): Promise<SpawnResult> {
  const { agentCommand, agentArgs, agentCwd, agentEnv, log } = opts;
  const cmdLine = [agentCommand, ...agentArgs].join(' ');
  log(`[agent] Spawning for ${userId}: ${cmdLine}`);

  const useShell = process.platform === 'win32';
  const proc = spawn(agentCommand, agentArgs, {
    stdio: ['pipe', 'pipe', 'inherit'],
    cwd: agentCwd,
    env: { ...process.env, ...agentEnv },
    shell: useShell,
  });

  proc.on('error', (err) => log(`[agent] Process error: ${String(err)}`));

  if (!proc.stdin || !proc.stdout) {
    proc.kill();
    throw new Error('Failed to get agent process stdio');
  }

  const input = Writable.toWeb(proc.stdin);
  const output = Readable.toWeb(proc.stdout) as ReadableStream<Uint8Array>;
  const stream = acp.ndJsonStream(input, output);
  const connection = new acp.ClientSideConnection(() => client, stream);

  log('[acp] Initializing connection...');
  const initResult = await connection.initialize({
    protocolVersion: acp.PROTOCOL_VERSION,
    clientInfo: {
      name: packageJson.name,
      title: packageJson.name,
      version: packageJson.version,
    },
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true },
    },
  });
  log(`[acp] Initialized v${initResult.protocolVersion}`);

  log('[acp] Creating session...');
  const sessionResult = await connection.newSession({
    cwd: agentCwd,
    mcpServers: [],
  });
  log(`[acp] Session: ${sessionResult.sessionId}`);

  return { process: proc, connection, sessionId: sessionResult.sessionId };
}
