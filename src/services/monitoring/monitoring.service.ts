import { EventEmitter } from 'events';
import os from 'os';
import { db } from '@/services/database';
import { cache } from '@/services/cache';
import { logger } from '@/utils/logger';
import { websocketService, WebSocketEvent } from '@/services/websocket/websocket.service';

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  process: {
    uptime: number;
    pid: number;
    memoryUsage: NodeJS.MemoryUsage;
  };
  application: {
    activeConnections: number;
    queueSize: number;
    activeJobs: number;
    cacheHitRate: number;
    errorRate: number;
  };
  database: {
    connected: boolean;
    activeConnections: number;
    responseTime: number;
  };
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata?: any;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export enum AlertType {
  SYSTEM_CPU_HIGH = 'system_cpu_high',
  SYSTEM_MEMORY_HIGH = 'system_memory_high',
  DATABASE_CONNECTION_LOST = 'database_connection_lost',
  DATABASE_SLOW_QUERY = 'database_slow_query',
  QUEUE_BACKLOG = 'queue_backlog',
  FEED_PROCESSING_FAILED = 'feed_processing_failed',
  AI_SERVICE_ERROR = 'ai_service_error',
  ERROR_RATE_HIGH = 'error_rate_high',
  CACHE_MISS_RATE_HIGH = 'cache_miss_rate_high',
  DISK_SPACE_LOW = 'disk_space_low'
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

interface AlertRule {
  type: AlertType;
  check: (metrics: SystemMetrics) => boolean;
  severity: AlertSeverity;
  title: string;
  getMessage: (metrics: SystemMetrics) => string;
  cooldown: number; // Minutes before the same alert can fire again
}

class MonitoringService extends EventEmitter {
  private metricsInterval: NodeJS.Timeout | null = null;
  private activeAlerts: Map<AlertType, Alert> = new Map();
  private lastAlertTime: Map<AlertType, Date> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private cacheStats = { hits: 0, misses: 0 };
  
  private alertRules: AlertRule[] = [
    {
      type: AlertType.SYSTEM_CPU_HIGH,
      check: (metrics) => metrics.cpu.usage > 80,
      severity: AlertSeverity.WARNING,
      title: 'High CPU Usage',
      getMessage: (metrics) => `CPU usage is ${metrics.cpu.usage.toFixed(1)}%`,
      cooldown: 5
    },
    {
      type: AlertType.SYSTEM_MEMORY_HIGH,
      check: (metrics) => metrics.memory.percentage > 85,
      severity: AlertSeverity.WARNING,
      title: 'High Memory Usage',
      getMessage: (metrics) => `Memory usage is ${metrics.memory.percentage.toFixed(1)}%`,
      cooldown: 5
    },
    {
      type: AlertType.DATABASE_CONNECTION_LOST,
      check: (metrics) => !metrics.database.connected,
      severity: AlertSeverity.CRITICAL,
      title: 'Database Connection Lost',
      getMessage: () => 'Unable to connect to the database',
      cooldown: 1
    },
    {
      type: AlertType.DATABASE_SLOW_QUERY,
      check: (metrics) => metrics.database.responseTime > 5000,
      severity: AlertSeverity.WARNING,
      title: 'Slow Database Queries',
      getMessage: (metrics) => `Average query time is ${metrics.database.responseTime}ms`,
      cooldown: 10
    },
    {
      type: AlertType.QUEUE_BACKLOG,
      check: (metrics) => metrics.application.queueSize > 100,
      severity: AlertSeverity.WARNING,
      title: 'Queue Backlog',
      getMessage: (metrics) => `${metrics.application.queueSize} jobs in queue`,
      cooldown: 15
    },
    {
      type: AlertType.ERROR_RATE_HIGH,
      check: (metrics) => metrics.application.errorRate > 5,
      severity: AlertSeverity.ERROR,
      title: 'High Error Rate',
      getMessage: (metrics) => `Error rate is ${metrics.application.errorRate.toFixed(1)}%`,
      cooldown: 10
    },
    {
      type: AlertType.CACHE_MISS_RATE_HIGH,
      check: (metrics) => (100 - metrics.application.cacheHitRate) > 50,
      severity: AlertSeverity.INFO,
      title: 'High Cache Miss Rate',
      getMessage: (metrics) => `Cache hit rate is only ${metrics.application.cacheHitRate.toFixed(1)}%`,
      cooldown: 30
    }
  ];
  
  start(intervalMs: number = 30000): void {
    if (this.metricsInterval) {
      return; // Already running
    }
    
    logger.info('Starting monitoring service');
    
    // Collect metrics immediately
    this.collectAndBroadcastMetrics();
    
    // Then collect periodically
    this.metricsInterval = setInterval(() => {
      this.collectAndBroadcastMetrics();
    }, intervalMs);
  }
  
  stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
      logger.info('Monitoring service stopped');
    }
  }
  
  private async collectAndBroadcastMetrics(): Promise<void> {
    try {
      const metrics = await this.collectMetrics();
      
      // Broadcast to admin users via WebSocket
      websocketService.broadcastSystemMetrics({
        cpuUsage: metrics.cpu.usage,
        memoryUsage: metrics.memory.percentage,
        activeJobs: metrics.application.activeJobs,
        queueSize: metrics.application.queueSize,
        uptime: metrics.process.uptime
      });
      
      // Check alert rules
      this.checkAlertRules(metrics);
      
      // Store metrics for historical analysis
      await this.storeMetrics(metrics);
      
      // Emit for local listeners
      this.emit('metrics', metrics);
    } catch (error) {
      logger.error('Error collecting metrics:', error);
    }
  }
  
  private async collectMetrics(): Promise<SystemMetrics> {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    // Calculate CPU usage
    const cpuUsage = this.calculateCPUUsage(cpus);
    
    // Get database metrics
    const dbMetrics = await this.getDatabaseMetrics();
    
    // Get queue metrics
    const queueMetrics = await this.getQueueMetrics();
    
    // Calculate error rate (errors in last 5 minutes)
    const errorRate = this.calculateErrorRate();
    
    // Calculate cache hit rate
    const cacheHitRate = this.calculateCacheHitRate();
    
    return {
      timestamp: new Date(),
      cpu: {
        usage: cpuUsage,
        loadAverage: os.loadavg()
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        percentage: (usedMemory / totalMemory) * 100
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        memoryUsage: process.memoryUsage()
      },
      application: {
        activeConnections: websocketService.getConnectionCount(),
        queueSize: queueMetrics.pending,
        activeJobs: queueMetrics.active,
        cacheHitRate,
        errorRate
      },
      database: dbMetrics
    };
  }
  
  private calculateCPUUsage(cpus: os.CpuInfo[]): number {
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof os.CpuTimes];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);
    
    return usage;
  }
  
  private async getDatabaseMetrics(): Promise<{
    connected: boolean;
    activeConnections: number;
    responseTime: number;
  }> {
    const startTime = Date.now();
    
    try {
      // Test database connection with a simple query
      await db.query('SELECT 1');
      const responseTime = Date.now() - startTime;
      
      // Get connection pool stats if available
      const poolStats = await db.getPoolStats();
      
      return {
        connected: true,
        activeConnections: poolStats?.activeConnections || 0,
        responseTime
      };
    } catch (error) {
      return {
        connected: false,
        activeConnections: 0,
        responseTime: Date.now() - startTime
      };
    }
  }
  
  private async getQueueMetrics(): Promise<{
    pending: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'processing' THEN 1 END) as active,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
        FROM job_queue
        WHERE created_at > NOW() - INTERVAL '1 hour'
      `);
      
      return result[0] || { pending: 0, active: 0, completed: 0, failed: 0 };
    } catch (error) {
      logger.error('Error getting queue metrics:', error);
      return { pending: 0, active: 0, completed: 0, failed: 0 };
    }
  }
  
  private calculateErrorRate(): number {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    let recentErrors = 0;
    let totalRequests = 0;
    
    this.errorCounts.forEach((count, timestamp) => {
      if (parseInt(timestamp) > fiveMinutesAgo) {
        recentErrors += count;
        totalRequests++;
      }
    });
    
    // Clean up old entries
    this.errorCounts.forEach((_, timestamp) => {
      if (parseInt(timestamp) <= fiveMinutesAgo) {
        this.errorCounts.delete(timestamp);
      }
    });
    
    return totalRequests > 0 ? (recentErrors / totalRequests) * 100 : 0;
  }
  
  private calculateCacheHitRate(): number {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    return total > 0 ? (this.cacheStats.hits / total) * 100 : 100;
  }
  
  private checkAlertRules(metrics: SystemMetrics): void {
    for (const rule of this.alertRules) {
      const shouldAlert = rule.check(metrics);
      const activeAlert = this.activeAlerts.get(rule.type);
      
      if (shouldAlert && !activeAlert) {
        // Check cooldown
        const lastAlert = this.lastAlertTime.get(rule.type);
        if (lastAlert) {
          const cooldownMs = rule.cooldown * 60 * 1000;
          if (Date.now() - lastAlert.getTime() < cooldownMs) {
            continue; // Still in cooldown
          }
        }
        
        // Create new alert
        const alert: Alert = {
          id: `${rule.type}-${Date.now()}`,
          type: rule.type,
          severity: rule.severity,
          title: rule.title,
          message: rule.getMessage(metrics),
          metadata: { metrics },
          timestamp: new Date(),
          resolved: false
        };
        
        this.activeAlerts.set(rule.type, alert);
        this.lastAlertTime.set(rule.type, new Date());
        
        // Emit alert
        this.emit('alert', alert);
        
        // Send via WebSocket
        websocketService.sendToRole('admin', WebSocketEvent.SYSTEM_ALERT, alert);
        
        logger.warn(`Alert triggered: ${alert.title} - ${alert.message}`);
      } else if (!shouldAlert && activeAlert && !activeAlert.resolved) {
        // Resolve existing alert
        activeAlert.resolved = true;
        activeAlert.resolvedAt = new Date();
        
        this.emit('alert:resolved', activeAlert);
        
        // Remove from active alerts
        this.activeAlerts.delete(rule.type);
        
        logger.info(`Alert resolved: ${activeAlert.title}`);
      }
    }
  }
  
  private async storeMetrics(metrics: SystemMetrics): Promise<void> {
    try {
      // Store in a time-series friendly format
      await db.query(`
        INSERT INTO system_metrics (
          timestamp,
          cpu_usage,
          memory_usage,
          queue_size,
          active_jobs,
          error_rate,
          cache_hit_rate,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        metrics.timestamp,
        metrics.cpu.usage,
        metrics.memory.percentage,
        metrics.application.queueSize,
        metrics.application.activeJobs,
        metrics.application.errorRate,
        metrics.application.cacheHitRate,
        JSON.stringify(metrics)
      ]);
    } catch (error) {
      // Don't log to avoid recursive errors
      console.error('Failed to store metrics:', error);
    }
  }
  
  // Public methods for tracking events
  
  recordError(error: Error, context?: any): void {
    const timestamp = Date.now().toString();
    this.errorCounts.set(timestamp, (this.errorCounts.get(timestamp) || 0) + 1);
    
    logger.error('Application error recorded', { error, context });
  }
  
  recordCacheHit(): void {
    this.cacheStats.hits++;
  }
  
  recordCacheMiss(): void {
    this.cacheStats.misses++;
  }
  
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }
  
  async getHistoricalMetrics(hours: number = 24): Promise<SystemMetrics[]> {
    try {
      const result = await db.query(`
        SELECT metadata
        FROM system_metrics
        WHERE timestamp > NOW() - INTERVAL '${hours} hours'
        ORDER BY timestamp DESC
      `);
      
      return result.map(row => row.metadata);
    } catch (error) {
      logger.error('Error fetching historical metrics:', error);
      return [];
    }
  }
}

export const monitoringService = new MonitoringService();