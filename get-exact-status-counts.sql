-- Get exact status counts for all jobs
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM job_queue 
GROUP BY status 
ORDER BY count DESC;

-- Also show jobs that might be stuck (processing for more than 1 hour)
SELECT 
  'stuck_processing' as status,
  COUNT(*) as count
FROM job_queue 
WHERE status = 'processing' 
AND started_at < NOW() - INTERVAL '1 hour';

-- Show total count
SELECT COUNT(*) as total_jobs FROM job_queue;