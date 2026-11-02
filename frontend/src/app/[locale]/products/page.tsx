import type { Metadata } from "next";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n";
import { jsonLdString, pageUrl, publicPageMetadata } from "@/lib/site";

type Props = { params: { locale: Locale } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return publicPageMetadata({
    locale: params.locale,
    path: "products",
    title: "Agro commodities for B2B export",
    description:
      "Browse Qum Industries agro commodities for B2B import and export, including bananas, dates and apples. Pricing is quoted privately by RFQ.",
    imagePath: "/media/products/dates-01.jpg",
    imageAlt: "Dates and other agro products for export",
  });
}

type Product = {
  slug: string;
  nameEn: string;
  originCountry: { name: string };
  descriptionEn?: string | null;
  defaultPackagingKg?: number;
  packagingOptions?: string;
};

async function fetchProducts(): Promise<Product[]> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
  try {
    const res = await fetch(`${base}/products`, { cache: "no-store" });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as Product[]) : [];
  } catch {
    return [];
  }
}

export default async function ProductsPage({ params }: Props) {
  const t = getTranslations(params.locale);
  const products = await fetchProducts();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: t.products.title,
    url: pageUrl(params.locale, "products"),
    description:
      "Browse Qum Industries agro commodities for B2B import and export, including bananas, dates and apples. Pricing is quoted privately by RFQ.",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: product.nameEn,
        url: pageUrl(params.locale, `products/${product.slug}`),
      })),
    },
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-6 text-sm">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{t.products.title}</h1>
        <p className="mt-2 text-slate-600 max-w-2xl">
          RFQ-based, container-scale trade in agro commodities – with shipment-ready documents and
          Incoterms-aligned quotations.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {products.map((p) => (
          <Link
            key={p.slug}
            href={`/${params.locale}/products/${p.slug}`}
            className="rounded-2xl border bg-white px-4 py-3 hover:border-emerald-500/70"
          >
            <div className="text-xs uppercase tracking-wide text-emerald-700 mb-1">
              {p.originCountry.name}
            </div>
            <div className="text-sm font-semibold text-slate-900 mb-1">{p.nameEn}</div>
            {p.packagingOptions ? (
              <div className="text-[11px] text-slate-500">Packing: {p.packagingOptions}</div>
            ) : null}
            <div className="mt-2 text-[11px] font-medium text-emerald-800">View product</div>
          </Link>
        ))}
      </div>
      <p className="text-sm text-slate-600">
        <Link className="text-emerald-800 hover:underline" href={`/${params.locale}/contact`}>
          Contact
        </Link>
        {" · "}
        <Link className="text-emerald-800 hover:underline" href={`/${params.locale}/trade-process`}>
          Trade process
        </Link>
      </p>
    </div>
  );
}

