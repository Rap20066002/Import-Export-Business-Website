import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { type Locale, getTranslations } from "@/lib/i18n";
import { homeHeroCollage, homeShowcaseProducts } from "@/content/home-showcase";

type Props = {
  params: { locale: Locale };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getTranslations(params.locale);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://your-domain.com";
  const url = `${baseUrl}/${params.locale}`;
  return {
    title: t.common.companyName,
    description:
      "B2B RFQ-based international agro & commodity trade between India, Iran, UAE and Iraq. No public pricing.",
    alternates: { canonical: url },
    openGraph: {
      title: t.common.companyName,
      description:
        "Request a quotation privately for container-scale shipments of bananas, dates, apples and more.",
      url,
      type: "website",
    },
  };
}

export default function HomePage({ params }: Props) {
  const t = getTranslations(params.locale);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ImportExportCompany",
    name: "Qum Plastic Industries",
    description:
      "International agro & commodity trade platform (RFQ-based, private quotations) connecting India, Iran, UAE and Iraq.",
    areaServed: ["India", "Iran", "UAE", "Iraq"],
  };

  return (
    <div className="bg-slate-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="relative overflow-hidden border-b border-indigo-950/20 bg-gradient-to-br from-indigo-950 via-slate-900 to-fuchsia-950 text-white">
        <div className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-fuchsia-400/30 via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 py-16 lg:py-20 grid gap-12 lg:grid-cols-[1.15fr_1fr] items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-100/95 backdrop-blur">
              {t.homepage.heroBadge}
            </span>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.65rem] font-semibold leading-[1.12] tracking-tight">
              {t.homepage.heroTitle}
            </h1>
            <p className="text-sm sm:text-base text-emerald-100/85 max-w-xl leading-relaxed">
              {t.homepage.heroSubtitle}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/${params.locale}/buyer/rfq`}
                className="inline-flex items-center justify-center rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/25 hover:bg-amber-300 transition-colors"
              >
                {t.common.ctaRequestQuote}
              </Link>
              <Link
                href={`/${params.locale}/products`}
                className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors backdrop-blur"
              >
                {t.common.navProducts}
              </Link>
              <Link
                href={`/${params.locale}/trade-process`}
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2.5 text-sm text-emerald-50/95 hover:bg-emerald-900/40 transition-colors"
              >
                Trade process
              </Link>
            </div>
            <div className="flex flex-wrap gap-6 pt-2 text-xs text-emerald-100/80">
              <div>
                <div className="font-semibold text-emerald-50">Corridors</div>
                <div>India ⇄ Iran ⇄ UAE ⇄ Iraq</div>
              </div>
              <div>
                <div className="font-semibold text-emerald-50">Core commodities</div>
                <div>Bananas · Mazafati dates · Apples</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 grid-rows-3 gap-3 sm:gap-4 min-h-[280px] sm:min-h-[340px]">
            {homeHeroCollage.map((src, i) => (
              <div
                key={src}
                className={`relative overflow-hidden rounded-2xl ring-1 ring-white/15 shadow-2xl ${
                  i === 0 ? "row-span-3 min-h-[200px]" : "min-h-[88px] sm:min-h-[100px]"
                }`}
              >
                <Image
                  src={src}
                  alt={i === 0 ? "Agro trade showcase — hero" : `Agro trade showcase ${i + 1}`}
                  fill
                  sizes="(max-width: 1024px) 50vw, 400px"
                  className="object-cover transition duration-700 hover:scale-105"
                  priority={i === 0}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-transparent" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 -mt-10 relative z-10">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-emerald-100 bg-white/95 p-5 shadow-soft backdrop-blur">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              Buyer access
            </div>
            <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">Already registered as buyer?</h2>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">
              Sign in to manage RFQs, confirm quotations, and exchange shipment documents.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/${params.locale}/buyer/login`}
                className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-500 transition-colors"
              >
                Buyer login
              </Link>
              <Link
                href={`/${params.locale}/buyer/register`}
                className="inline-flex items-center justify-center rounded-full border border-emerald-200 px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors"
              >
                Create buyer account
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-soft backdrop-blur">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Internal team access</div>
            <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">Admin, sales, and logistics</h2>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">
              Use admin login for quotations, shipment stage updates, and oversight.
            </p>
            <div className="mt-4">
              <Link
                href={`/${params.locale}/admin/login`}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-slate-800 transition-colors"
              >
                Admin login
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-16 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Featured commodities</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-slate-900 tracking-tight">
              Product gallery
            </h2>
          </div>
          <Link
            href={`/${params.locale}/products`}
            className="inline-flex w-fit items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:border-emerald-200 hover:text-emerald-900 transition-colors"
          >
            View all products →
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {homeShowcaseProducts.map((p) => {
            const title = p.titleEn;
            const alt = p.imageAltEn;
            const tagline = p.taglineEn;
            return (
              <Link
                key={p.slug}
                href={`/${params.locale}/products/${p.slug}`}
                className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-soft ring-1 ring-slate-900/[0.04] transition hover:-translate-y-0.5 hover:shadow-glow"
              >
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-slate-200">
                  <Image
                    src={p.image}
                    alt={alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200/90">
                      RFQ · Private pricing
                    </div>
                    <div className="mt-1 font-display text-xl font-semibold tracking-tight">{title}</div>
                    <p className="mt-1 text-xs text-white/80 leading-relaxed">{tagline}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

      </section>

      <section className="max-w-6xl mx-auto px-4 pb-16 space-y-8">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900 tracking-tight">
            {t.homepage.countriesTitle}
          </h2>
          <p className="mt-1 text-sm text-slate-600 leading-relaxed max-w-2xl">
            Strategic agro commodity flows between high-demand import markets and reliable origin suppliers.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <CountryCard title="India → UAE" subtitle="Bananas • Fresh produce" />
          <CountryCard title="Iran → India" subtitle="Mazafati dates • Dry fruits" />
          <CountryCard title="India → Iraq" subtitle="Apples • Mixed fruits" />
          <CountryCard title="Iran → UAE" subtitle="Dates • Nuts • Pulses" />
        </div>
      </section>

      <section className="border-y border-slate-200/80 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-6xl mx-auto px-4 py-14 grid gap-10 lg:grid-cols-2 items-start">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-900 tracking-tight">
              {t.homepage.whyTitle}
            </h2>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Built for procurement teams, not retail buyers. Every shipment is engineered around your Incoterms, port
              requirements and documentation stack.
            </p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2 text-sm">
            <Feature
              title="RFQ-first workflow"
              body="Internal dashboards for RFQs, quotations, orders and shipment milestones – fully private."
            />
            <Feature
              title="Document discipline"
              body="Proforma, commercial invoice, packing list, BL and phytosanitary mapped per shipment."
            />
            <Feature
              title="Container optimization"
              body="Product-specific loading plans based on container capacity and packaging options."
            />
            <Feature
              title="Region-specific expertise"
              body="On-the-ground partners in India, Iran, UAE and Iraq for seasonality and quality control."
            />
          </dl>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-14">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-900 tracking-tight">
              Start your RFQ process
            </h2>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">
              Share your requirements and receive private quotations from our internal sales team.
            </p>
          </div>
          <Link
            href={`/${params.locale}/buyer/rfq`}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-soft hover:bg-slate-800 transition-colors"
          >
            {t.common.ctaRequestQuote}
          </Link>
        </div>
      </section>
    </div>
  );
}

function CountryCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm hover:shadow-md hover:border-emerald-200/60 transition-shadow">
      <div className="text-sm font-semibold text-slate-900 font-display">{title}</div>
      <div className="mt-1 text-xs text-slate-600 leading-relaxed">{subtitle}</div>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white px-4 py-4 shadow-sm">
      <dt className="text-sm font-semibold text-slate-900 font-display">{title}</dt>
      <dd className="mt-2 text-xs text-slate-600 leading-relaxed">{body}</dd>
    </div>
  );
}


