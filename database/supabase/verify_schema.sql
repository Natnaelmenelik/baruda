SELECT table_name
FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('number_status_summary','admin_stats_summary','submission_stats_summary','submissions','submission_items','payment_holds','number_pools','users','settings')
ORDER BY table_name;

SELECT conrelid::regclass AS table_name, conname, contype
FROM pg_constraint
WHERE conrelid::regclass::text IN ('number_pools','payment_holds','users','settings','submissions','submission_items')
ORDER BY table_name, conname;

SELECT COUNT(*) AS number_summary_count FROM public.number_status_summary;
SELECT * FROM public.admin_stats_summary WHERE id=1;
