export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';

function normalizePhone(input: unknown) {
  let phone = String(input || '').trim().replace(/\s+/g, '');

  if (phone.startsWith('0')) {
    phone = '+251' + phone.slice(1);
  }

  return phone;
}

function normalizeAdminPhone(input: string | undefined) {
  return normalizePhone(input || '');
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { success: false, code: 'INVALID_REQUEST', error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const phone = normalizePhone(body.phone);
    const name = String(body.name || '').trim();
    const email = body.email ? String(body.email).trim() : null;
    const password = String(body.password || '');

    if (!phone || !name || !password) {
      return NextResponse.json(
        {
          success: false,
          code: 'PHONE_NAME_PASSWORD_REQUIRED',
          error: 'Phone, name, and password are required',
        },
        { status: 400 }
      );
    }

    const existing = await sql`
      SELECT id
      FROM users
      WHERE phone = ${phone}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          code: 'PHONE_ALREADY_REGISTERED',
          error: 'Phone already registered',
        },
        { status: 409 }
      );
    }

    const adminPhone = normalizeAdminPhone(process.env.ADMIN_PHONE);
    const isAdmin = Boolean(adminPhone && phone === adminPhone);

    const inserted = await sql`
      INSERT INTO users (
        phone,
        name,
        email,
        password_hash,
        is_admin,
        role,
        created_at,
        updated_at
      )
      VALUES (
        ${phone},
        ${name},
        ${email},
        ${password},
        ${isAdmin},
        ${isAdmin ? 'admin' : 'user'},
        NOW(),
        NOW()
      )
      RETURNING id, name, phone, email, is_admin, role, created_at
    `;

    return NextResponse.json({
      success: true,
      code: 'REGISTER_SUCCESS',
      user: inserted[0],
    });
  } catch (error: any) {
    console.error('Registration error:', error);

    if (error?.code === '23505') {
      return NextResponse.json(
        {
          success: false,
          code: 'PHONE_ALREADY_REGISTERED',
          error: 'Phone already registered',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        code: 'REGISTER_FAILED',
        error: 'Registration failed',
      },
      { status: 500 }
    );
  }
}
