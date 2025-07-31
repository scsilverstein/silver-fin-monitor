import { Logger } from '../../utils/stock-logger';
import { OptionsScannerService } from './options-scanner-service';
import { QueueService } from '../queue.service';
import { cache } from '../cache';

const logger = new Logger('OptionsScannerJobs');

export class OptionsScannerJobs {
  private scannerService: OptionsScannerService;

  constructor(private queueService: QueueService) {
    this.scannerService = new OptionsScannerService(queueService);
  }

  // Process options scan job
  async processOptionsScan(payload: any): Promise<void> {
    try {
      logger.info('Starting tech options scan job', { payload });

      // Check if a scan is already in progress
      const scanLock = await cache.get('options_scan:lock');
      if (scanLock) {
        logger.warn('Options scan already in progress, skipping');
        return;
      }

      // Set lock for 30 minutes
      await cache.set('options_scan:lock', true, 1800);

      try {
        // Run the comprehensive scan
        const result = await this.scannerService.scanTechOptions();

        if (result.success) {
          logger.info('Tech options scan completed successfully', {
            totalContracts: result.data?.totalContractsAnalyzed,
            topOpportunities: result.data?.topOpportunities.length
          });

          // Queue notification job if high-value opportunities found
          if (result.data && result.data.marketOverview.highValueOpportunities.length > 0) {
            await this.queueService.addJob('notify_options_opportunities', {
              opportunities: result.data.marketOverview.highValueOpportunities.slice(0, 5),
              scanDate: result.data.scanDate
            }, {
              priority: 3
            });
          }
        } else {
          logger.error('Tech options scan failed', result.error);
        }
      } finally {
        // Release lock
        await cache.delete('options_scan:lock');
      }

    } catch (error) {
      logger.error('Options scan job failed', error);
      throw error;
    }
  }

  // Process individual option analysis
  async processOptionAnalysis(payload: {
    contractId: string;
    priority?: boolean;
  }): Promise<void> {
    try {
      logger.info('Processing option analysis', { contractId: payload.contractId });

      // Implementation would analyze a specific option contract
      // This is called when unusual activity is detected or on-demand

      logger.info('Option analysis completed', { contractId: payload.contractId });

    } catch (error) {
      logger.error('Option analysis failed', error);
      throw error;
    }
  }

  // Process unusual activity detection
  async processUnusualActivity(payload: any): Promise<void> {
    try {
      logger.info('Processing unusual options activity detection');

      // Implementation would scan for:
      // 1. Volume spikes (volume > 2x average)
      // 2. Open interest changes
      // 3. IV spikes
      // 4. Large trades

      logger.info('Unusual activity detection completed');

    } catch (error) {
      logger.error('Unusual activity detection failed', error);
      throw error;
    }
  }

  // Schedule daily tech options scan
  async scheduleDailyScan(): Promise<void> {
    try {
      // Schedule for 9:30 AM EST (market open)
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(13, 30, 0, 0); // 9:30 AM EST = 13:30 UTC

      if (scheduledTime <= now) {
        // If past today's time, schedule for tomorrow
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      const delayMs = scheduledTime.getTime() - now.getTime();

      await this.queueService.addJob('options_scan', {
        type: 'daily_tech_scan',
        scheduledFor: scheduledTime
      }, {
        delay: delayMs,
        priority: 5
      });

      logger.info(`Daily options scan scheduled for ${scheduledTime}`);

    } catch (error) {
      logger.error('Failed to schedule daily scan', error);
      throw error;
    }
  }

  // Process options alerts
  async processOptionsAlerts(payload: {
    type: 'value' | 'unusual' | 'earnings';
    threshold: number;
  }): Promise<void> {
    try {
      logger.info('Processing options alerts', { type: payload.type });

      // Implementation would:
      // 1. Query for options meeting alert criteria
      // 2. Generate alert messages
      // 3. Send notifications
      // 4. Update alert history

      logger.info('Options alerts processed');

    } catch (error) {
      logger.error('Options alerts processing failed', error);
      throw error;
    }
  }
}

// Export job handlers for queue worker
export const optionsJobHandlers = {
  options_scan: async (payload: any, queueService: QueueService) => {
    const jobs = new OptionsScannerJobs(queueService);
    await jobs.processOptionsScan(payload);
  },

  option_analysis: async (payload: any, queueService: QueueService) => {
    const jobs = new OptionsScannerJobs(queueService);
    await jobs.processOptionAnalysis(payload);
  },

  unusual_options_activity: async (payload: any, queueService: QueueService) => {
    const jobs = new OptionsScannerJobs(queueService);
    await jobs.processUnusualActivity(payload);
  },

  schedule_daily_options_scan: async (payload: any, queueService: QueueService) => {
    const jobs = new OptionsScannerJobs(queueService);
    await jobs.scheduleDailyScan();
  },

  options_alerts: async (payload: any, queueService: QueueService) => {
    const jobs = new OptionsScannerJobs(queueService);
    await jobs.processOptionsAlerts(payload);
  }
};