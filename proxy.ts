import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

function getSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.trim().length < 16) {
    throw new Error('JWT_SECRET is missing or too short.');
  }

  return new TextEncoder().encode(secret);
}

function isAdminUser(user: any) {
  return Boolean(
    user?.isAdmin === true ||
      user?.is_admin === true ||
      user?.role === 'admin' ||
      user?.role === 'ADMIN'
  );
}

async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as any;
}

export async function proxy(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const path = req.nextUrl.pathname;

  const isLoginRoute = path === '/login';
  const isRegisterRoute = path === '/register';
  const isAdminRoute = path.startsWith('/admin') || path.startsWith('/minsam');
  const isDashboardRoute = path.startsWith('/dashboard');

  if (!token || token === 'null' || token === 'undefined') {
    if (isAdminRoute || isDashboardRoute) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('redirect', path);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  try {
    const user = await verifyToken(token);
    const admin = isAdminUser(user);

    if (isLoginRoute || isRegisterRoute) {
      return NextResponse.redirect(
        new URL(admin ? '/admin' : '/dashboard', req.url)
      );
    }

    if (isDashboardRoute && admin) {
      return NextResponse.redirect(new URL('/admin', req.url));
    }

    if (isAdminRoute && !admin) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.delete('token');
    return res;
  }
}

export const config = {
  matcher: ['/login', '/register', '/admin/:path*', '/minsam/:path*', '/dashboard/:path*'],
};
