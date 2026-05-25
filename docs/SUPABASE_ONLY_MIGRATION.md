# Supabase-only migration

This patch removes the Neon serverless client and uses Supabase for:

- PostgreSQL database via `DATABASE_URL`
- Realtime via `@supabase/supabase-js`
- Private receipt storage via Supabase Storage
- Signed receipt URLs via server route

## Required environment variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_RECEIPTS_BUCKET=receipts
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
DATABASE_POOL_MAX=5
JWT_SECRET=your-existing-secret
```

## Install dependencies

```bash
npm install
```

This installs:

- `postgres`
- `@supabase/supabase-js`

and removes the need for:

- `@neondatabase/serverless`

## Run SQL

Run your main schema first, then:

```sql
database/supabase/002_storage_and_realtime.sql
```

## Important

The app still uses `sql\`...\`` in API routes, but that now comes from `postgres.js` connected to Supabase Postgres.

No Neon connection is required anymore.
