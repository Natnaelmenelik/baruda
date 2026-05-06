import { sql } from '@/lib/db/sql';

export async function getTicketPrice() {
  // 1. Fetch from existing settings table
  try {
    const rows = await sql`
      SELECT value
      FROM settings
      WHERE key = 'ticket_price'
      LIMIT 1
    `;

    const dbPrice = Number(rows?.[0]?.value);

    if (Number.isFinite(dbPrice) && dbPrice > 0) {
      return dbPrice;
    }
  } catch (error) {
    console.error('Failed to fetch ticket price from settings:', error);
  }

  // 2. Fallback to env
  const envPrice = Number(
    process.env.DEFAULT_TICKET_PRICE ||
    process.env.TICKET_PRICE ||
    process.env.NEXT_PUBLIC_TICKET_PRICE ||
    0
  );

  if (Number.isFinite(envPrice) && envPrice > 0) {
    return envPrice;
  }

  throw new Error('Ticket price is not configured');
}
