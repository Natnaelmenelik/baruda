export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireAdmin } from '@/lib/auth/server';

export async function POST(req: Request) {
  try {
    const admin = requireAdmin(req);

    const users = await sql`
      SELECT id, name, phone, email, is_admin, role, created_at
      FROM users
      ORDER BY created_at DESC
    `;

    const submissions = await sql`
      SELECT *
      FROM submissions
      ORDER BY submitted_at DESC
    `;

    const winners = await sql`
      SELECT *
      FROM winners
      ORDER BY drawn_at DESC
    `;

    const backupName = `system_backup_${new Date().toISOString()}`;

    await sql`
      INSERT INTO system_backups (
        backup_name,
        backup_data,
        users_count,
        submissions_count,
        winners_count
      )
      VALUES (
        ${backupName},
        ${JSON.stringify({
          createdBy: admin.userId,
          createdAt: new Date().toISOString(),
          users,
          submissions,
          winners,
        })}::jsonb,
        ${users.length},
        ${submissions.length},
        ${winners.length}
      )
    `;

    return NextResponse.json({
      success: true,
      message: 'Backup created successfully',
      backupName,
      users: users.length,
      submissions: submissions.length,
      winners: winners.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Backup failed' },
      {
        status:
          error.message === 'Unauthorized'
            ? 401
            : error.message === 'Forbidden'
            ? 403
            : 500,
      }
    );
  }
}
