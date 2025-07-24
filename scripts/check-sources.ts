import { supabase } from '../src/services/database/client';

async function checkSources() {
  try {
    const { data: sources, error } = await supabase
      .from('feed_sources')
      .select('id, name, type, is_active')
      .eq('is_active', true);
    
    console.log('Active feed sources:', sources?.length || 0);
    sources?.forEach(s => console.log(`- ${s.name} (${s.type})`));
    
    // Check recent content
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: content } = await supabase
      .from('processed_content')
      .select('id, created_at')
      .gte('created_at', yesterday.toISOString())
      .limit(5);
    
    console.log('\nRecent processed content:', content?.length || 0);
    
    // Check if we have any daily analysis
    const { data: analysis } = await supabase
      .from('daily_analysis')
      .select('analysis_date, ai_analysis')
      .order('analysis_date', { ascending: false })
      .limit(1)
      .single();
    
    console.log('\nLatest analysis date:', analysis?.analysis_date);
    console.log('Has source tracking:', analysis?.ai_analysis?.source_ids ? 'Yes' : 'No');
    if (analysis?.ai_analysis?.sources) {
      console.log('Sources in analysis:', analysis.ai_analysis.sources);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkSources();