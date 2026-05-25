# Supabase Database Schema Package

Run `000_full_schema_production.sql` in Supabase SQL Editor after creating/restoring your database.

It includes:

- Core tables
- Primary keys and unique constraints for `ON CONFLICT`
- Indexes for performance
- Summary tables
- Summary refresh functions
- Triggers that keep summaries updated
- Approved submission backup trigger
- Realtime publication setup
- Default settings and number pool seed

Recommended order:

1. Backup old DB.
2. Restore/import raw data if any.
3. Run `database/supabase/000_full_schema_production.sql`.
4. Confirm summary rows:

```sql
SELECT COUNT(*) FROM public.number_status_summary;
SELECT * FROM public.admin_stats_summary;
```

5. Enable frontend realtime hooks.
