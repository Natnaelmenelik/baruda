import { sql } from '@/lib/db/sql';

export const DEFAULT_TICKET_PRICE = 300;
export const DEFAULT_GRID_SIZE = 2000;

const SETTINGS_CACHE_TTL_MS = 5_000;
let cachedSettings: { value: LotterySettings; expiresAt: number } | null = null;

type LotterySettings = {
  ticketPrice: number;
  gridSize: number;
};

function cleanPositiveNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeSettings(rows: Array<{ key: string; value: unknown }>): LotterySettings {
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    ticketPrice: cleanPositiveNumber(map.get('ticket_price'), DEFAULT_TICKET_PRICE),
    gridSize: cleanPositiveNumber(map.get('grid_size'), DEFAULT_GRID_SIZE),
  };
}

export function clearLotterySettingsCache() {
  cachedSettings = null;
}

export async function getSettingNumber(key: string, fallback: number) {
  const settings = await getLotterySettings();
  if (key === 'ticket_price') return settings.ticketPrice;
  if (key === 'grid_size') return settings.gridSize;

  try {
    const rows = await sql`
      SELECT value
      FROM settings
      WHERE key = ${key}
      LIMIT 1
    `;
    return cleanPositiveNumber(rows?.[0]?.value, fallback);
  } catch (error) {
    console.error(`Failed to fetch setting ${key}:`, error);
    return fallback;
  }
}

export async function getTicketPrice() {
  return getSettingNumber('ticket_price', DEFAULT_TICKET_PRICE);
}

export async function getGridSize() {
  return getSettingNumber('grid_size', DEFAULT_GRID_SIZE);
}

export async function getLotterySettings() {
  const now = Date.now();
  if (cachedSettings && cachedSettings.expiresAt > now) {
    return cachedSettings.value;
  }

  try {
    const rows = await sql`
      SELECT key, value
      FROM settings
      WHERE key IN ('ticket_price', 'grid_size')
    `;

    const value = normalizeSettings(rows as unknown as Array<{ key: string; value: unknown }>);
    cachedSettings = { value, expiresAt: now + SETTINGS_CACHE_TTL_MS };
    return value;
  } catch (error) {
    console.error('Failed to fetch lottery settings:', error);
    return {
      ticketPrice: DEFAULT_TICKET_PRICE,
      gridSize: DEFAULT_GRID_SIZE,
    };
  }
}
