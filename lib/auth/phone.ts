export function normalizePhone(phone: unknown) {
  const raw = String(phone || '').trim();

  if (!raw) return '';

  const compact = raw.replace(/[\s-]/g, '');

  if (compact.startsWith('+251')) {
    return '+251' + compact.slice(4);
  }

  if (compact.startsWith('251')) {
    return '+251' + compact.slice(3);
  }

  if (compact.startsWith('0')) {
    return '+251' + compact.slice(1);
  }

  return compact;
}

export function isValidPhone(phone: unknown) {
  const normalized = normalizePhone(phone);
  return /^\+251\d{9}$/.test(normalized);
}
