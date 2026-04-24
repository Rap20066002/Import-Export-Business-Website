"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import type { Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
};

export default function AuthActions({ locale }: Props) {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <>
        <Link
          href={`/${locale}/buyer/login`}
          className="inline-flex items-center justify-center rounded-full border border-indigo-200/80 bg-white px-3.5 py-1.5 text-xs font-semibold text-indigo-800 shadow-sm hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
        >
          Buyer Login
        </Link>
        <Link
          href={`/${locale}/admin/login`}
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-slate-900 to-indigo-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-soft hover:from-slate-800 hover:to-indigo-800 transition-colors"
        >
          Admin Login
        </Link>
      </>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className="hidden sm:inline text-[11px] text-slate-500">
        {user.name} · {user.role}
      </span>
      <button
        type="button"
        onClick={logout}
        className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
      >
        Logout
      </button>
    </div>
  );
}
