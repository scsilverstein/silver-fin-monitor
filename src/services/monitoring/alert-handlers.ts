import { Alert, AlertSeverity } from './monitoring.service';
import { logger } from '@/utils/logger';
import { db } from '@/services/database';
import { emailService } from '@/services/notification/email.service';

export interface AlertHandler {
  name: string;
  handle(alert: Alert): Promise<void>;
  shouldHandle(alert: Alert): boolean;
}

export class DatabaseAlertHandler implements AlertHandler {
  name = 'DatabaseAlertHandler';
  
  async handle(alert: Alert): Promise<void> {
    try {
      await db.query(`
        INSERT INTO alerts (
          id,
          type,
          severity,
          title,
          message,
          metadata,
          timestamp,
          resolved,
          resolved_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          resolved = EXCLUDED.resolved,
          resolved_at = EXCLUDED.resolved_at
      `, [
        alert.id,
        alert.type,
        alert.severity,
        alert.title,
        alert.message,
        JSON.stringify(alert.metadata),
        alert.timestamp,
        alert.resolved,
        alert.resolvedAt
      ]);
    } catch (error) {
      logger.error('Failed to store alert in database:', error);
    }
  }
  
  shouldHandle(): boolean {
    return true; // Handle all alerts
  }
}

export class EmailAlertHandler implements AlertHandler {
  name = 'EmailAlertHandler';
  private emailConfig = {
    [AlertSeverity.CRITICAL]: {
      to: process.env.CRITICAL_ALERT_EMAIL || 'admin@example.com',
      priority: 'high'
    },
    [AlertSeverity.ERROR]: {
      to: process.env.ERROR_ALERT_EMAIL || 'admin@example.com',
      priority: 'normal'
    },
    [AlertSeverity.WARNING]: {
      to: process.env.WARNING_ALERT_EMAIL || 'admin@example.com',
      priority: 'low'
    },
    [AlertSeverity.INFO]: {
      to: null, // Don't send emails for info alerts
      priority: 'low'
    }
  };
  
  async handle(alert: Alert): Promise<void> {
    const config = this.emailConfig[alert.severity];
    
    if (!config?.to) {
      return; // No email configured for this severity
    }
    
    try {
      await emailService.send({
        to: config.to,
        subject: `[${alert.severity}] ${alert.title}`,
        html: this.generateEmailContent(alert),
        priority: config.priority as any
      });
      
      logger.info(`Alert email sent for ${alert.id}`);
    } catch (error) {
      logger.error('Failed to send alert email:', error);
    }
  }
  
  shouldHandle(alert: Alert): boolean {
    // Only handle error and critical alerts via email
    return alert.severity === AlertSeverity.ERROR || 
           alert.severity === AlertSeverity.CRITICAL;
  }
  
  private generateEmailContent(alert: Alert): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${this.getSeverityColor(alert.severity)}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">${alert.title}</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Severity: ${alert.severity.toUpperCase()}</p>
        </div>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px;">
          <h3>Alert Details</h3>
          <p><strong>Message:</strong> ${alert.message}</p>
          <p><strong>Type:</strong> ${alert.type}</p>
          <p><strong>Timestamp:</strong> ${alert.timestamp.toISOString()}</p>
          
          ${alert.metadata ? `
            <h3>Additional Information</h3>
            <pre style="background-color: #e0e0e0; padding: 10px; border-radius: 4px; overflow-x: auto;">
${JSON.stringify(alert.metadata, null, 2)}
            </pre>
          ` : ''}
          
          <hr style="margin: 20px 0; border: 0; border-top: 1px solid #ddd;">
          
