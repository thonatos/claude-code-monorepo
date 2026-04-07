/**
 * Metrics collection system for monitoring and observability.
 */

export interface MetricValue {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface Metric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  description?: string;
  values: MetricValue[];
}

export interface MetricsConfig {
  enabled: boolean;
  port?: number;          // Prometheus scrape port (default: 9090)
  prefix?: string;        // Metric name prefix (default: 'telegram_acp')
}

export const DEFAULT_METRICS_CONFIG: MetricsConfig = {
  enabled: true,
  port: 9090,
  prefix: 'telegram_acp',
};

/**
 * Simple metrics collector.
 */
export class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private config: MetricsConfig;
  private startTime: number;

  constructor(config: MetricsConfig = DEFAULT_METRICS_CONFIG) {
    this.config = config;
    this.startTime = Date.now();
  }

  /**
   * Increment a counter.
   */
  increment(metric: string, value: number = 1, labels?: Record<string, string>): void {
    if (!this.config.enabled) return;
    const key = this.buildKey(metric, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  /**
   * Set a gauge value.
   */
  setGauge(metric: string, value: number, labels?: Record<string, string>): void {
    if (!this.config.enabled) return;
    const key = this.buildKey(metric, labels);
    this.gauges.set(key, value);
  }

  /**
   * Record a histogram value.
   */
  record(metric: string, value: number, labels?: Record<string, string>): void {
    if (!this.config.enabled) return;
    const key = this.buildKey(metric, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    // Keep last 1000 values
    if (values.length > 1000) {
      values.shift();
    }
    this.histograms.set(key, values);
  }

  /**
   * Get current counter value.
   */
  getCounter(metric: string, labels?: Record<string, string>): number {
    const key = this.buildKey(metric, labels);
    return this.counters.get(key) || 0;
  }

  /**
   * Get current gauge value.
   */
  getGauge(metric: string, labels?: Record<string, string>): number {
    const key = this.buildKey(metric, labels);
    return this.gauges.get(key) || 0;
  }

  /**
   * Get histogram statistics.
   */
  getHistogramStats(metric: string, labels?: Record<string, string>): {
    min: number;
    max: number;
    mean: number;
    count: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    const key = this.buildKey(metric, labels);
    const values = this.histograms.get(key) || [];
    
    if (values.length === 0) {
      return { min: 0, max: 0, mean: 0, count: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const min = sorted[0];
    const max = sorted[count - 1];
    const mean = values.reduce((a, b) => a + b, 0) / count;
    const p50 = sorted[Math.floor(count * 0.5)];
    const p95 = sorted[Math.floor(count * 0.95)];
    const p99 = sorted[Math.floor(count * 0.99)];

    return { min, max, mean, count, p50, p95, p99 };
  }

  /**
   * Export metrics in Prometheus format.
   */
  exportPrometheus(): string {
    const lines: string[] = [];
    const prefix = this.config.prefix || 'telegram_acp';

    // Process uptime
    const uptime = (Date.now() - this.startTime) / 1000;
    lines.push(`# HELP ${prefix}_process_uptime_seconds Process uptime in seconds`);
    lines.push(`# TYPE ${prefix}_process_uptime_seconds gauge`);
    lines.push(`${prefix}_process_uptime_seconds ${uptime.toFixed(2)}`);

    // Export counters
    for (const [key, value] of this.counters.entries()) {
      const [metric, labels] = this.parseKey(key);
      lines.push(`# HELP ${prefix}_${metric}_total Total count for ${metric}`);
      lines.push(`# TYPE ${prefix}_${metric}_total counter`);
      lines.push(`${prefix}_${metric}_total${labels} ${value}`);
    }

    // Export gauges
    for (const [key, value] of this.gauges.entries()) {
      const [metric, labels] = this.parseKey(key);
      lines.push(`# HELP ${prefix}_${metric} Current value for ${metric}`);
      lines.push(`# TYPE ${prefix}_${metric} gauge`);
      lines.push(`${prefix}_${metric}${labels} ${value}`);
    }

    // Export histogram stats
    for (const [key, values] of this.histograms.entries()) {
      if (values.length === 0) continue;
      
      const [metric, labels] = this.parseKey(key);
      const stats = this.getHistogramStats(metric);

      lines.push(`# HELP ${prefix}_${metric}_seconds Duration in seconds for ${metric}`);
      lines.push(`# TYPE ${prefix}_${metric}_seconds histogram`);
      lines.push(`${prefix}_${metric}_seconds_sum${labels} ${values.reduce((a, b) => a + b, 0).toFixed(3)}`);
      lines.push(`${prefix}_${metric}_seconds_count${labels} ${values.length}`);
      lines.push(`${prefix}_${metric}_seconds_bucket${labels}{le="${stats.min.toFixed(3)}"} 1`);
      lines.push(`${prefix}_${metric}_seconds_bucket${labels}{le="${stats.p50.toFixed(3)}"} ${Math.floor(values.length * 0.5)}`);
      lines.push(`${prefix}_${metric}_seconds_bucket${labels}{le="${stats.p95.toFixed(3)}"} ${Math.floor(values.length * 0.95)}`);
      lines.push(`${prefix}_${metric}_seconds_bucket${labels}{le="${stats.p99.toFixed(3)}"} ${Math.floor(values.length * 0.99)}`);
      lines.push(`${prefix}_${metric}_seconds_bucket${labels}{le="${stats.max.toFixed(3)}"} ${values.length}`);
    }

    return lines.join('\n');
  }

  /**
   * Export metrics as JSON.
   */
  exportJson(): Record<string, any> {
    const result: Record<string, any> = {
      uptime: (Date.now() - this.startTime) / 1000,
      counters: {},
      gauges: {},
      histograms: {},
    };

    for (const [key, value] of this.counters.entries()) {
      result.counters[key] = value;
    }

    for (const [key, value] of this.gauges.entries()) {
      result.gauges[key] = value;
    }

    for (const [key, values] of this.histograms.entries()) {
      result.histograms[key] = this.getHistogramStats(key);
    }

    return result;
  }

  /**
   * Clear all metrics.
   */
  clear(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  // --- Private helpers ---

  private buildKey(metric: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return metric;
    }
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${metric}{${labelStr}}`;
  }

  private parseKey(key: string): [string, string] {
    const match = key.match(/^([^{]+)(\{[^}]+\})?$/);
    if (!match) return [key, ''];
    return [match[1], match[2] || ''];
  }
}

// --- Predefined metrics helpers ---

/**
 * Metrics helper for session operations.
 */
export class SessionMetrics {
  private metrics: MetricsCollector;

  constructor(metrics: MetricsCollector) {
    this.metrics = metrics;
  }

  /**
   * Record session creation.
   */
  recordCreate(preset?: string): void {
    this.metrics.increment('session_create', 1, { preset: preset || 'unknown' });
  }

  /**
   * Record session termination.
   */
  recordTerminate(reason: 'idle' | 'error' | 'manual'): void {
    this.metrics.increment('session_terminate', 1, { reason });
  }

  /**
   * Record session restore.
   */
  recordRestore(hadHistory: boolean): void {
    this.metrics.increment('session_restore', 1, { had_history: hadHistory.toString() });
  }

  /**
   * Record session duration.
   */
  recordDuration(durationMs: number): void {
    this.metrics.record('session_duration', durationMs / 1000);
  }

  /**
   * Update active session count.
   */
  updateActiveCount(count: number): void {
    this.metrics.setGauge('session_active', count);
  }
}

/**
 * Metrics helper for message operations.
 */
export class MessageMetrics {
  private metrics: MetricsCollector;

  constructor(metrics: MetricsCollector) {
    this.metrics = metrics;
  }

  /**
   * Record user message.
   */
  recordUserMessage(isMedia: boolean): void {
    this.metrics.increment('message_user', 1, { type: isMedia ? 'media' : 'text' });
  }

  /**
   * Record agent reply.
   */
  recordAgentReply(tokens?: number): void {
    this.metrics.increment('message_agent', 1);
    if (tokens) {
      this.metrics.record('agent_reply_tokens', tokens);
    }
  }

  /**
   * Record message processing time.
   */
  recordProcessingTime(durationMs: number): void {
    this.metrics.record('message_processing_time', durationMs / 1000);
  }

  /**
   * Record message error.
   */
  recordError(errorType: string): void {
    this.metrics.increment('message_error', 1, { type: errorType });
  }
}

/**
 * Metrics helper for API operations.
 */
export class ApiMetrics {
  private metrics: MetricsCollector;

  constructor(metrics: MetricsCollector) {
    this.metrics = metrics;
  }

  /**
   * Record API call.
   */
  recordCall(api: string, success: boolean): void {
    this.metrics.increment('api_call', 1, { api, success: success.toString() });
  }

  /**
   * Record API call duration.
   */
  recordDuration(api: string, durationMs: number): void {
    this.metrics.record('api_duration', durationMs / 1000, { api });
  }

  /**
   * Record API rate limit hit.
   */
  recordRateLimit(api: string): void {
    this.metrics.increment('api_rate_limit', 1, { api });
  }
}
