import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireAdmin } from '@/lib/auth/server';
import {
  clearLotterySettingsCache,
  getLotterySettings,
  refreshLotterySettingsCacheStrict,
} from '@/lib/settings/lotterySettings';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getSetting(key: string, fallback: string) {
  const rows = await sql`
    SELECT value
    FROM public.settings
    WHERE key = ${key}
    LIMIT 1
  `;
  return rows?.[0]?.value ?? fallback;
}

async function upsertSetting(key: string, value: string) {
  await sql`
    INSERT INTO public.settings (key, value, updated_at)
    VALUES (${key}, ${value}, NOW())
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
}

async function applyTicketPriceAsGlobalTarget(
  gridSize: number,
  ticketPrice: number,
  force = false,
) {
  const safeGridSize = Math.max(1, Number(gridSize || 100));
  const safeTicketPrice = Math.max(1, Number(ticketPrice || 100));

  const blocked = await sql`
    WITH approved_totals AS (
      SELECT
        si.number,
        COALESCE(SUM(si.amount), 0)::int AS approved_amount
      FROM public.submission_items si
      JOIN public.submissions s ON s.id = si.submission_id
      WHERE s.status = 'approved'
        AND si.number BETWEEN 1 AND ${safeGridSize}
      GROUP BY si.number
    )
    SELECT number, approved_amount
    FROM approved_totals
    WHERE approved_amount > ${safeTicketPrice}
    ORDER BY number ASC
    LIMIT 20
  `;

  if (blocked.length > 0 && !force) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: 'Ticket price is lower than approved contributions for some numbers',
          blocked,
        },
        { status: 400 },
      ),
    };
  }

  await sql`
    INSERT INTO public.number_pools (number, target_amount, current_amount, status, updated_at)
    SELECT gs, ${safeTicketPrice}, 0, 'open', NOW()
    FROM generate_series(1, ${safeGridSize}) gs
    ON CONFLICT (number)
    DO UPDATE SET
      target_amount = EXCLUDED.target_amount,
      updated_at = NOW()
  `;

  await sql`
    DELETE FROM public.number_pools
    WHERE number > ${safeGridSize}
  `;

  await sql`
    WITH approved_totals AS (
      SELECT
        si.number,
        COALESCE(SUM(si.amount), 0)::int AS approved_amount
      FROM public.submission_items si
      JOIN public.submissions s ON s.id = si.submission_id
      WHERE s.status = 'approved'
        AND si.number BETWEEN 1 AND ${safeGridSize}
      GROUP BY si.number
    )
    UPDATE public.number_pools np
    SET
      target_amount = ${safeTicketPrice},
      current_amount = COALESCE(at.approved_amount, 0),
      status = CASE
        WHEN COALESCE(at.approved_amount, 0) >= ${safeTicketPrice}
        THEN 'sold'
        ELSE 'open'
      END,
      updated_at = NOW()
    FROM generate_series(1, ${safeGridSize}) AS gs(number)
    LEFT JOIN approved_totals at ON at.number = gs.number
    WHERE np.number = gs.number
  `;

  return { ok: true as const };
}

function noStoreJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const settings = await getLotterySettings({ forceRefreshCache: true });
    return noStoreJson(settings);
  } catch (error: any) {
    return noStoreJson(
      { error: error.message || 'Failed to load settings' },
      {
        status:
          error.message === 'Unauthorized'
            ? 401
            : error.message === 'Forbidden'
              ? 403
              : 500,
      },
    );
  }
}

async function saveSettings(req: Request) {
  await requireAdmin(req);

  const body = await req.json().catch(() => ({}));

  const winningAmount = Number(
    body.winningAmount ?? body.winning_amount ?? body.prizeAmount ?? body.prize_amount ?? 560000,
  );

  const ticketPrice = Number(
    body.ticketPrice ?? body.ticket_price ?? body.price ?? 100,
  );

  const gridSize = Number(
    body.gridSize ?? body.grid_size ?? body.numberGridSize ?? body.numbersGridSize ?? 100,
  );

  const numbersGridStatus =
    String(
      body.numbersGridStatus ??
        body.numbers_grid_status ??
        body.gridStatus ??
        body.grid_status ??
        'open',
    ).toLowerCase() === 'closed'
      ? 'closed'
      : 'open';

  if (!Number.isInteger(winningAmount) || winningAmount <= 0) {
    return noStoreJson({ error: 'Invalid winning amount' }, { status: 400 });
  }

  if (!Number.isInteger(ticketPrice) || ticketPrice <= 0) {
    return noStoreJson({ error: 'Invalid ticket price' }, { status: 400 });
  }

  if (!Number.isInteger(gridSize) || gridSize <= 0 || gridSize > 20000) {
    return noStoreJson({ error: 'Invalid grid size' }, { status: 400 });
  }

  const result = await applyTicketPriceAsGlobalTarget(
    gridSize,
    ticketPrice,
    Boolean(body.force),
  );

  if (!result.ok) return result.response;

  await upsertSetting('winning_amount', String(winningAmount));
  await upsertSetting('ticket_price', String(ticketPrice));
  await upsertSetting('grid_size', String(gridSize));
  await upsertSetting('numbers_grid_status', numbersGridStatus);

  // IMPORTANT:
  // refresh_all_number_status_summary_cache() reads settings.grid_size internally,
  // so it must run after settings.grid_size has been saved.
  await sql`SELECT public.refresh_all_number_status_summary_cache()`;

  // Same pattern as ticket_price -> number_status_summary_cache:
  // grid_size/status -> lottery_settings_cache.
  await refreshLotterySettingsCacheStrict();
  clearLotterySettingsCache();

  const confirmed = await getLotterySettings({ forceRefreshCache: true });
  const defaultTargetAmount = Number(await getSetting('default_target_amount', '5000'));

  return noStoreJson({
    ...confirmed,
    ok: true,
    defaultTargetAmount,
    default_target_amount: defaultTargetAmount,
    source: 'settings-save',
  });
}

export async function POST(req: Request) {
  try {
    return await saveSettings(req);
  } catch (error: any) {
    console.error('Save admin settings error:', error);
    return noStoreJson(
      { error: error.message || 'Failed to save settings' },
      {
        status:
          error.message === 'Unauthorized'
            ? 401
            : error.message === 'Forbidden'
              ? 403
              : 500,
      },
    );
  }
}

export async function PUT(req: Request) {
  try {
    return await saveSettings(req);
  } catch (error: any) {
    console.error('Update admin settings error:', error);
    return noStoreJson(
      { error: error.message || 'Failed to update settings' },
      {
        status:
          error.message === 'Unauthorized'
            ? 401
            : error.message === 'Forbidden'
              ? 403
              : 500,
      },
    );
  }
}
