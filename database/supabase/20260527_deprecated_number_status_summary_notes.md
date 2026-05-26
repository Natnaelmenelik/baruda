# number_status_summary deprecation note

`number_status_summary_cache` is now the active number availability source.

Kept temporarily:
- `number_status_summary` table
- old SQL files/migrations for history

Stopped/changed:
- App reads from `number_status_summary` were changed to `number_status_summary_cache`.
- Old realtime hook now listens to `number_status_summary_cache`.
- Old triggers maintaining `number_status_summary` are dropped by the migration SQL.
- Admin stats now read number counts from `number_status_summary_cache`.

Do not drop `number_status_summary` until production has been stable and grep shows no active code references.
