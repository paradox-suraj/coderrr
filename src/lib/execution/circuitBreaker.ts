/**
 * CircuitBreaker — wraps an async operation and tracks its health.
 *
 * States:
 *   CLOSED   — normal operation, all calls go through.
 *   OPEN     — sandbox is unhealthy; new calls fast-fail immediately.
 *   HALF_OPEN — one probe call is allowed through to test recovery.
 *
 * Transitions:
 *   CLOSED → OPEN      : FAILURE_THRESHOLD consecutive failures
 *   OPEN   → HALF_OPEN : after RECOVERY_TIMEOUT_MS
 *   HALF_OPEN → CLOSED : probe succeeds
 *   HALF_OPEN → OPEN   : probe fails
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitHealth {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  totalCalls: number;
  totalFailures: number;
}

interface CircuitBreakerOptions {
  /** Consecutive failures before opening the circuit. Default: 3 */
  failureThreshold?: number;
  /** Milliseconds to wait before moving OPEN → HALF_OPEN. Default: 30_000 */
  recoveryTimeoutMs?: number;
  /** Name used in logs. */
  name?: string;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureAt: number | null = null;
  private lastSuccessAt: number | null = null;
  private totalCalls = 0;
  private totalFailures = 0;
  private halfOpenInFlight = false;

  private readonly failureThreshold: number;
  private readonly recoveryTimeoutMs: number;
  private readonly name: string;

  constructor(opts: CircuitBreakerOptions = {}) {
    this.failureThreshold = opts.failureThreshold ?? 3;
    this.recoveryTimeoutMs = opts.recoveryTimeoutMs ?? 30_000;
    this.name = opts.name ?? 'circuit';
  }

  /**
   * Wrap an async call. Throws `CircuitOpenError` when the circuit is OPEN.
   */
  async call<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    if (this.state === 'OPEN') {
      const elapsed = Date.now() - (this.lastFailureAt ?? 0);
      if (elapsed >= this.recoveryTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.halfOpenInFlight = false;
      } else {
        throw new CircuitOpenError(
          `[${this.name}] Circuit is OPEN — sandbox unhealthy. Retry after ${Math.ceil((this.recoveryTimeoutMs - elapsed) / 1000)}s.`
        );
      }
    }

    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenInFlight) {
        // Only allow one probe at a time in HALF_OPEN
        throw new CircuitOpenError(
          `[${this.name}] Circuit is HALF_OPEN — probe already in flight. Please retry shortly.`
        );
      }
      this.halfOpenInFlight = true;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      if (err instanceof CircuitOpenError) throw err;
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.successCount++;
    this.lastSuccessAt = Date.now();
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.halfOpenInFlight = false;
      console.info(`[circuit:${this.name}] HALF_OPEN probe succeeded — circuit CLOSED`);
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.totalFailures++;
    this.lastFailureAt = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.halfOpenInFlight = false;
      console.warn(`[circuit:${this.name}] HALF_OPEN probe failed — circuit re-OPENED`);
      return;
    }

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.warn(
        `[circuit:${this.name}] ${this.failureCount} consecutive failures — circuit OPENED. Will probe after ${this.recoveryTimeoutMs}ms.`
      );
    }
  }

  getHealth(): CircuitHealth {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureAt: this.lastFailureAt,
      lastSuccessAt: this.lastSuccessAt,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
    };
  }

  /** Reset for testing purposes only. */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureAt = null;
    this.lastSuccessAt = null;
    this.totalCalls = 0;
    this.totalFailures = 0;
    this.halfOpenInFlight = false;
  }
}

export class CircuitOpenError extends Error {
  readonly code = 'CIRCUIT_OPEN';
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}
