// Simple logger for stock services
export class Logger {
  constructor(private context: string) {}
  
  info(message: string, data?: any) {
    console.log(`[${new Date().toISOString()}] [INFO] [${this.context}] ${message}`, data || '');
  }
  
  warn(message: string, data?: any) {
    console.warn(`[${new Date().toISOString()}] [WARN] [${this.context}] ${message}`, data || '');
  }
  
  error(message: string, error?: any) {
    console.error(`[${new Date().toISOString()}] [ERROR] [${this.context}] ${message}`, error || '');
  }
  
  debug(message: string, data?: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[${new Date().toISOString()}] [DEBUG] [${this.context}] ${message}`, data || '');
    }
  }
}