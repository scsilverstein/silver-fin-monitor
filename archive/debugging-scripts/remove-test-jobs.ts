import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_KEY as string
);

async function removeTestJobs() {
  const { error } = await supabase
    .from('job_queue')
    .delete()
    .eq('job_type', 'queue_test');

  if (!error) {
    console.log('✅ Removed test jobs');
  } else {
    console.error('Error:', error);
  }
}

removeTestJobs();