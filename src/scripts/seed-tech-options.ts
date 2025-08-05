import { db } from '../services/database';
import { OptionsScannerService } from '../services/options/options-scanner-service';
import QueueService from '../services/queue/queue.service';
import { Logger } from '../utils/stock-logger';

const logger = new Logger('SeedTechOptions');

/**
 * Seed script to initialize tech stock universe for options scanning
 * Run with: npx tsx src/scripts/seed-tech-options.ts
 */
async function seedTechOptions() {
  try {
    logger.info('Starting tech options seed script');

    // Connect to database
    await db.connect();
    logger.info('Database connected');

    // Initialize services
    const queueService = new QueueService(db);
    const scannerService = new OptionsScannerService(queueService);

    // Initialize tech stock universe
    logger.info('Initializing tech stock universe...');
    const result = await scannerService.initializeTechStockUniverse();

    if (result.success) {
      logger.info(`Successfully added ${result.data} tech stocks to universe`);
    } else {
      logger.error('Failed to initialize tech stock universe', result.error);
      process.exit(1);
    }

    // Optional: Run an initial scan
    const runInitialScan = process.argv.includes('--scan');
    if (runInitialScan) {
      logger.info('Running initial tech options scan...');
      await scannerService.queueScanJob();
      logger.info('Scan job queued successfully');
    }

    logger.info('Tech options seed script completed successfully');
    process.exit(0);

  } catch (error) {
    logger.error('Seed script failed', error);
    process.exit(1);
  }
}

// Run the seed script
seedTechOptions();