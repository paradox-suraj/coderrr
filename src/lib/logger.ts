/**
 * Structured JSON logger with correlation ID support.
 *
 * Usage:
 *   const log = createLogger(correlationId);
 *   log.info('job.start', { jobId, language });
 *   log.error('job.failed', { error: err.message });
 */

export interface LogEntry {
  ts: string;
  level: 'info' | 'warn' | 'error';
  event: string;
  correlationId: string;
  [key: string]: unknown;
}

export interface Logger {
  info(event: string, meta?: Record<string, unknown>): void;
  warn(event: string, meta?: Record<string, unknown>): void;
  error(event: string, meta?: Record<string, unknown>): void;
}

export function createLogger(correlationId: string): Logger {
  function emit(level: LogEntry['level'], event: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      event,
      correlationId,
      ...meta,
    };
    const line = JSON.stringify(entry);
    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  return {
    info: (event, meta) => emit('info', event, meta),
    warn: (event, meta) => emit('warn', event, meta),
    error: (event, meta) => emit('error', event, meta),
  };
}

/** Generate or extract a correlation ID from a request's headers. */
export function getCorrelationId(headers: Headers): string {
  return headers.get('x-request-id') || headers.get('x-correlation-id') || crypto.randomUUID();
}
