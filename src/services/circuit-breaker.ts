// Simple circuit breaker implementation
interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod?: number;
}

export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private name: string;
  
  constructor(config: CircuitBreakerConfig) {
    this.name = config.name;
    this.failureThreshold = config.failureThreshold;
    this.resetTimeout = config.resetTimeout;
  }
  
  private failureThreshold: number;
  private resetTimeout: number;
  
  async fire<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const now = Date.now();
      if (now - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await operation();
      if (this.state === 'half-open') {
        this.reset();
      }
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
  
  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }
  
  private reset(): void {
    this.failureCount = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }
  
  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }
  
  isOpen(): boolean {
    return this.state === 'open';
  }
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return this.fire(operation);
  }
}