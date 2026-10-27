"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Locale } from "@/lib/i18n";

type Props = { params: { locale: Locale } };

const phones = ["+91 9737141455", "+91 9909918714", "+98 9378198405"] as const;
const email = "qumplastic.sales@gmail.com";

export default function ContactPage({}: Props) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [productInterest, setProductInterest] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch("/inquiries", {
        method: "POST",
        body: {
          name,
          company,
          email: fromEmail,
          phone: phone || undefined,
          country: country || undefined,
          productInterest: productInterest || undefined,
          message,
        },
      });
      setSuccess("Message sent. Our sales team will reply by email.");
      setName("");
      setCompany("");
      setFromEmail("");
      setPhone("");
      setCountry("");
      setProductInterest("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the message.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Contact</p>
        <h1 className="mt-1 text-3xl font-display font-semibold text-slate-900">Contact Us</h1>
        <p className="mt-3 text-sm text-slate-600">
          Global buyers can request a quotation by creating an account, or send a first inquiry here.
          We coordinate product availability, Incoterms, and shipment documents from one workspace.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Phone / WhatsApp</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {phones.map((phoneNumber) => (
                <li key={phoneNumber}>
                  <a className="text-emerald-800 hover:underline" href={`tel:${phoneNumber.replace(/\s+/g, "")}`}>
                    {phoneNumber}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Email</h2>
            <p className="mt-3 text-sm">
              <a className="text-emerald-800 hover:underline break-all" href={`mailto:${email}`}>
                {email}
              </a>
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-8 grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Your name</label>
            <input className="w-full rounded-md border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Company</label>
            <input className="w-full rounded-md border px-3 py-2" value={company} onChange={(e) => setCompany(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
            <input type="email" className="w-full rounded-md border px-3 py-2" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Phone / WhatsApp</label>
            <input className="w-full rounded-md border px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Country</label>
            <input className="w-full rounded-md border px-3 py-2" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Product interest</label>
            <input className="w-full rounded-md border px-3 py-2" value={productInterest} onChange={(e) => setProductInterest(e.target.value)} placeholder="Bananas, dates, apples..." />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">Message</label>
            <textarea className="w-full rounded-md border px-3 py-2 min-h-[100px]" value={message} onChange={(e) => setMessage(e.target.value)} required minLength={10} />
          </div>
          {error && <p className="sm:col-span-2 text-xs text-red-600">{error}</p>}
          {success && <p className="sm:col-span-2 text-xs text-emerald-700">{success}</p>}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? "Sending..." : "Send inquiry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
