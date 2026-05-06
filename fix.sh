cat > fix-winner-announcement-oromifa.sh <<'EOF'
#!/bin/bash

FILE="components/WinnerAnnouncement.tsx"
BACKUP_DIR="backups-winner-announcement-oromifa-$(date +%Y%m%d-%H%M%S)"

if [ ! -f "$FILE" ]; then
  echo "Error: $FILE not found."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
cp "$FILE" "$BACKUP_DIR/WinnerAnnouncement.tsx.bak"

cat > "$FILE" <<'TSX'
'use client';

import { useEffect, useState } from 'react';
import { useLang } from '@/hooks/useLang';

function maskName(name?: string) {
  if (!name) return 'N******* ******K';

  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    const first = parts[0][0] || 'N';
    const last = parts[0][parts[0].length - 1] || 'K';
    return `${first}*******${last}`;
  }

  const first = parts[0][0] || 'N';
  const lastWord = parts[parts.length - 1];
  const last = lastWord[lastWord.length - 1] || 'K';

  return `${first}******* ******${last}`;
}

function maskPhone(phone?: string) {
  if (!phone) return '+251*******98';

  const cleaned = String(phone).replace(/\s+/g, '');

  if (cleaned.startsWith('+251')) {
    return `+251*******${cleaned.slice(-2)}`;
  }

  if (cleaned.startsWith('0')) {
    return `+251*******${cleaned.slice(-2)}`;
  }

  return `+251*******${cleaned.slice(-2) || '98'}`;
}

const copy = {
  en: {
    closeWinnerAnnouncement: 'Close winner announcement',
    winnerAnnounced: '🎉 Winner Announced',
  },
  am: {
    closeWinnerAnnouncement: 'የአሸናፊ ማሳወቂያን ዝጋ',
    winnerAnnounced: '🎉 አሸናፊ ተገልጿል',
  },
  om: {
    closeWinnerAnnouncement: "Beeksisa mo'ataa cufi",
    winnerAnnounced: "🎉 Mo'ataan beekameera",
  },
} as const;

export default function WinnerAnnouncement() {
  const { lang } = useLang();
  const txt = copy[lang];

  const [winner, setWinner] = useState<any>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    async function loadWinner() {
      try {
        const res = await fetch('/api/winners/latest?t=' + Date.now(), {
          cache: 'no-store',
        });

        const data = await res.json();
        const latest = data.winner || null;

        if (!latest) {
          setWinner(null);
          return;
        }

        const dismissedId = localStorage.getItem('dismissed_winner_id');

        if (dismissedId === latest.id) {
          setHidden(true);
          return;
        }

        setWinner(latest);
      } catch {
        setWinner(null);
      }
    }

    loadWinner();
  }, []);

  if (!winner || hidden) return null;

  const closeBanner = () => {
    localStorage.setItem('dismissed_winner_id', winner.id);
    setHidden(true);
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-yellow-300 bg-gradient-to-br from-yellow-50 via-orange-100 to-amber-50 p-6 shadow-2xl ring-1 ring-yellow-200 dark:border-yellow-700 dark:from-yellow-950 dark:via-slate-900 dark:to-orange-950">
      <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-yellow-300/40 blur-2xl" />
      <div className="absolute -bottom-12 -right-10 h-36 w-36 rounded-full bg-orange-400/40 blur-2xl" />

      <button
        type="button"
        onClick={closeBanner}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/90 px-3 py-1 text-lg font-bold text-gray-700 shadow hover:bg-white dark:bg-slate-800 dark:text-white"
        aria-label={txt.closeWinnerAnnouncement}
      >
        ×
      </button>

      <div className="relative text-center">
        <p className="text-sm font-extrabold uppercase tracking-widest text-yellow-700 dark:text-yellow-300">
          {txt.winnerAnnounced}
        </p>

        <h2 className="mt-4 inline-block rounded-3xl bg-gradient-to-r from-orange-500 to-yellow-400 px-8 py-4 text-7xl font-black tracking-tight text-white shadow-2xl ring-4 ring-yellow-200 dark:ring-yellow-700 sm:text-8xl">
          {winner.number}
        </h2>

        <div className="mt-5 text-lg font-bold text-gray-800 dark:text-slate-100 sm:text-xl">
          {maskName(winner.user_name)}
        </div>

        <div className="mt-1 text-base font-semibold text-gray-700 dark:text-slate-300 sm:text-lg">
          {maskPhone(winner.user_phone)}
        </div>

        <p className="mt-3 text-sm font-medium text-gray-600 dark:text-slate-400">
          {winner.drawn_at
            ? new Date(winner.drawn_at).toLocaleString(
                lang === 'am' ? 'am-ET' : 'en-US',
              )
            : ''}
        </p>
      </div>
    </section>
  );
}
TSX

echo "Done. Backup saved in: $BACKUP_DIR"
npm run build
EOF

chmod +x fix-winner-announcement-oromifa.sh
./fix-winner-announcement-oromifa.sh