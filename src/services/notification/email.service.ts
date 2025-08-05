import nodemailer from 'nodemailer';
import { logger } from '@/utils/logger';

export interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  priority?: 'high' | 'normal' | 'low';
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;
  
  constructor() {
    this.initialize();
  }
  
  private initialize(): void {
    // Check if email is configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      logger.warn('Email service not configured - SMTP settings missing');
      return;
    }
    
    this.config = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      from: process.env.SMTP_FROM || process.env.SMTP_USER
    };
    
    this.transporter = nodemailer.createTransporter({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.auth,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimits: 5
    });
    
    // Verify connection
    this.verifyConnection();
    
    logger.info('Email service initialized');
  }
  
  private async verifyConnection(): Promise<void> {
    if (!this.transporter) return;
    
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
    } catch (error) {
      logger.error('Email service connection failed:', error);
    }
  }
  
  async send(options: EmailOptions): Promise<boolean> {
    if (!this.transporter || !this.config) {
      logger.warn('Email service not configured - cannot send email');
      return false;
    }
    
    try {
      const mailOptions = {
        from: this.config.from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
        priority: options.priority || 'normal',
        headers: {
          'X-Mailer': 'Silver Fin Monitor',
          'X-Priority': this.getPriorityValue(options.priority || 'normal')
        }
      };
      
      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('Email sent successfully', {
        messageId: result.messageId,
        to: options.to,
        subject: options.subject
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to send email:', error);
      return false;
    }
  }
  
  async sendTemplate(
    template: 'alert' | 'report' | 'welcome',
    to: string | string[],
    data: Record<string, any>
  ): Promise<boolean> {
    const templates = {
      alert: {
        subject: `[${data.severity}] ${data.title}`,
        html: this.generateAlertTemplate(data)
      },
      report: {
        subject: `Daily Report - ${data.date}`,
        html: this.generateReportTemplate(data)
      },
      welcome: {
        subject: 'Welcome to Silver Fin Monitor',
        html: this.generateWelcomeTemplate(data)
      }
    };
    
    const templateData = templates[template];
    if (!templateData) {
      logger.error(`Unknown email template: ${template}`);
      return false;
    }
    
    return this.send({
      to,
      subject: templateData.subject,
      html: templateData.html
    });
  }
  
  private getPriorityValue(priority: string): string {
    switch (priority) {
      case 'high':
        return '1 (High)';
      case 'low':
        return '5 (Low)';
      default:
        return '3 (Normal)';
    }
  }
  
  private generateAlertTemplate(data: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>System Alert</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              margin: 0; 
              padding: 0; 
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              padding: 20px; 
            }
            .header { 
              background-color: ${this.getSeverityColor(data.severity)}; 
              color: white; 
              padding: 20px; 
              border-radius: 8px 8px 0 0; 
              text-align: center;
            }
            .content { 
              background-color: #f9f9f9; 
              padding: 20px; 
              border-radius: 0 0 8px 8px; 
            }
            .footer { 
              text-align: center; 
              margin-top: 20px; 
              font-size: 12px; 
              color: #666; 
            }
            .button {
              display: inline-block;
              background-color: #007bff;
              color: white;
              padding: 10px 20px;
              text-decoration: none;
              border-radius: 4px;
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${data.title}</h1>
              <p>Severity: ${data.severity.toUpperCase()}</p>
            </div>
            <div class="content">
              <h3>Alert Details</h3>
              <p><strong>Message:</strong> ${data.message}</p>
              <p><strong>Type:</strong> ${data.type}</p>
              <p><strong>Timestamp:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
              
              ${data.metadata ? `
                <h3>Additional Information</h3>
                <pre style="background-color: #e9e9e9; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px;">
${JSON.stringify(data.metadata, null, 2)}
                </pre>
              ` : ''}
              
              <div style="text-align: center; margin: 20px 0;">
                <a href="${process.env.FRONTEND_URL}/admin" class="button">
                  View Admin Dashboard
                </a>
              </div>
            </div>
            <div class="footer">
              <p>This is an automated alert from Silver Fin Monitor.</p>
              <p>© ${new Date().getFullYear()} Silver Fin Monitor. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
  
  private generateReportTemplate(data: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Daily Report</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #007bff; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .metric { display: flex; justify-content: space-between; margin: 10px 0; }
            .metric-name { font-weight: bold; }
            .metric-value { color: #007bff; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Daily Report</h1>
              <p>Date: ${data.date}</p>
            </div>
            <div class="content">
              <h3>System Metrics</h3>
              <div class="metric">
                <span class="metric-name">Feeds Processed:</span>
                <span class="metric-value">${data.feedsProcessed || 0}</span>
              </div>
              <div class="metric">
                <span class="metric-name">Analyses Generated:</span>
                <span class="metric-value">${data.analysesGenerated || 0}</span>
              </div>
              <div class="metric">
                <span class="metric-name">Predictions Made:</span>
                <span class="metric-value">${data.predictionsMade || 0}</span>
              </div>
              <div class="metric">
                <span class="metric-name">System Uptime:</span>
                <span class="metric-value">${data.uptime || 'N/A'}</span>
              </div>
              
              ${data.summary ? `
                <h3>Daily Summary</h3>
                <p>${data.summary}</p>
              ` : ''}
            </div>
          </div>
        </body>
      </html>
    `;
  }
  
  private generateWelcomeTemplate(data: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Silver Fin Monitor</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #28a745; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Silver Fin Monitor!</h1>
              <p>Your AI-powered market intelligence platform</p>
            </div>
            <div class="content">
              <h3>Hello ${data.name || 'User'},</h3>
              <p>Welcome to Silver Fin Monitor! You now have access to our comprehensive market intelligence platform that automatically aggregates and analyzes financial information from diverse sources.</p>
              
              <h3>What you can do:</h3>
              <ul>
                <li>Monitor multiple feed sources (RSS, podcasts, YouTube, APIs)</li>
                <li>Get AI-powered daily market analysis</li>
                <li>Track prediction accuracy over time</li>
                <li>Scan stocks for opportunities</li>
                <li>Access real-time market insights</li>
              </ul>
              
              <div style="text-align: center; margin: 20px 0;">
                <a href="${process.env.FRONTEND_URL}/dashboard" class="button">
                  Access Your Dashboard
                </a>
              </div>
              
              <p>If you have any questions, please don't hesitate to reach out to our support team.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
  
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical':
        return '#dc3545'; // Red
      case 'error':
        return '#fd7e14'; // Orange
      case 'warning':
        return '#ffc107'; // Yellow
      case 'info':
        return '#17a2b8'; // Teal
      default:
        return '#6c757d'; // Gray
    }
  }
  
  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }
    
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      logger.error('Email connection test failed:', error);
      return false;
    }
  }
  
  isConfigured(): boolean {
    return this.transporter !== null && this.config !== null;
  }
}

export const emailService = new EmailService();