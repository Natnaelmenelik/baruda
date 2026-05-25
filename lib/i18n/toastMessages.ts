import { translations, Lang } from "@/lib/i18n/translations";

// Compatibility wrapper: all toast text now lives in translations.ts.
// Existing imports can keep using tm(lang, key), but there is no separate
// toastMessages dictionary anymore.
export type ToastKey = string;

export function tm(lang: Lang, key: ToastKey) {
  const txt = (translations as any)[lang] || (translations as any).en;
  return txt?.[key] || (translations as any).en?.[key] || key;
}
