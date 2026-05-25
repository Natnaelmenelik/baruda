import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';

export const dynamic = 'force-dynamic';

type ResetPasswordBody = {
  token?: unknown;
  password?: unknown;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ResetPasswordBody;

    const token = String(body.token || '').trim();
    const password = String(body.password || '').trim();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 },
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: 'Password must be at least 4 characters' },
        { status: 400 },
      );
    }

    const resetRows = await sql`
      SELECT id, user_id
      FROM password_resets
      WHERE token = ${token}
        AND used_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
    `;

    const reset = resetRows[0];

    if (!reset?.user_id) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 },
      );
    }

    /*
      Current login/register logic in this project stores the password string
      in users.password_hash without hashing. This keeps compatibility with
      the existing login system and fixes the build.

      Security improvement should be done separately by migrating login,
      register, and reset-password together to bcrypt/argon2.
    */
    await sql`
      UPDATE users
      SET password_hash = ${password},
          updated_at = NOW()
      WHERE id = ${reset.user_id}
    `;

    await sql`
      UPDATE password_resets
      SET used_at = NOW()
      WHERE id = ${reset.id}
    `;

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('POST /api/auth/reset-password failed:', error);

    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 },
    );
  }
}
