// Circuit Breaker pattern implementation for resilient service calls
import { Logger } from 'winston';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  monitoringPeriod?: number;
  halfOpenRetries?: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private halfOpenRetries = 0;
  
  private readonly options: Required<CircuitBreakerOptions> = {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    monitoringPeriod: 60000, // 1 minute
    halfOpenRetries: 3
  };

  constructor(
    private name: string,
    private logger: Logger,
    options?: CircuitBreakerOptions
  ) {
    if (options) {
      this.options = { ...this.options, ...options };
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (!this.shouldAttemptReset()) {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
      this.state = CircuitState.HALF_OPEN;
      this.halfOpenRetries = 0;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.options.resetTimeout;
  }

  private onSuccess(): void {
    this.successCount++;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenRetries++;
      if (this.halfOpenRetries >= this.options.halfOpenRetries) {
        this.reset();
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.trip();
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.trip();
    }
  }

  private trip(): void {
    this.state = CircuitState.OPEN;
    this.logger.warn(`Circuit breaker ${this.name} tripped to OPEN state`, {
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    });
  }

  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenRetries = 0;
    this.logger.info(`Circuit breaker ${this.name} reset to CLOSED state`);
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Factory function for creating circuit breakers
export const createCircuitBreaker = (
  name: string,
  logger: Logger,
  options?: CircuitBreakerOptions
): CircuitBreaker => {
  return new CircuitBreaker(name, logger, options);
};