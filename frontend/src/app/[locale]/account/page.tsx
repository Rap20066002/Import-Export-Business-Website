"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { PasswordField } from "@/components/password-field";
import type { Locale } from "@/lib/i18n";

type Props = { params: { locale: Locale } };

export default function AccountPage({ params }: Props) {
  const { user, token, loading } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        token,
        body: { currentPassword, newPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      setSuccess("Password updated. Use the new password next time you sign in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setSubmitting(false);
    }
  };

  if (!loading && !user) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-sm">
        <p className="text-slate-600">Please sign in to change your password.</p>
        <Link className="text-emerald-700 hover:underline" href={`/${params.locale}/buyer/login`}>
          Login
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12 text-sm">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">Change password</h1>
      <p className="text-slate-600 mb-6">
        {user?.name} · {user?.email}
      </p>
      <form onSubmit={onSubmit} className="space-y-4 rounded-3xl border bg-white p-6">
        <PasswordField
          label="Current password"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
        />
        <PasswordField
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
          minLength={8}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {success && <p className="text-xs text-emerald-700">{success}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {submitting ? "Saving..." : "Change password"}
        </button>
      </form>
    </div>
  );
}
