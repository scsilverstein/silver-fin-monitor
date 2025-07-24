import { aiAnalysisService } from '../src/services/ai/analysis';
import { logger } from '../src/utils/logger';
import { supabase } from '../src/services/database/client';
import { cacheService } from '../src/services/database/cache';

async function regenerateAnalysis() {
  try {
    logger.info('Starting analysis regeneration with source tracking...');
    
    // Clear cache for today's analysis
    const today = new Date().toISOString().split('T')[0];
    
    // Clear cache first
    await cacheService.delete(`daily_analysis:${today}`);
    await cacheService.delete('dashboard:overview');
    logger.info('Cleared analysis cache');
    
    // Delete today's analysis to force regeneration
    const { error: deleteError } = await supabase
      .from('daily_analysis')
      .delete()
      .eq('analysis_date', today);
    
    if (deleteError) {
      logger.warn('Failed to delete existing analysis', { error: deleteError });
    }
    
    // Run the analysis
    await aiAnalysisService.runDailyAnalysis(new Date(), true);
    
    // Verify the new analysis has source tracking
    const { data: analysis, error } = await supabase
      .from('daily_analysis')
      .select('*')
      .eq('analysis_date', today)
      .single();
    
    if (error) {
      logger.error('Failed to fetch regenerated analysis', { error });
      return;
    }
    
    if (analysis?.ai_analysis?.source_ids?.length > 0) {
      logger.info('✅ Analysis regenerated successfully with source tracking!', {
        date: today,
        sourceCount: analysis.ai_analysis.source_ids.length,
        sources: analysis.ai_analysis.sources
      });
    } else {
      logger.warn('⚠️ Analysis regenerated but no sources tracked', {
        date: today,
        aiAnalysis: analysis?.ai_analysis
      });
    }
    
  } catch (error) {
    logger.error('Failed to regenerate analysis', { error });
  } finally {
    process.exit(0);
  }
}

regenerateAnalysis();