import jwt from 'jsonwebtoken';

export type AuthUser = {
  userId: string;
  id?: string;
  name?: string;
  phone?: string;
  email?: string | null;
  role?: string;
  isAdmin?: boolean;
  is_admin?: boolean;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.trim().length < 16) {
    throw new Error('JWT_SECRET is missing or too short. Set a strong JWT_SECRET in .env.local.');
  }

  return secret;
}

export function isAdminUser(user: any) {
  return Boolean(
    user?.isAdmin === true ||
      user?.is_admin === true ||
      user?.role === 'admin' ||
      user?.role === 'ADMIN'
  );
}

export function getTokenFromRequest(req: Request) {
  const authHeader =
    req.headers.get('authorization') || req.headers.get('Authorization');

  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.replace('Bearer ', '').trim()
      : '';

  const rawCookieToken = req.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('token='))
    ?.replace('token=', '');

  const cookieToken = rawCookieToken ? decodeURIComponent(rawCookieToken) : '';
  const token = bearerToken || cookieToken || '';

  if (!token || token === 'null' || token === 'undefined') {
    return null;
  }

  return token;
}

export function signUser(payload: AuthUser) {
  const admin = isAdminUser(payload);
  const id = payload.userId || payload.id;

  if (!id) {
    throw new Error('Cannot sign user without id');
  }

  return jwt.sign(
    {
      userId: id,
      id,
      name: payload.name || '',
      phone: payload.phone || '',
      email: payload.email || null,
      role: admin ? 'admin' : payload.role || 'user',
      isAdmin: admin,
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

export function verifyRequest(req: Request): AuthUser {
  const token = getTokenFromRequest(req);

  if (!token) {
    throw new Error('Unauthorized');
  }

  try {
    return jwt.verify(token, getJwtSecret()) as AuthUser;
  } catch {
    throw new Error('Unauthorized');
  }
}

export function requireUser(req: Request): AuthUser {
  return verifyRequest(req);
}

export function requireAdmin(req: Request): AuthUser {
  const user = verifyRequest(req);

  if (!isAdminUser(user)) {
    throw new Error('Forbidden');
  }

  return user;
}
