export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { sql } from '@/lib/db/sql';
import { signUser, isAdminUser } from '@/lib/auth/server';

export async function POST(req: Request) {
  try {
    const { phone, password } = await req.json();

    if (!phone || !password) {
      return NextResponse.json(
        { error: 'Phone and password are required' },
        { status: 400 }
      );
    }

    let formattedPhone = String(phone).trim();

    if (formattedPhone.startsWith('0')) {
      formattedPhone = '+251' + formattedPhone.substring(1);
    }

    const users = await sql`
      SELECT *
      FROM users
      WHERE phone = ${phone}
      OR phone = ${formattedPhone}
      LIMIT 1
    `;

    if (!users.length) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = users[0];
    const passwordHash = user.password || user.password_hash;

    if (!passwordHash) {
      return NextResponse.json(
        { error: 'Invalid user password setup' },
        { status: 500 }
      );
    }

    const valid = await bcrypt.compare(password, passwordHash);

    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const admin = isAdminUser(user);

    const sessionUser = {
      id: user.id,
      userId: user.id,
      name: user.name,
      phone: user.phone,
      role: admin ? 'admin' : user.role || 'user',
      isAdmin: admin,
    };

    const token = signUser(sessionUser);

    const response = NextResponse.json({
      success: true,
      token,
      redirectTo: admin ? '/admin' : '/dashboard',
      user: sessionUser,
    });

    response.cookies.set('token', token, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
