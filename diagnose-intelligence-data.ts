#!/usr/bin/env ts-node -r tsconfig-paths/register

import { supabase } from './src/services/database/client';

async function diagnoseIntelligenceData() {
  console.log('🔍 Diagnosing Intelligence Data Requirements...\n');

  try {
    // 1. Check processed content
    console.log('📊 Checking processed_content table...');
    const { data: contentStats, error: contentError } = await supabase
      .from('processed_content')
      .select('id, processed_text, sentiment_score, entities, key_topics, created_at')
      .limit(5);

    if (contentError) {
      console.error('❌ Error querying processed_content:', contentError);
      return;
    }

    console.log(`✅ Found ${contentStats?.length || 0} content items (showing first 5)`);
    
    if (contentStats && contentStats.length > 0) {
      const sample = contentStats[0];
      if (sample) {
        console.log('📝 Sample content structure:');
        console.log('- Has text:', !!sample.processed_text);
        console.log('- Has sentiment:', sample.sentiment_score !== null);
        console.log('- Has entities:', !!sample.entities);
        console.log('- Has topics:', !!sample.key_topics);
        console.log('- Sample entities:', JSON.stringify(sample.entities, null, 2));
      }
    }

    // 2. Check total counts
    console.log('\n📈 Getting total counts...');
    const { count: totalContent } = await supabase
      .from('processed_content')
      .select('id', { count: 'exact', head: true });

    const { count: withEntities } = await supabase
      .from('processed_content')
      .select('id', { count: 'exact', head: true })
      .not('entities', 'is', null);

    const { count: withSentiment } = await supabase
      .from('processed_content')
      .select('id', { count: 'exact', head: true })
      .not('sentiment_score', 'is', null);

    console.log(`- Total content: ${totalContent || 0}`);
    console.log(`- With entities: ${withEntities || 0}`);
    console.log(`- With sentiment: ${withSentiment || 0}`);

    // 3. Check recent content (last 7 days)
    console.log('\n📅 Checking recent content (last 7 days)...');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: recentContent } = await supabase
      .from('processed_content')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());

    console.log(`- Recent content (7d): ${recentContent || 0}`);

    // 4. Check feed sources
    console.log('\n📡 Checking feed sources...');
    const { data: sources, error: sourcesError } = await supabase
      .from('feed_sources')
      .select('id, name, type, is_active, last_processed_at');

    if (sourcesError) {
      console.error('❌ Error querying feed_sources:', sourcesError);
    } else {
      console.log(`✅ Found ${sources?.length || 0} feed sources`);
      const activeSources = sources?.filter(s => s.is_active) || [];
      console.log(`- Active sources: ${activeSources.length}`);
      
      if (activeSources.length > 0) {
        console.log('- Sample sources:');
        activeSources.slice(0, 3).forEach(source => {
          console.log(`  * ${source.name} (${source.type}) - Last processed: ${source.last_processed_at || 'Never'}`);
        });
      }
    }

    // 5. Check for entity patterns
    console.log('\n🏢 Analyzing entity patterns...');
    const { data: entitySamples } = await supabase
      .from('processed_content')
      .select('entities')
      .not('entities', 'is', null)
      .limit(10);

    if (entitySamples && entitySamples.length > 0) {
      const allEntities = new Set<string>();
      const companiesSet = new Set<string>();
      const peopleSet = new Set<string>();

      entitySamples.forEach(sample => {
        const entities = sample.entities || {};
        
        (entities.companies || []).forEach((c: string) => {
          companiesSet.add(c);
          allEntities.add(c);
        });
        
        (entities.people || []).forEach((p: string) => {
          peopleSet.add(p);
          allEntities.add(p);
        });
      });

      console.log(`- Unique entities found: ${allEntities.size}`);
      console.log(`- Companies: ${companiesSet.size}`);
      console.log(`- People: ${peopleSet.size}`);
      
      if (companiesSet.size > 0) {
        console.log('- Sample companies:', Array.from(companiesSet).slice(0, 5).join(', '));
      }
      if (peopleSet.size > 0) {
        console.log('- Sample people:', Array.from(peopleSet).slice(0, 5).join(', '));
      }
    }

    // 6. Intelligence requirements assessment
    console.log('\n🎯 Intelligence Requirements Assessment:');
    
    const requirements = {
      signalDivergence: {
        needed: 'Multiple content items from different sources with sentiment scores',
        available: (withSentiment || 0) >= 10 && (sources?.length || 0) >= 2
      },
      entityNetwork: {
        needed: 'Content with extracted entities (companies, people)',
        available: (withEntities || 0) >= 10
      },
      narrativeMomentum: {
        needed: 'Recent content with topics and sentiment trends',
        available: (recentContent || 0) >= 5
      },
      silenceDetection: {
        needed: 'Historical entity mention patterns (30+ days)',
        available: (totalContent || 0) >= 50
      },
      languageComplexity: {
        needed: 'Substantial text content for linguistic analysis',
        available: (contentStats?.filter(c => c.processed_text && c.processed_text.length > 200) || []).length >= 5
      }
    };

    Object.entries(requirements).forEach(([feature, req]) => {
      const status = req.available ? '✅' : '❌';
      console.log(`${status} ${feature}: ${req.needed} - ${req.available ? 'Available' : 'Not enough data'}`);
    });

    console.log('\n💡 Recommendations:');
    
    if ((totalContent || 0) < 50) {
      console.log('🔄 Process more feeds to get sufficient historical data');
    }
    
    if ((recentContent || 0) < 10) {
      console.log('⏰ Need more recent content - run feed processing');
    }
    
    if ((withEntities || 0) < (totalContent || 0) * 0.5) {
      console.log('🏷️ Improve entity extraction in content processing');
    }

  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
}

// Run the diagnosis
diagnoseIntelligenceData().then(() => {
  console.log('\n✅ Diagnosis complete!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Diagnosis crashed:', error);
  process.exit(1);
});