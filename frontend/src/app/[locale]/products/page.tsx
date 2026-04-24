import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n";

type Props = { params: { locale: Locale } };

type Product = {
  slug: string;
  nameEn: string;
  originCountry: { name: string };
  descriptionEn?: string | null;
};

async function fetchProducts(): Promise<Product[]> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
  const res = await fetch(`${base}/products`, { cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()) as Product[];
}

export default async function ProductsPage({ params }: Props) {
  const t = getTranslations(params.locale);
  const products = await fetchProducts();

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-6 text-sm">
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
            <div className="text-xs text-slate-600">
              {p.descriptionEn ? p.descriptionEn : "Request an RFQ for pricing and availability."}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

