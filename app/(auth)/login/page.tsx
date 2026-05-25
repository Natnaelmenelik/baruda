"use client";

import ThemeToggle from "@/components/ThemeToggle";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { setClientSession } from "@/lib/auth/client";
import { useLang } from "@/hooks/useLang";
import { tm } from "@/lib/i18n/toastMessages";
import LanguageButtons from "@/components/LanguageButtons";
import { translateApiError } from "@/lib/i18n/apiErrorMessages";

function EyeIcon({ show }: { show: boolean }) {
  return show ? (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M3 3l18 18M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.88 5.09A9.77 9.77 0 0112 5c5 0 9 4.5 10 7a12.7 12.7 0 01-3.1 4.35M6.1 6.1C4.14 7.42 2.75 9.52 2 12c1 2.5 5 7 10 7a9.77 9.77 0 004.12-.91"
      />
    </svg>
  ) : (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"
      />
      <circle cx="12" cy="12" r="3" strokeWidth={1.8} />
    </svg>
  );
}

function LoginPageContent() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, lang, setLang } = useLang();
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("user");

    if (token && userRaw) {
      try {
        const user = JSON.parse(userRaw);

        const isAdmin =
          user?.isAdmin === true ||
          user?.is_admin === true ||
          user?.role === "admin";

        router.replace(isAdmin ? "/admin" : "/dashboard");
      } catch {}
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError("");
    toast.loading(tm(lang, "loginLoading"), { id: "login" });

    try {
      let formattedPhone = phone.trim();

      if (formattedPhone.startsWith("0")) {
        formattedPhone = "+251" + formattedPhone.substring(1);
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({
          phone: formattedPhone,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.token) {
        const msg = translateApiError(data, lang) || tm(lang, "loginFailed");
        setError(msg);
        toast.error(msg, { id: "login" });
        return;
      }

      setClientSession({ token: data.token, user: data.user });

      const redirectParam = searchParams.get("redirect");

      let redirectTo =
        redirectParam && redirectParam !== "/login"
          ? redirectParam
          : data.user?.isAdmin || data.user?.role === "admin"
            ? "/admin"
            : "/dashboard";

      if (
        redirectTo === "/admin" &&
        !(data.user?.isAdmin || data.user?.role === "admin")
      ) {
        redirectTo = "/dashboard";
      }

      toast.success(tm(lang, "loginSuccess"), { id: "login" });

      setTimeout(() => {
        window.location.replace(redirectTo);
      }, 300);
    } catch (err) {
      console.error(err);
      const msg = tm(lang, "networkError");
      setError(msg);
      toast.error(msg, { id: "login" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-12 bg-gradient-to-br from-blue-50 to-gray-100">
      <div className="w-full max-w-md p-8 bg-white shadow-xl rounded-2xl">
        <div className="flex justify-end mb-4">
          <LanguageButtons lang={lang} setLang={setLang} />

          <ThemeToggle />
        </div>

        <div className="mb-8 text-center">
          <img
            src="/images/bardua-dashboard.png"
            alt="Jetour"
            className="object-contain mx-auto h-52 w-80"
          />

          <h1 className="mt-2 text-2xl font-bold text-gray-800">
            {t.welcomeBack}
          </h1>

          <p className="mt-1 text-sm text-gray-500">{t.loginSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">
              {t.phoneNumber}
            </label>

            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0912345678"
              className="w-full px-4 py-3 transition border border-gray-300 outline-none rounded-xl focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">
              {t.password}
            </label>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.enterPassword}
                className="w-full px-4 py-3 pr-12 transition border border-gray-300 outline-none rounded-xl focus:ring-2 focus:ring-blue-500"
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute text-gray-400 transition -translate-y-1/2 right-3 top-1/2 hover:text-gray-600"
              >
                <EyeIcon show={showPassword} />
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 border border-red-200 bg-red-50 rounded-xl">
              <p className="text-sm text-center text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 font-semibold text-white transition-all bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl disabled:opacity-50"
          >
            {loading ? t.loggingIn : t.login}
          </button>

          <p className="text-sm text-center text-gray-600">
            {t.dontHaveAccount}{" "}
            <Link
              href="/register"
              className="font-medium text-blue-600 hover:text-blue-700"
            >
              {t.signUp}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
