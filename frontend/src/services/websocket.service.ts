import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';

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

type EventCallback<T = any> = (data: T) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<WebSocketEvent, Set<EventCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000;
  
  connect(): void {
    const token = useAuthStore.getState().token;
    
    if (!token) {
      console.error('No authentication token available');
      return;
    }
    
    const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    this.socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectInterval,
      reconnectionDelayMax: 10000
    });
    
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    if (!this.socket) return;
    
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.notifyListeners(WebSocketEvent.SYSTEM_STATUS, {
        status: 'connected',
        timestamp: new Date()
      });
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.notifyListeners(WebSocketEvent.SYSTEM_STATUS, {
        status: 'disconnected',
        reason,
        timestamp: new Date()
      });
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.notifyListeners(WebSocketEvent.SYSTEM_STATUS, {
          status: 'failed',
          error: 'Max reconnection attempts reached',
          timestamp: new Date()
        });
      }
    });
    
    // Register all event listeners
    Object.values(WebSocketEvent).forEach(event => {
      this.socket!.on(event, (message: WebSocketMessage) => {
        this.notifyListeners(event as WebSocketEvent, message.data);
      });
    });
  }
  
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
  
  subscribe(channels: string[]): void {
    if (!this.socket) return;
    this.socket.emit('subscribe', channels);
  }
  
  unsubscribe(channels: string[]): void {
    if (!this.socket) return;
    this.socket.emit('unsubscribe', channels);
  }
  
  on<T = any>(event: WebSocketEvent, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }
  
  off(event: WebSocketEvent, callback?: EventCallback): void {
    if (!callback) {
      // Remove all listeners for this event
      this.listeners.delete(event);
    } else {
      // Remove specific listener
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
      }
    }
  }
  
  private notifyListeners(event: WebSocketEvent, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket listener for ${event}:`, error);
        }
      });
    }
  }
  
  // Typed event emitters for common operations
  
  onFeedProcessingUpdate(callback: (data: {
    feedId: string;
    feedName?: string;
    itemsProcessed?: number;
    error?: string;
    status: 'started' | 'completed' | 'failed';
  }) => void): () => void {
    const unsubscribes = [
      this.on(WebSocketEvent.FEED_PROCESSING_STARTED, (data) => 
        callback({ ...data, status: 'started' })
      ),
      this.on(WebSocketEvent.FEED_PROCESSING_COMPLETED, (data) => 
        callback({ ...data, status: 'completed' })
      ),
      this.on(WebSocketEvent.FEED_PROCESSING_FAILED, (data) => 
        callback({ ...data, status: 'failed' })
      )
    ];
    
    return () => unsubscribes.forEach(fn => fn());
  }
  
  onAnalysisUpdate(callback: (data: {
    analysisId: string;
    progress?: number;
    message?: string;
    summary?: any;
    status: 'started' | 'progress' | 'completed' | 'failed';
  }) => void): () => void {
    const unsubscribes = [
      this.on(WebSocketEvent.ANALYSIS_STARTED, (data) => 
        callback({ ...data, status: 'started' })
      ),
      this.on(WebSocketEvent.ANALYSIS_PROGRESS, (data) => 
        callback({ ...data, status: 'progress' })
      ),
      this.on(WebSocketEvent.ANALYSIS_COMPLETED, (data) => 
        callback({ ...data, status: 'completed' })
      ),
      this.on(WebSocketEvent.ANALYSIS_FAILED, (data) => 
        callback({ ...data, status: 'failed' })
      )
    ];
    
    return () => unsubscribes.forEach(fn => fn());
  }
  
  onStockAlert(callback: (alert: {
    symbol: string;
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    data: any;
  }) => void): () => void {
    return this.on(WebSocketEvent.STOCK_ALERT, callback);
  }
  
  onSystemMetrics(callback: (metrics: {
    cpuUsage: number;
    memoryUsage: number;
    activeJobs: number;
    queueSize: number;
    uptime: number;
  }) => void): () => void {
    return this.on(WebSocketEvent.SYSTEM_METRICS, callback);
  }
  
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const websocketService = new WebSocketService();