import type { Locale } from "@/lib/i18n";

type Props = { params: { locale: Locale } };

const phones = ["+91 9737141455", "+91 9909918714", "+98 9378198405"] as const;
const email = "rezaabbaspunjani28@gmail.com";

export default function ContactPage({}: Props) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Contact</p>
        <h1 className="mt-1 text-3xl font-display font-semibold text-slate-900">Contact Us</h1>
        <p className="mt-3 text-sm text-slate-600">
          For quotations, orders, and shipment documentation coordination, please reach us via phone or
          email.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Phone Numbers</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {phones.map((phone) => (
                <li key={phone}>
                  <a className="text-emerald-800 hover:underline" href={`tel:${phone.replace(/\s+/g, "")}`}>
                    {phone}
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
      </div>
    </div>
  );
}
