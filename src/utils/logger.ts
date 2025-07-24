// Winston logger implementation following CLAUDE.md specification
import winston from 'winston';
import { Logger } from '@/types';
import config from '@/config';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += ` | ${JSON.stringify(meta)}`;
    }
    
    // Add stack trace for errors
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    return logMessage;
  })
);

// Create winston logger instance
const winstonLogger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

// Logger implementation that follows our interface
class AppLogger implements Logger {
  error(message: string, ...args: any[]): void {
    if (args.length > 0) {
      winstonLogger.error(message, { metadata: args });
    } else {
      winstonLogger.error(message);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (args.length > 0) {
      winstonLogger.warn(message, { metadata: args });
    } else {
      winstonLogger.warn(message);
    }
  }

  info(message: string, ...args: any[]): void {
    if (args.length > 0) {
      winstonLogger.info(message, { metadata: args });
    } else {
      winstonLogger.info(message);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (args.length > 0) {
      winstonLogger.debug(message, { metadata: args });
    } else {
      winstonLogger.debug(message);
    }
  }
}

// Create and export logger instance
export const logger = new AppLogger();

// Contextual logging helpers
export const createContextLogger = (context: string): Logger => {
  return {
    error: (message: string, ...args: any[]) => {
      logger.error(`[${context}] ${message}`, ...args);
    },
    warn: (message: string, ...args: any[]) => {
      logger.warn(`[${context}] ${message}`, ...args);
    },
    info: (message: string, ...args: any[]) => {
      logger.info(`[${context}] ${message}`, ...args);
    },
    debug: (message: string, ...args: any[]) => {
      logger.debug(`[${context}] ${message}`, ...args);
    }
  };
};

// Structured logging helpers
export const logFeedProcessing = (
  feedId: string, 
  operation: string, 
  metadata?: any
): void => {
  logger.info('Feed processing event', {
    feedId,
    operation,
    metadata,
    timestamp: new Date().toISOString()
  });
};

export const logAIOperation = (
  operation: string,
  model: string,
  duration: number,
  metadata?: any
): void => {
  logger.info('AI operation completed', {
    operation,
    model,
    duration,
    metadata,
    timestamp: new Date().toISOString()
  });
};

export const logQueueOperation = (
  jobId: string,
  jobType: string,
  operation: string,
  metadata?: any
): void => {
  logger.info('Queue operation', {
    jobId,
    jobType,
    operation,
    metadata,
    timestamp: new Date().toISOString()
  });
};

export const logError = (
  error: Error,
  context: string,
  metadata?: any
): void => {
  logger.error(`Error in ${context}`, {
    error: error.message,
    stack: error.stack,
    metadata,
    timestamp: new Date().toISOString()
  });
};

export default logger;