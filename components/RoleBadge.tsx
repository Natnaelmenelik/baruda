'use client';

import { getClientUser } from '@/lib/auth/client';
import { useLang } from '@/hooks/useLang';

export default function RoleBadge() {
  const user = getClientUser();
  const { t } = useLang();
  if (!user) return null;
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${user.isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{user.isAdmin ? t.roleAdmin : t.roleUser}</span>;
}
