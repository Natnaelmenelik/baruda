"use client";

import { useState } from "react";
import { useLang } from "@/hooks/useLang";
import { translations } from "@/lib/i18n/translations";

type WinnerAnnouncementData = {
  id: string;
  first_number: number;
  second_number: number;
  third_number: number;
  expires_at: string;
  created_at: string;
};

type WinnerItem = {
  title: string;
  number: number;
};

type Props = {
  announcement?: WinnerAnnouncementData | null;
};

export default function WinnerAnnouncement({ announcement }: Props) {
  const { lang } = useLang();
  const txt = translations[lang] || translations.en;

  const [hiddenAnnouncementId, setHiddenAnnouncementId] = useState<
    string | null
  >(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("hidden_winner_announcement_id");
  });

  const label = (key: string, fallback: string) => {
    const value = (txt as any)?.[key];
    return typeof value === "string" && value.trim() ? value : fallback;
  };

  if (!announcement) return null;
  if (hiddenAnnouncementId === String(announcement.id)) return null;

  const winners: WinnerItem[] = [
    {
      title: label("firstWinner", "1st Winner"),
      number: announcement.first_number,
    },
    {
      title: label("secondWinner", "2nd Winner"),
      number: announcement.second_number,
    },
    {
      title: label("thirdWinner", "3rd Winner"),
      number: announcement.third_number,
    },
  ];

  function hideAnnouncement() {
    if (!announcement) return;
    localStorage.setItem(
      "hidden_winner_announcement_id",
      String(announcement.id),
    );
    setHiddenAnnouncementId(String(announcement.id));
  }

  const winnerSizeClasses = [
    {
      card: "h-[92px] max-w-[110px] sm:h-[150px] sm:max-w-[190px] md:h-auto md:max-w-[300px]",
      brand: "text-base sm:text-3xl md:text-6xl",
      number: "text-[2.5rem] sm:text-[4.6rem] md:text-[8rem]",
      label: "text-[10px] sm:text-sm md:text-base",
    },
    {
      card: "h-[86px] max-w-[100px] sm:h-[135px] sm:max-w-[165px] md:h-auto md:max-w-[250px]",
      brand: "text-sm sm:text-2xl md:text-5xl",
      number: "text-[2.25rem] sm:text-[3.9rem] md:text-[6.5rem]",
      label: "text-[9px] sm:text-xs md:text-sm",
    },
    {
      card: "h-[80px] max-w-[92px] sm:h-[120px] sm:max-w-[145px] md:h-auto md:max-w-[215px]",
      brand: "text-xs sm:text-xl md:text-4xl",
      number: "text-[2rem] sm:text-[3.3rem] md:text-[5.6rem]",
      label: "text-[8px] sm:text-[11px] md:text-xs",
    },
  ];

  return (
    <section className="relative z-20 mb-6 overflow-hidden rounded-[2rem] border border-white/70 bg-white/35 p-3 shadow-xl shadow-blue-950/10 ring-1 ring-blue-100/70 backdrop-blur-xl md:p-6">
      <div className="absolute w-40 h-40 rounded-full pointer-events-none -right-16 -top-16 bg-blue-200/40 blur-3xl" />
      <div className="absolute w-40 h-40 rounded-full pointer-events-none -bottom-16 -left-16 bg-blue-100/60 blur-3xl" />

      <div className="relative flex flex-row items-start justify-between gap-3 mb-4 md:mb-5">
        <div>
          <div className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-blue-700 md:px-4 md:py-1.5 md:text-xs">
            {label("winnerAnnouncement", "Winner Announcement")}
          </div>

          <h2 className="mt-2 text-lg font-black text-blue-950 md:text-3xl">
            {label("winnersForToday", "Today’s Winners")}
          </h2>

          <p className="mt-1 text-xs font-semibold text-blue-700 md:text-sm">
            {label(
              "winnerShownFor24Hours",
              "These winner numbers will be shown for 24 hours.",
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={hideAnnouncement}
          className="shrink-0 rounded-full bg-white/80 px-3 py-2 text-[10px] font-black text-blue-700 shadow-sm ring-1 ring-blue-100 backdrop-blur-md transition hover:bg-blue-50 md:px-4 md:text-sm"
        >
          {label("close", "Close")}
        </button>
      </div>

      <div className="relative grid items-start grid-cols-3 gap-2 justify-items-center md:gap-5">
        {winners.map((winner, index) => {
          const size = winnerSizeClasses[index] || winnerSizeClasses[2];

          return (
            <div key={winner.title} className="text-center">
              <div
                className={`mb-1 font-black uppercase tracking-wide text-blue-700 md:mb-2 ${size.label}`}
              >
                {winner.title}
              </div>

              <div
                className={`group relative mx-auto aspect-square w-full overflow-hidden rounded-[1.2rem] border border-white/75 bg-white/25 p-2 shadow-[0_22px_55px_rgba(30,64,175,0.14)] ring-1 ring-white/70 backdrop-blur-2xl md:rounded-[1.8rem] md:p-4 ${size.card}`}
              >
                <div className="pointer-events-none absolute inset-0 rounded-[1.2rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.82)_0%,rgba(255,255,255,0.12)_30%,rgba(219,234,254,0.32)_58%,rgba(147,197,253,0.12)_100%)] md:rounded-[1.8rem]" />
                <div className="pointer-events-none absolute inset-[5px] rounded-[1rem] border border-white/60 shadow-[inset_0_4px_18px_rgba(255,255,255,0.72),inset_0_-14px_30px_rgba(30,64,175,0.08)] md:inset-[7px] md:rounded-[1.45rem]" />
                <div className="pointer-events-none absolute -left-10 top-4 h-14 w-32 rotate-[-25deg] bg-white/35 blur-xl md:h-20 md:w-44" />
                <div className="absolute w-8 h-8 rounded-full pointer-events-none right-2 top-2 bg-white/45 blur-sm md:right-3 md:top-3 md:h-12 md:w-12" />
                <div className="absolute h-3 rounded-full pointer-events-none bottom-2 left-3 right-3 bg-blue-200/20 blur-md md:left-4 md:right-4 md:h-4" />
                <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:radial-gradient(circle_at_1px_1px,rgba(29,78,216,0.28)_1px,transparent_0)] [background-size:10px_10px]" />

                <div className="relative flex flex-col items-center justify-center h-full">
                  <div
                    className={`mb-1 select-none font-black leading-none text-blue-700 drop-shadow-[0_2px_0_rgba(255,255,255,0.9)] [text-shadow:_0_2px_0_rgba(255,255,255,0.9),_0_4px_10px_rgba(29,78,216,0.25)] md:mb-3 ${size.brand}`}
                  >
                    ባሩዳ
                  </div>

                  <div
                    className={`select-none font-black leading-none text-blue-700 drop-shadow-[0_3px_0_rgba(255,255,255,0.9)] [text-shadow:_0_3px_0_rgba(255,255,255,0.95),_0_8px_16px_rgba(29,78,216,0.28)] ${size.number}`}
                  >
                    {winner.number}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
