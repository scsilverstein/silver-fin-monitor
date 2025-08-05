import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '@/utils/logger';
import { EventEmitter } from 'events';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  role?: string;
}

export enum WebSocketEvent {
  // Feed events
  FEED_PROCESSING_STARTED = 'feed:processing:started',
  FEED_PROCESSING_COMPLETED = 'feed:processing:completed',
  FEED_PROCESSING_FAILED = 'feed:processing:failed',
  FEED_CONTENT_PROCESSED = 'feed:content:processed',
  
  // Analysis events
  ANALYSIS_STARTED = 'analysis:started',
  ANALYSIS_PROGRESS = 'analysis:progress',
  ANALYSIS_COMPLETED = 'analysis:completed',
  ANALYSIS_FAILED = 'analysis:failed',
  
  // Prediction events
  PREDICTION_GENERATED = 'prediction:generated',
  PREDICTION_EVALUATED = 'prediction:evaluated',
  
  // Stock scanner events
  STOCK_SCANNER_STARTED = 'stock:scanner:started',
  STOCK_SCANNER_PROGRESS = 'stock:scanner:progress',
  STOCK_SCANNER_COMPLETED = 'stock:scanner:completed',
  STOCK_ALERT = 'stock:alert',
  
  // Queue events
  QUEUE_JOB_ADDED = 'queue:job:added',
  QUEUE_JOB_STARTED = 'queue:job:started',
  QUEUE_JOB_COMPLETED = 'queue:job:completed',
  QUEUE_JOB_FAILED = 'queue:job:failed',
  
  // System events
  SYSTEM_STATUS = 'system:status',
  SYSTEM_ALERT = 'system:alert',
  SYSTEM_METRICS = 'system:metrics'
}

export interface WebSocketMessage<T = any> {
  event: WebSocketEvent;
  data: T;
  timestamp: Date;
  userId?: string;
}

class WebSocketService extends EventEmitter {
  private io: SocketIOServer | null = null;
  private connections: Map<string, AuthenticatedSocket> = new Map();
  
