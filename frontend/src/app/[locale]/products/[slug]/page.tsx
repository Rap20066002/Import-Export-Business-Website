import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";

type Props = { params: { locale: Locale; slug: string } };

type Product = {
  slug: string;
  nameEn: string;
  descriptionEn?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
};

async function fetchProduct(slug: string): Promise<Product | null> {
  try {
    const product = await apiFetch<Product>(`/products/${slug}`);
    return product;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await fetchProduct(params.slug);
  if (!product) {
    return {
      title: "Product not found - Qum Plastic Industries",
    };
  }

  const title = product.metaTitle || `${product.nameEn} - Qum Plastic Industries`;
  const description =
    product.metaDescription ||
    `RFQ-based ${product.nameEn.toLowerCase()} supply from Qum Plastic Industries with private quotations and documentation support.`;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://your-domain.com";
  const url = `${baseUrl}/${params.locale}/products/${product.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const product = await fetchProduct(params.slug);

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-sm">
        <h1 className="text-xl font-semibold text-slate-900 mb-2">Product not found</h1>
        <p className="text-slate-600">
          This agro product is not yet configured. Please contact our team for specific commodity RFQs.
        </p>
      </div>
    );
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.nameEn,
    description: product.descriptionEn,
    category: "Agro commodity",
    brand: {
      "@type": "Organization",
      name: "Qum Plastic Industries",
    },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 text-sm">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1 className="text-2xl font-semibold text-slate-900 mb-3">{product.nameEn}</h1>
      {product.descriptionEn && (
        <p className="text-slate-600 mb-5 max-w-2xl">{product.descriptionEn}</p>
      )}

      <div className="rounded-2xl border bg-slate-50 px-4 py-4 mb-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Request a quotation</h2>
        <p className="text-xs text-slate-600 mb-3">
          Prices are not public. Submit an RFQ with your quantity, destination port and Incoterms; our
          sales desk will respond with a shipment-ready quotation.
        </p>
        <a
          href={`/${params.locale}/buyer/rfq`}
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Go to RFQ form
        </a>
      </div>
    </div>
  );
}

