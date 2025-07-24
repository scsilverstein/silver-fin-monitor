import { supabase } from '../database/client';
import { logger } from '@/utils/logger';

interface ContentWithSource {
  id: string;
  raw_feed_id: string;
  summary: string;
  sentiment_score: number;
  key_topics: string[];
  source_id: string;
  source_name: string;
  published_at: string;
}

export async function getDailyAnalysisWithSources(analysisDate: string) {
  try {
    // Get the daily analysis
    const { data: analysis, error: analysisError } = await supabase
      .from('daily_analysis')
      .select('*')
      .eq('analysis_date', analysisDate)
      .single();

    if (analysisError || !analysis) {
      logger.error('Failed to get daily analysis', { analysisError });
      return null;
    }

    // Get the content that was analyzed on that date with source information
    const { data: contentWithSources, error: contentError } = await supabase
      .from('processed_content')
      .select(`
        id,
        raw_feed_id,
        summary,
        sentiment_score,
        key_topics,
        created_at,
        raw_feeds!inner (
          id,
          source_id,
          published_at,
          feed_sources!inner (
            id,
            name,
            type,
            url
          )
        )
      `)
      .gte('created_at', analysisDate + 'T00:00:00')
      .lt('created_at', analysisDate + 'T23:59:59')
      .order('created_at', { ascending: false });

    if (contentError) {
      logger.error('Failed to get content with sources', { contentError });
      return analysis;
    }

    // Extract unique source information
    const sourceMap = new Map();
    const sourceIds: string[] = [];
    
    contentWithSources?.forEach(item => {
      if ((item as any).raw_feeds?.feed_sources) {
        const source = (item as any).raw_feeds.feed_sources;
        if (!sourceMap.has(source.id)) {
          sourceMap.set(source.id, {
            id: source.id,
            name: source.name,
            type: source.type,
            url: source.url,
            contentCount: 0
          });
          sourceIds.push(source.id);
        }
        sourceMap.get(source.id).contentCount++;
      }
    });

    // Convert map to array
    const sources = Array.from(sourceMap.values());

    // Enhanced analysis with source information
    const enhancedAnalysis = {
      ...analysis,
      // Add source tracking to the existing ai_analysis JSONB
      ai_analysis: {
        ...analysis.ai_analysis,
        source_ids: sourceIds,
        sources: sources,
        content_breakdown: {
          total_content: contentWithSources?.length || 0,
          by_source: sources.map(s => ({
            id: s.id,
            name: s.name,
            count: s.contentCount
          }))
        }
      }
    };

    return enhancedAnalysis;
  } catch (error) {
    logger.error('Error getting analysis with sources', { error });
    return null;
  }
}

export async function updateDailyAnalysisWithSources(analysisDate: string) {
  try {
    logger.info('Updating daily analysis with source information', { analysisDate });

    // Get the content that contributed to this analysis
    const { data: contentItems, error: contentError } = await supabase
      .from('processed_content')
      .select(`
        id,
        raw_feed_id,
        raw_feeds!inner (
          source_id
        )
      `)
      .gte('created_at', analysisDate + 'T00:00:00')
      .lt('created_at', analysisDate + 'T23:59:59');

    if (contentError) {
      logger.error('Failed to get content for analysis', { contentError });
      return;
    }

    // Extract unique source IDs
    const sourceIds = [...new Set(
      contentItems
        ?.map(item => (item as any).raw_feeds?.source_id)
        .filter(id => id != null) || []
    )];

    // Get the existing analysis
    const { data: analysis, error: analysisError } = await supabase
      .from('daily_analysis')
      .select('ai_analysis')
      .eq('analysis_date', analysisDate)
      .single();

    if (analysisError || !analysis) {
      logger.error('Failed to get analysis to update', { analysisError });
      return;
    }

    // Update the analysis with source information
    const updatedAiAnalysis = {
      ...analysis.ai_analysis,
      source_ids: sourceIds,
      source_count: sourceIds.length,
      last_updated: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('daily_analysis')
      .update({
        ai_analysis: updatedAiAnalysis
      })
      .eq('analysis_date', analysisDate);

    if (updateError) {
      logger.error('Failed to update analysis with sources', { updateError });
    } else {
      logger.info('Successfully updated analysis with source information', {
        analysisDate,
        sourceCount: sourceIds.length
      });
    }
  } catch (error) {
    logger.error('Error updating analysis with sources', { error });
  }
}

// Function to get predictions with their source information
export async function getPredictionsWithSources(analysisId: string) {
  try {
    // First get the analysis with its sources
    const { data: analysis } = await supabase
      .from('daily_analysis')
      .select('ai_analysis')
      .eq('id', analysisId)
      .single();

    const sourceIds = analysis?.ai_analysis?.source_ids || [];

    // Get predictions for this analysis
    const { data: predictions } = await supabase
      .from('predictions')
      .select('*')
      .eq('daily_analysis_id', analysisId);

    // Get source details
    const { data: sources } = await supabase
      .from('feed_sources')
      .select('id, name, type, url')
      .in('id', sourceIds);

    // Enhance predictions with source information
    const enhancedPredictions = predictions?.map(prediction => ({
      ...prediction,
      source_ids: sourceIds,
      sources: sources || []
    })) || [];

    return enhancedPredictions;
  } catch (error) {
    logger.error('Error getting predictions with sources', { error });
    return [];
  }
}