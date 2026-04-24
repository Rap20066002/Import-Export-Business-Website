"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { useAuth } from "@/lib/auth";
import type { Locale } from "@/lib/i18n";

type Props = { params: { locale: Locale } };

export default function BuyerLoginPage({ params }: Props) {
  const router = useRouter();
  const { login, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      router.push(`/${params.locale}/buyer/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 text-sm">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">Buyer login</h1>
        <p className="text-slate-600 mb-6">Sign in to submit RFQs, confirm quotations, and track orders.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting || loading}
            className="inline-flex w-full items-center justify-center rounded-full bg-emerald-600 px-6 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Sign in as buyer"}
          </button>

          <div className="flex items-center justify-between text-xs">
            <p className="text-slate-600">
              New here?{" "}
              <Link className="text-emerald-700 hover:underline" href={`/${params.locale}/buyer/register`}>
                Create buyer account
              </Link>
            </p>
            <Link className="text-slate-500 hover:text-slate-700" href={`/${params.locale}/admin/login`}>
              Admin login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