  initialize(server: HTTPServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true
      },
      transports: ['websocket', 'polling']
    });
    
    this.io.use(this.authenticateSocket);
    
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
    
    logger.info('WebSocket service initialized');
  }
  
  private authenticateSocket = async (
    socket: AuthenticatedSocket, 
    next: (err?: Error) => void
  ): Promise<void> => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
      socket.userId = payload.sub;
      socket.role = payload.role;
      
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  };
  
  private handleConnection(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;
    
    // Store connection
    this.connections.set(userId, socket);
    
    logger.info(`User ${userId} connected via WebSocket`);
    
    // Join user-specific room
    socket.join(`user:${userId}`);
    
    // Join role-specific room
    if (socket.role) {
      socket.join(`role:${socket.role}`);
    }
    
    // Send initial system status
    this.sendToUser(userId, WebSocketEvent.SYSTEM_STATUS, {
      status: 'connected',
      serverTime: new Date()
    });
    
    // Handle client events
    socket.on('subscribe', (channels: string[]) => {
      channels.forEach(channel => {
        socket.join(channel);
      });
    });
    
    socket.on('unsubscribe', (channels: string[]) => {
      channels.forEach(channel => {
        socket.leave(channel);
      });
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      this.connections.delete(userId);
      logger.info(`User ${userId} disconnected from WebSocket`);
    });
  }
  
  // Broadcasting methods
  
  broadcast<T>(event: WebSocketEvent, data: T): void {
    if (!this.io) return;
    
    const message: WebSocketMessage<T> = {
      event,
      data,
      timestamp: new Date()
    };
    
    this.io.emit(event, message);
  }
  
  sendToUser<T>(userId: string, event: WebSocketEvent, data: T): void {
    if (!this.io) return;
    
    const message: WebSocketMessage<T> = {
      event,
      data,
      timestamp: new Date(),
      userId
    };
    
    this.io.to(`user:${userId}`).emit(event, message);
  }
  
  sendToRole<T>(role: string, event: WebSocketEvent, data: T): void {
    if (!this.io) return;
    
    const message: WebSocketMessage<T> = {
      event,
      data,
      timestamp: new Date()
    };
    
    this.io.to(`role:${role}`).emit(event, message);
  }
  
  sendToChannel<T>(channel: string, event: WebSocketEvent, data: T): void {
    if (!this.io) return;
    
    const message: WebSocketMessage<T> = {
      event,
      data,
      timestamp: new Date()
    };
    
    this.io.to(channel).emit(event, message);
  }
  
  // Feed processing events
  
  notifyFeedProcessingStarted(feedId: string, feedName: string): void {
    this.broadcast(WebSocketEvent.FEED_PROCESSING_STARTED, {
      feedId,
      feedName,
      startedAt: new Date()
    });
  }
  
  notifyFeedProcessingCompleted(feedId: string, itemsProcessed: number): void {
    this.broadcast(WebSocketEvent.FEED_PROCESSING_COMPLETED, {
      feedId,
      itemsProcessed,
      completedAt: new Date()
    });
  }
  
  notifyFeedProcessingFailed(feedId: string, error: string): void {
    this.broadcast(WebSocketEvent.FEED_PROCESSING_FAILED, {
      feedId,
      error,
      failedAt: new Date()
    });
  }
  
  // Analysis events
  
  notifyAnalysisStarted(analysisId: string): void {
    this.sendToRole('admin', WebSocketEvent.ANALYSIS_STARTED, {
      analysisId,
      startedAt: new Date()
    });
  }
  
  notifyAnalysisProgress(analysisId: string, progress: number, message: string): void {
    this.sendToRole('admin', WebSocketEvent.ANALYSIS_PROGRESS, {
      analysisId,
      progress,
      message,
      timestamp: new Date()
    });
  }
  
  notifyAnalysisCompleted(analysisId: string, summary: any): void {
    this.broadcast(WebSocketEvent.ANALYSIS_COMPLETED, {
      analysisId,
      summary,
      completedAt: new Date()
    });
  }
  
  // Stock scanner events
  
  notifyStockAlert(alert: {
    symbol: string;
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    data: any;
  }): void {
    this.broadcast(WebSocketEvent.STOCK_ALERT, {
      ...alert,
      timestamp: new Date()
    });
  }
  
  notifyStockScannerProgress(progress: number, currentSymbol: string): void {
    this.sendToChannel('stock:scanner', WebSocketEvent.STOCK_SCANNER_PROGRESS, {
      progress,
      currentSymbol,
      timestamp: new Date()
    });
  }
  
  // Queue events
  
  notifyQueueJobUpdate(jobId: string, status: string, details?: any): void {
    const eventMap: Record<string, WebSocketEvent> = {
      'added': WebSocketEvent.QUEUE_JOB_ADDED,
      'started': WebSocketEvent.QUEUE_JOB_STARTED,
      'completed': WebSocketEvent.QUEUE_JOB_COMPLETED,
      'failed': WebSocketEvent.QUEUE_JOB_FAILED
    };
    
    const event = eventMap[status];
    if (event) {
      this.sendToRole('admin', event, {
        jobId,
        status,
        details,
        timestamp: new Date()
      });
    }
  }
  
  // System metrics
  
  broadcastSystemMetrics(metrics: {
    cpuUsage: number;
    memoryUsage: number;
    activeJobs: number;
    queueSize: number;
    uptime: number;
  }): void {
    this.sendToRole('admin', WebSocketEvent.SYSTEM_METRICS, metrics);
  }
  
  // Connection management
  
  getConnectedUsers(): string[] {
    return Array.from(this.connections.keys());
  }
  
  getConnectionCount(): number {
    return this.connections.size;
  }
  
  disconnectUser(userId: string): void {
    const socket = this.connections.get(userId);
    if (socket) {
      socket.disconnect();
      this.connections.delete(userId);
    }
  }
  
  shutdown(): void {
    if (this.io) {
      this.io.close();
      this.connections.clear();
      logger.info('WebSocket service shut down');
    }
  }
}

export const websocketService = new WebSocketService();