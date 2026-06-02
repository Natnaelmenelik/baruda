import { sql } from '@/lib/db/sql';

export const DEFAULT_WINNING_AMOUNT = 560000;
export const DEFAULT_TICKET_PRICE = 300;
export const DEFAULT_GRID_SIZE = 2000;
export const DEFAULT_TARGET_AMOUNT = 5000;

export type LotteryGridStatus = 'open' | 'closed';

export type LotterySettings = {
  ok?: true;
  winningAmount: number;
  winning_amount: number;
  ticketPrice: number;
  ticket_price: number;
  gridSize: number;
  grid_size: number;
  defaultTargetAmount: number;
  default_target_amount: number;
  numbersGridStatus: LotteryGridStatus;
  numbers_grid_status: LotteryGridStatus;
  numbersGridOpen: boolean;
  numbers_grid_open: boolean;
  updatedAt: string | null;
  updated_at: string | null;
  source: 'lottery_settings_cache' | 'settings' | 'fallback' | 'settings-save';
};

type SettingsRow = { key: string; value: unknown };
type CacheRow = {
  winning_amount?: unknown;
  ticket_price?: unknown;
  grid_size?: unknown;
  numbers_grid_status?: unknown;
  updated_at?: unknown;
};

let cachedSettings: LotterySettings | null = null;

function positiveInteger(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : fallback;
}

function normalizeStatus(value: unknown): LotteryGridStatus {
  return String(value || 'open').toLowerCase() === 'closed' ? 'closed' : 'open';
}

function buildSettings(input: {
  winningAmount?: unknown;
  ticketPrice?: unknown;
  gridSize?: unknown;
  defaultTargetAmount?: unknown;
  numbersGridStatus?: unknown;
  updatedAt?: unknown;
  source: LotterySettings['source'];
}): LotterySettings {
  const winningAmount = positiveInteger(input.winningAmount, DEFAULT_WINNING_AMOUNT);
  const ticketPrice = positiveInteger(input.ticketPrice, DEFAULT_TICKET_PRICE);
  const gridSize = positiveInteger(input.gridSize, DEFAULT_GRID_SIZE);
  const defaultTargetAmount = positiveInteger(input.defaultTargetAmount, DEFAULT_TARGET_AMOUNT);
  const numbersGridStatus = normalizeStatus(input.numbersGridStatus);
  const updatedAt = input.updatedAt ? String(input.updatedAt) : null;

  return {
    ok: true,
    winningAmount,
    winning_amount: winningAmount,
    ticketPrice,
    ticket_price: ticketPrice,
    gridSize,
    grid_size: gridSize,
    defaultTargetAmount,
    default_target_amount: defaultTargetAmount,
    numbersGridStatus,
    numbers_grid_status: numbersGridStatus,
    numbersGridOpen: numbersGridStatus !== 'closed',
    numbers_grid_open: numbersGridStatus !== 'closed',
    updatedAt,
    updated_at: updatedAt,
    source: input.source,
  };
}

function normalizeSettingsRows(rows: SettingsRow[]): LotterySettings {
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return buildSettings({
    winningAmount: map.get('winning_amount'),
    ticketPrice: map.get('ticket_price'),
    gridSize: map.get('grid_size'),
    defaultTargetAmount: map.get('default_target_amount'),
    numbersGridStatus: map.get('numbers_grid_status'),
    source: 'settings',
  });
}

function normalizeCacheRow(row: CacheRow, defaultTargetAmount?: unknown): LotterySettings {
  return buildSettings({
    winningAmount: row.winning_amount,
    ticketPrice: row.ticket_price,
    gridSize: row.grid_size,
    defaultTargetAmount,
    numbersGridStatus: row.numbers_grid_status,
    updatedAt: row.updated_at,
    source: 'lottery_settings_cache',
  });
}

export function clearLotterySettingsCache() {
  cachedSettings = null;
}

export async function refreshLotterySettingsCacheStrict() {
  await sql`SELECT public.refresh_lottery_settings_cache()`;
  clearLotterySettingsCache();
}

export async function refreshLotterySettingsCacheIfAvailable() {
  try {
    await refreshLotterySettingsCacheStrict();
    return true;
  } catch (error) {
    console.warn('refresh_lottery_settings_cache() failed or is not deployed:', error);
    return false;
  }
}

async function getDefaultTargetAmountFromSettings() {
  try {
    const rows = await sql`
      SELECT value
      FROM public.settings
      WHERE key = 'default_target_amount'
      LIMIT 1
    `;
    return positiveInteger(rows?.[0]?.value, DEFAULT_TARGET_AMOUNT);
  } catch {
    return DEFAULT_TARGET_AMOUNT;
  }
}

async function getLotterySettingsFromCacheTable() {
  const rows = await sql`
    SELECT winning_amount, ticket_price, grid_size, numbers_grid_status, updated_at
    FROM public.lottery_settings_cache
    WHERE id = 1
    LIMIT 1
  `;

  if (!rows?.length) return null;
  const defaultTargetAmount = await getDefaultTargetAmountFromSettings();
  return normalizeCacheRow(rows[0] as CacheRow, defaultTargetAmount);
}

async function getLotterySettingsFromRawSettings() {
  const rows = await sql`
    SELECT key, value
    FROM public.settings
    WHERE key IN ('winning_amount', 'ticket_price', 'grid_size', 'default_target_amount', 'numbers_grid_status')
  `;

  return normalizeSettingsRows(rows as unknown as SettingsRow[]);
}

export async function getLotterySettings(options?: { forceRefreshCache?: boolean }) {
  if (!options?.forceRefreshCache && cachedSettings) return cachedSettings;

  if (options?.forceRefreshCache) {
    await refreshLotterySettingsCacheIfAvailable();
  }

  try {
    let settings: LotterySettings | null = null;

    try {
      settings = await getLotterySettingsFromCacheTable();
    } catch (cacheError) {
      console.warn('Could not read lottery_settings_cache; falling back to settings:', cacheError);
    }

    if (!settings) {
      settings = await getLotterySettingsFromRawSettings();
    }

    cachedSettings = settings;
    return settings;
  } catch (error) {
    console.error('Failed to load lottery settings:', error);
    return buildSettings({ source: 'fallback' });
  }
}

export async function getSettingNumber(key: string, fallback: number) {
  const settings = await getLotterySettings();

  if (key === 'winning_amount') return settings.winningAmount;
  if (key === 'ticket_price') return settings.ticketPrice;
  if (key === 'grid_size') return settings.gridSize;
  if (key === 'default_target_amount') return settings.defaultTargetAmount;

  try {
    const rows = await sql`
      SELECT value
      FROM public.settings
      WHERE key = ${key}
      LIMIT 1
    `;
    return positiveInteger(rows?.[0]?.value, fallback);
  } catch (error) {
    console.error(`Failed to fetch setting ${key}:`, error);
    return fallback;
  }
}

export async function getWinningAmount() {
  return getSettingNumber('winning_amount', DEFAULT_WINNING_AMOUNT);
}

export async function getTicketPrice() {
  return getSettingNumber('ticket_price', DEFAULT_TICKET_PRICE);
}

export async function getGridSize() {
  return getSettingNumber('grid_size', DEFAULT_GRID_SIZE);
}
