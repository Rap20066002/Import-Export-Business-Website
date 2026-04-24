import type { Metadata } from "next";
import "../globals.css";
import { getTranslations, type Locale } from "@/lib/i18n";
import Link from "next/link";
import { AuthProvider } from "@/lib/auth";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import AuthActions from "@/components/auth-actions";

const fontBody = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const fontDisplay = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

type Props = {
  children: React.ReactNode;
  params: { locale: Locale };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getTranslations(params.locale);
  return {
    title: t.common.companyName,
    description:
      "B2B international agro & commodity trade platform specializing in bananas, dates, apples and more between India, Iran, UAE and Iraq.",
    openGraph: {
      title: t.common.companyName,
      description:
        "Banana exporter from India, Iranian dates supplier, Mazafati dates importer, apple importer from Iran and more.",
      type: "website",
      url: `https://your-domain.com/${params.locale}`,
    },
  };
}

export default function LocaleLayout({ children, params }: Props) {
  const t = getTranslations(params.locale);

  return (
    <html lang="en" dir="ltr">
      <body
        className={`${fontBody.variable} ${fontDisplay.variable} font-sans antialiased bg-slate-50 text-slate-900`}
      >
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md shadow-sm">
            <div className="max-w-6xl mx-auto px-4 py-3.5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <Link href={`/${params.locale}`} className="flex items-center gap-3 group">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-900 text-xs font-bold text-white shadow-glow ring-1 ring-white/30">
                  QP
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold tracking-tight text-slate-900 group-hover:text-emerald-800 transition-colors">
                    Qum Plastic Industries
                  </span>
                  <span className="hidden sm:block text-[11px] text-slate-500">
                    International Agro & Commodity Trade
                  </span>
                </span>
              </Link>
              <nav className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm text-slate-600">
                <Link href={`/${params.locale}`} className="rounded-full px-3 py-1.5 hover:bg-slate-100 hover:text-emerald-800 transition-colors">
                  {t.common.navHome}
                </Link>
                <Link href={`/${params.locale}/about`} className="rounded-full px-3 py-1.5 hover:bg-slate-100 hover:text-emerald-800 transition-colors">
                  {t.common.navAbout}
                </Link>
                <Link href={`/${params.locale}/trade-process`} className="rounded-full px-3 py-1.5 hover:bg-slate-100 hover:text-emerald-800 transition-colors">
                  {t.common.navTradeProcess}
                </Link>
                <Link href={`/${params.locale}/products`} className="rounded-full px-3 py-1.5 hover:bg-slate-100 hover:text-emerald-800 transition-colors">
                  {t.common.navProducts}
                </Link>
                <Link href={`/${params.locale}/contact`} className="rounded-full px-3 py-1.5 hover:bg-slate-100 hover:text-emerald-800 transition-colors">
                  {t.common.navContact}
                </Link>
                <Link
                  href={`/${params.locale}/buyer/dashboard`}
                  className="hidden sm:inline rounded-full px-3 py-1.5 hover:bg-slate-100 hover:text-emerald-800 transition-colors"
                >
                  {t.common.navBuyerPortal}
                </Link>
                <Link
                  href={`/${params.locale}/admin`}
                  className="hidden sm:inline rounded-full px-3 py-1.5 hover:bg-slate-100 hover:text-emerald-800 transition-colors"
                >
                  {t.common.navAdmin}
                </Link>
                <span className="hidden sm:block h-5 w-px bg-slate-200 mx-1" aria-hidden />
                <AuthActions locale={params.locale} />
              </nav>
            </div>
            </header>
            <main className="flex-1">
              {children}
            </main>
            <footer className="border-t border-slate-200/80 bg-gradient-to-b from-white to-slate-50">
            <div className="max-w-6xl mx-auto px-4 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 text-xs text-slate-600">
              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-900 font-display">Qum Plastic Industries</div>
                <p className="leading-relaxed">
                  B2B RFQ platform for agro commodities across India, Iran, UAE and Iraq — private quotations,
                  disciplined documentation, and shipment visibility.
                </p>
              </div>
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Portals</div>
                <div className="flex flex-col gap-1.5">
                  <Link className="text-emerald-800 hover:underline w-fit" href={`/${params.locale}/buyer/rfq`}>
                    Request quotation
                  </Link>
                  <Link className="text-emerald-800 hover:underline w-fit" href={`/${params.locale}/buyer/login`}>
                    Buyer login
                  </Link>
                  <Link className="text-emerald-800 hover:underline w-fit" href={`/${params.locale}/admin/login`}>
                    Admin login
                  </Link>
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Corridors</div>
                <p className="leading-relaxed text-slate-500">
                  India ⇄ Iran ⇄ UAE ⇄ Iraq · Bananas · Mazafati dates · Apples
                </p>
                <p className="text-slate-400 pt-2">© {new Date().getFullYear()} Qum Plastic Industries.</p>
              </div>
            </div>
          </footer>
        </div>
      </AuthProvider>
      </body>
    </html>
  );
}

