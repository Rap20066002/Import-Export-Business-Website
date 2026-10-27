"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { Locale } from "@/lib/i18n";

type Props = { params: { locale: Locale } };

export default function ForgotPasswordPage({ params }: Props) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      setSuccess(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a temporary password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 text-sm">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">Forgot password</h1>
        <p className="text-slate-600 mb-6">
          Enter the email you registered with. If it is on file, we will send a temporary password. After you sign in, use{" "}
          <span className="font-semibold text-slate-800">Change password</span> in the header.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Registered email</label>
            <input
              type="email"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          {success && <p className="text-xs text-emerald-700">{success}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-6 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? "Sending..." : "Send temporary password"}
          </button>
        </form>
        <p className="mt-4 text-xs text-slate-600">
          <Link className="text-emerald-700 hover:underline" href={`/${params.locale}/buyer/login`}>
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
