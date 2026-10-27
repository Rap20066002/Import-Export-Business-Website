"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { useAuth } from "@/lib/auth";
import type { Locale } from "@/lib/i18n";
import { PasswordField } from "@/components/password-field";

type Props = { params: { locale: Locale } };

export default function BuyerRegisterPage({ params }: Props) {
  const router = useRouter();
  const { registerBuyer } = useAuth();

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await registerBuyer({
        name,
        company: company.trim(),
        phone: phone.trim() || undefined,
        email,
        password,
      });
      router.push(`/${params.locale}/buyer/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 text-sm">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">Create buyer account</h1>
      <p className="text-slate-600 mb-6">
        Submit RFQs and track order stages privately (no public pricing).
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Full name</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Company</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            required
            autoComplete="organization"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">WhatsApp / phone (with country code)</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+971 50 000 0000"
            autoComplete="tel"
          />
        </div>
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
        <PasswordField
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
        />

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {submitting ? "Creating..." : "Create account"}
        </button>

        <p className="text-xs text-slate-600">
          Already have an account?{" "}
          <Link className="text-emerald-700 hover:underline" href={`/${params.locale}/buyer/login`}>
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}

