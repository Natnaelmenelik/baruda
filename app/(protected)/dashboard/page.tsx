'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import NumberGrid from '@/components/NumberGrid';
import WinnerAnnouncement from '@/components/WinnerAnnouncement';
import ThemeToggle from '@/components/ThemeToggle';
import MyPurchasesModal from '@/components/MyPurchasesModal';
import { useMySubmissions } from '@/hooks/useLottery';
import { useLang } from '@/hooks/useLang';
import { tm } from '@/lib/i18n/toastMessages';
import { clearClientSession } from '@/lib/auth/client';

export default function DashboardPage() {
  const router = useRouter();
  const { data: subs = [] } = useMySubmissions();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showPurchasesModal, setShowPurchasesModal] = useState(false);
  const { t, lang, setLang } = useLang();

  let user: any = {};

  if (typeof window !== 'undefined') {
    try {
      user = JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      user = {};
    }
  }

  const displayName = user?.name || 'User';

  const getSubmissionNumbers = (sub: any) => {
    if (Array.isArray(sub.numbers) && sub.numbers.length > 0) {
      return sub.numbers;
    }

    if (sub.number) {
      return [sub.number];
    }

    return [];
  };

  function logout() {
    clearClientSession();
    toast.success(tm(lang, 'logoutSuccess'));

    setTimeout(() => {
      router.push('/login');
      router.refresh();
    }, 400);
  }

  return (
    <div className="min-h-screen p-4 pb-20 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t.dashboard}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {lang === 'am'
                ? `ሰላም፣ ${displayName} 👋`
                : `Welcome, ${displayName} 👋`}
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button
              onClick={() => setLang(lang === 'en' ? 'am' : 'en')}
              className="flex-1 rounded-xl bg-white px-3 py-2 shadow sm:flex-none"
            >
              {lang === 'en' ? t.switchToAmharic : t.switchToEnglish}
            </button>

            <ThemeToggle />

            <button
              onClick={() => setShowPurchasesModal(true)}
              className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-white sm:flex-none"
            >
              {t.myPurchases}
            </button>

            <button
              onClick={() => setShowLogoutModal(true)}
              className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-white sm:flex-none"
            >
              {t.logout}
            </button>
          </div>
        </div>

        <WinnerAnnouncement />

        <section className="overflow-hidden bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-100 shadow rounded-2xl">
          <div className="grid gap-5 p-4 md:grid-cols-[1fr_1fr] md:items-center">
            <div className="flex items-center justify-center md:justify-start">
              <img
                src="/images/jetour_dashboard.png"
                alt={t.prizeCar}
                className="mx-auto max-h-[420px] w-full max-w-xl object-contain drop-shadow-2xl"
              />
            </div>

            <div>
              <h2 className="mb-4 text-2xl font-extrabold text-blue-800">
                {t.gameRules}
              </h2>

              <ul className="space-y-3 text-base font-medium text-blue-700 sm:text-lg">
                <>
                  <li>• {t.chooseNumbersRule}</li>
                  <li>• {t.uploadReceiptRule}</li>
                  <li>• {t.waitApprovalRule}</li>
                  <li>• {t.winnerRandomRule}</li>
                  <li>• {t.unapprovedNotCountedRule}</li>
                </>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <NumberGrid />
        </section>
      </div>

      <MyPurchasesModal
        open={showPurchasesModal}
        onClose={() => setShowPurchasesModal(false)}
        subs={subs}
        lang={lang}
        title={t.myPurchases}
      />

      {showLogoutModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-900">
              {t.logoutConfirmTitle}
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              {t.userLogoutConfirmMessage}
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 rounded-xl border px-4 py-3 font-semibold text-gray-700"
              >
                {t.cancel}
              </button>

              <button
                type="button"
                onClick={logout}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white"
              >
                {t.logout}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
