BEGIN;

-- Process due recurring task templates every five minutes in Supabase itself.
-- This is the supported job for application work; it is not a database
-- keep-alive and does not change Supabase's project-pause policy.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'getweb-materialize-recurring-tasks';

SELECT cron.schedule(
  'getweb-materialize-recurring-tasks',
  '*/5 * * * *',
  $$SELECT public.materialize_due_recurring_tasks();$$
);

COMMIT;
