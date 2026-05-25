# Dashboard Realtime Without Refresh

If dashboard message / winner announcement only appears after refresh, the frontend initial fetch is working, but Supabase Realtime is not delivering `postgres_changes` to the browser.

## Required Supabase setup

Run this SQL once in **Supabase Dashboard → SQL Editor**:

```sql
-- file in this project:
-- supabase/sql/20260524_enable_dashboard_realtime.sql
```

After running it, keep the dashboard open, post a dashboard message from admin, and check browser console. You should see:

```txt
[Realtime] dashboard announcements: SUBSCRIBED
```

Then the message should appear without refresh.

## Important

Global messages are safe to display to all users:

- `settings` row where `key = dashboard_message`
- `winner_announcements`

User-specific approved-number messages are different. They come from `submissions`, which may contain private user/payment data. Do not expose `submissions` publicly just to make Realtime work.

If your app uses custom JWT auth instead of Supabase Auth, Supabase Realtime cannot automatically enforce `user_id = current app user` unless your token is Supabase-compatible and RLS policies read that claim.

Production-safe options for approved-number messages:

1. Use Supabase-compatible JWT + RLS on `submissions`.
2. Better: create a small `user_notifications` table containing only safe notification data and secure it properly.
3. Fallback: fetch notifications once on dashboard load and on focus.
