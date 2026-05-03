/**
 * Health check and auto-recovery for agent sessions.
 */

import type { ChildProcess } from 'node:child_process';

export interface HealthCheckConfig {
  enabled: boolean;
  intervalMs: number; // Check interval (default: 30000ms)
  timeoutMs: number; // Process response timeout (default: 5000ms)
  maxFailures: number; // Max consecutive failures before recovery (default: 3)
}

export const DEFAULT_HEALTH_CONFIG: HealthCheckConfig = {
  enabled: true,
  intervalMs: 30000,
  timeoutMs: 5000,
  maxFailures: 3,
};

export interface HealthStatus {
  healthy: boolean;
  lastCheck: number;
  consecutiveFailures: number;
  lastError?: string;
}

export type HealthCallback = () => Promise<boolean>;
export type RecoveryCallback = () => Promise<void>;

/**
 * Monitors agent process health and triggers recovery if needed.
 */
export class HealthMonitor {
  private timer: NodeJS.Timeout | null = null;
  private status: HealthStatus = {
    healthy: true,
    lastCheck: 0,
    consecutiveFailures: 0,
  };
  private stopping = false;

  constructor(
    private readonly config: HealthCheckConfig,
    private readonly log: (msg: string) => void,
    private readonly onUnhealthy: () => Promise<void>,
  ) {}

  /**
   * Start periodic health checks.
   */
  start(): void {
    if (!this.config.enabled || this.timer) {
      return;
    }

    this.log('[health] Starting health monitor');
    this.timer = setInterval(() => {
      this.check().catch((err) => {
        this.log(`[health] Check failed: ${String(err)}`);
      });
    }, this.config.intervalMs);

    // Don't block process exit
    this.timer.unref();
  }

  /**
   * Stop health checks.
   */
  stop(): void {
    this.stopping = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.log('[health] Stopped health monitor');
  }

  /**
   * Get current health status.
   */
  getStatus(): HealthStatus {
    return { ...this.status };
  }

  /**
   * Mark as healthy (called on successful operations).
   */
  markHealthy(): void {
    this.status.healthy = true;
    this.status.consecutiveFailures = 0;
    this.status.lastCheck = Date.now();
  }

  /**
   * Mark as unhealthy (called on errors).
   */
  markUnhealthy(error?: string): void {
    this.status.healthy = false;
    this.status.consecutiveFailures++;
    this.status.lastCheck = Date.now();
    this.status.lastError = error;
  }

  /**
   * Perform a health check.
   */
  private async check(): Promise<void> {
    if (this.stopping) return;

    const now = Date.now();

    // If too many consecutive failures, trigger recovery
    if (this.status.consecutiveFailures >= this.config.maxFailures) {
      this.log(`[health] Unhealthy: ${this.status.consecutiveFailures} consecutive failures, triggering recovery`);
      try {
        await this.onUnhealthy();
        this.status.consecutiveFailures = 0;
        this.status.healthy = true;
        this.status.lastError = undefined;
      } catch (err) {
        this.log(`[health] Recovery failed: ${String(err)}`);
      }
    }

    this.status.lastCheck = now;
  }
}

/**
 * Check if a process is alive.
 */
export function isProcessAlive(proc: ChildProcess | null): boolean {
  if (!proc) return false;
  if (proc.killed) return false;

  try {
    // Sending signal 0 checks if process exists without killing it
    process.kill(proc.pid!, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gracefully terminate a process with timeout.
 */
export async function gracefulTerminate(
  proc: ChildProcess,
  timeoutMs: number = 5000,
  log?: (msg: string) => void,
): Promise<void> {
  if (!proc || proc.killed) {
    return;
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      log?.(`[process] Force killing after ${timeoutMs}ms`);
      proc.kill('SIGKILL');
    }, timeoutMs);

    proc.once('exit', (code, signal) => {
      clearTimeout(timeout);
      log?.(`[process] Exited with code=${code ?? '?'}, signal=${signal ?? '?'}`);
      resolve();
    });

    log?.(`[process] Sending SIGTERM`);
    proc.kill('SIGTERM');
  });
}
