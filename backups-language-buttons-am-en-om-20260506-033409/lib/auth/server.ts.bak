import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'change-this-secret';

export type AuthUser = {
  userId: string;
  id?: string;
  name?: string;
  phone?: string;
  role?: string;
  isAdmin?: boolean;
  is_admin?: boolean;
};

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

  const cookieToken = req.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('token='))
    ?.replace('token=', '');

  const token = bearerToken || cookieToken || '';

  if (!token || token === 'null' || token === 'undefined') {
    return null;
  }

  return token;
}

export function signUser(payload: AuthUser) {
  const admin = isAdminUser(payload);

  return jwt.sign(
    {
      userId: payload.userId || payload.id,
      id: payload.userId || payload.id,
      name: payload.name || '',
      phone: payload.phone || '',
      role: admin ? 'admin' : payload.role || 'user',
      isAdmin: admin,
    },
    SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyRequest(req: Request): AuthUser {
  const token = getTokenFromRequest(req);

  if (!token) {
    throw new Error('Unauthorized');
  }

  try {
    return jwt.verify(token, SECRET) as AuthUser;
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
