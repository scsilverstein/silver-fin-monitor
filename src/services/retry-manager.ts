// Retry manager with exponential backoff
export interface RetryConfig {
  maxRetries: number;
  backoff: 'exponential' | 'linear' | 'fixed';
  delay: number;
  maxDelay?: number;
}

export class RetryManager {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === config.maxRetries) {
          throw error;
        }
        
        const delay = this.calculateDelay(attempt, config);
        await this.sleep(delay);
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }
  
  private calculateDelay(attempt: number, config: RetryConfig): number {
    switch (config.backoff) {
      case 'exponential':
        return Math.min(
          config.delay * Math.pow(2, attempt),
          config.maxDelay || 60000
        );
      case 'linear':
        return config.delay * (attempt + 1);
      case 'fixed':
      default:
        return config.delay;
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}