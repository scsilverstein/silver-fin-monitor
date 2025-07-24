import { cacheService } from '../src/services/database/cache';
import { logger } from '../src/utils/logger';

async function clearDashboardCache() {
  try {
    await cacheService.delete('dashboard:overview');
    await cacheService.delete('dashboard:trends:7');
    await cacheService.delete('dashboard:themes:week');
    await cacheService.delete('dashboard:themes:month');
    await cacheService.delete('dashboard:themes:year');
    
    logger.info('Dashboard cache cleared successfully');
  } catch (error) {
    logger.error('Failed to clear dashboard cache', { error });
  } finally {
    process.exit(0);
  }
}

clearDashboardCache();