          <p style="color: #666; font-size: 12px;">
            This is an automated alert from Silver Fin Monitor. 
            ${alert.resolved ? `<br><strong>Status:</strong> Resolved at ${alert.resolvedAt?.toISOString()}` : ''}
          </p>
        </div>
      </div>
    `;
  }
  
  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return '#dc3545'; // Red
      case AlertSeverity.ERROR:
        return '#fd7e14'; // Orange
      case AlertSeverity.WARNING:
        return '#ffc107'; // Yellow
      case AlertSeverity.INFO:
        return '#0dcaf0'; // Cyan
      default:
        return '#6c757d'; // Gray
    }
  }
}

export class SlackAlertHandler implements AlertHandler {
  name = 'SlackAlertHandler';
  private webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  async handle(alert: Alert): Promise<void> {
    if (!this.webhookUrl) {
      return; // Slack not configured
    }
    
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${this.getSeverityEmoji(alert.severity)} *${alert.title}*`,
          attachments: [{
            color: this.getSeverityColor(alert.severity),
            fields: [
              {
                title: 'Message',
                value: alert.message,
                short: false
              },
              {
                title: 'Type',
                value: alert.type,
                short: true
              },
              {
                title: 'Severity',
                value: alert.severity,
                short: true
              }
            ],
            footer: 'Silver Fin Monitor',
            ts: Math.floor(alert.timestamp.getTime() / 1000)
          }]
        })
      });
      
      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }
      
      logger.info(`Slack notification sent for alert ${alert.id}`);
    } catch (error) {
      logger.error('Failed to send Slack notification:', error);
    }
  }
  
  shouldHandle(alert: Alert): boolean {
    // Send all warnings and above to Slack
    return alert.severity !== AlertSeverity.INFO;
  }
  
  private getSeverityEmoji(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return '🚨';
      case AlertSeverity.ERROR:
        return '❌';
      case AlertSeverity.WARNING:
        return '⚠️';
      case AlertSeverity.INFO:
        return 'ℹ️';
      default:
        return '📢';
    }
  }
  
  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return '#dc3545';
      case AlertSeverity.ERROR:
        return '#fd7e14';
      case AlertSeverity.WARNING:
        return '#ffc107';
      case AlertSeverity.INFO:
        return '#0dcaf0';
      default:
        return '#6c757d';
    }
  }
}

export class WebhookAlertHandler implements AlertHandler {
  name = 'WebhookAlertHandler';
  private webhookUrls: string[] = (process.env.ALERT_WEBHOOK_URLS || '').split(',').filter(Boolean);
  
  async handle(alert: Alert): Promise<void> {
    if (this.webhookUrls.length === 0) {
      return; // No webhooks configured
    }
    
    const payload = {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      metadata: alert.metadata,
      timestamp: alert.timestamp,
      resolved: alert.resolved,
      resolvedAt: alert.resolvedAt,
      source: 'silver-fin-monitor'
    };
    
    // Send to all configured webhooks in parallel
    await Promise.all(
      this.webhookUrls.map(async (url) => {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Alert-Source': 'silver-fin-monitor'
            },
            body: JSON.stringify(payload)
          });
          
          if (!response.ok) {
            throw new Error(`Webhook error: ${response.status}`);
          }
          
          logger.info(`Webhook notification sent to ${url} for alert ${alert.id}`);
        } catch (error) {
          logger.error(`Failed to send webhook to ${url}:`, error);
        }
      })
    );
  }
  
  shouldHandle(alert: Alert): boolean {
    // Send critical and error alerts to webhooks
    return alert.severity === AlertSeverity.CRITICAL || 
           alert.severity === AlertSeverity.ERROR;
  }
}

// Alert manager to coordinate all handlers
export class AlertManager {
  private handlers: AlertHandler[] = [];
  
  constructor() {
    // Register default handlers
    this.registerHandler(new DatabaseAlertHandler());
    
    // Register optional handlers based on configuration
    if (process.env.SMTP_HOST) {
      this.registerHandler(new EmailAlertHandler());
    }
    
    if (process.env.SLACK_WEBHOOK_URL) {
      this.registerHandler(new SlackAlertHandler());
    }
    
    if (process.env.ALERT_WEBHOOK_URLS) {
      this.registerHandler(new WebhookAlertHandler());
    }
  }
  
  registerHandler(handler: AlertHandler): void {
    this.handlers.push(handler);
    logger.info(`Registered alert handler: ${handler.name}`);
  }
  
  async handleAlert(alert: Alert): Promise<void> {
    const applicableHandlers = this.handlers.filter(
      handler => handler.shouldHandle(alert)
    );
    
    logger.info(`Processing alert ${alert.id} with ${applicableHandlers.length} handlers`);
    
    // Handle alert with all applicable handlers in parallel
    await Promise.all(
      applicableHandlers.map(handler => 
        handler.handle(alert).catch(error => {
          logger.error(`Handler ${handler.name} failed:`, error);
        })
      )
    );
  }
}

export const alertManager = new AlertManager();