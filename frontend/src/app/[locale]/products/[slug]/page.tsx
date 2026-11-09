import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { COMPANY_NAME, absoluteUrl, jsonLdString, pageUrl, publicPageMetadata } from "@/lib/site";
import { productMedia } from "@/lib/product-media";

type Props = { params: { locale: Locale; slug: string } };

type Product = {
  slug: string;
  nameEn: string;
  descriptionEn?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  packagingOptions?: string | null;
  defaultPackagingKg?: number | null;
  isActive?: boolean;
  originCountry?: { name?: string | null } | null;
};

type PublicReview = {
  id: number;
  body: string;
  authorName?: string | null;
  country?: string | null;
  rating?: number | null;
  reviewDate?: string | null;
  createdAt?: string | null;
};

function calendarDateOnly(value?: string | null) {
  if (!value || !value.trim()) return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function reviewDisplayDate(review: PublicReview) {
  return calendarDateOnly(review.reviewDate) || calendarDateOnly(review.createdAt);
}

function formatVisitorDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const FABRICATED_AUTHOR = /^(verified customer|qum industries customer)$/i;

function eligibleAuthorName(name?: string | null) {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed || trimmed.length > 99 || !/[A-Za-z]/.test(trimmed)) return null;
  if (FABRICATED_AUTHOR.test(trimmed)) return null;
  return trimmed;
}

async function fetchProduct(slug: string): Promise<Product | null> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
  try {
    const res = await fetch(`${base}/products/${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as Product;
  } catch {
    return null;
  }
}

async function fetchPublishedReviews(slug: string): Promise<PublicReview[]> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
  try {
    const res = await fetch(`${base}/reviews/public?slug=${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as PublicReview[]) : [];
  } catch {
    return [];
  }
}

function productDescription(product: Product) {
  if (product.metaDescription && product.metaDescription.trim()) return product.metaDescription.trim();
  if (product.descriptionEn && product.descriptionEn.trim()) return product.descriptionEn.trim();
  const origin = product.originCountry?.name;
  const originBit = origin ? ` Origin: ${origin}.` : "";
  return `${product.nameEn} from Qum Industries for B2B import and export.${originBit} Request a private quotation; prices are not listed publicly.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await fetchProduct(params.slug);
  if (!product) {
    return {
      title: "Product not found",
      robots: { index: false, follow: false },
    };
  }

  const media = productMedia(product.slug, product.nameEn);
  const origin = product.originCountry?.name;
  const title = `${product.nameEn}${origin ? ` from ${origin}` : ""} for export`;

  return publicPageMetadata({
    locale: params.locale,
    path: `products/${product.slug}`,
    title,
    description: productDescription(product),
    imagePath: media?.src,
    imageAlt: media?.alt || product.nameEn,
    index: product.isActive !== false,
  });
}

export default async function ProductPage({ params }: Props) {
  const product = await fetchProduct(params.slug);
  const reviews = product ? await fetchPublishedReviews(params.slug) : [];

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-sm">
        <h1 className="text-xl font-semibold text-slate-900 mb-2">Product not found</h1>
        <p className="text-slate-600">
          This agro product is not yet configured. Please contact our team for specific commodity RFQs.
        </p>
        <p className="mt-4">
          <Link className="text-emerald-800 hover:underline" href={`/${params.locale}/products`}>
            Back to products
          </Link>
        </p>
      </div>
    );
  }

  const media = productMedia(product.slug, product.nameEn);
  const origin = product.originCountry?.name;
  const pageCanonical = pageUrl(params.locale, `products/${product.slug}`);
  const schemaReviews = reviews.flatMap((review) => {
    const authorName = eligibleAuthorName(review.authorName);
    if (!authorName) return [];
    const rating =
      typeof review.rating === "number" && review.rating >= 1 && review.rating <= 5
        ? review.rating
        : null;
    const published = reviewDisplayDate(review);
    return [
      {
        "@type": "Review" as const,
        author: { "@type": "Person" as const, name: authorName },
        reviewBody: review.body,
        ...(published ? { datePublished: published } : {}),
        ...(rating != null
          ? {
              reviewRating: {
                "@type": "Rating" as const,
                ratingValue: rating,
                bestRating: 5,
                worstRating: 1,
              },
            }
          : {}),
      },
    ];
  });
  const ratedReviews = schemaReviews.filter((review) => review.reviewRating);
  const aggregateRating =
    ratedReviews.length > 0
      ? {
          "@type": "AggregateRating" as const,
          ratingValue: Number(
            (
              ratedReviews.reduce((sum, review) => sum + Number(review.reviewRating?.ratingValue), 0) /
              ratedReviews.length
            ).toFixed(1)
          ),
          ratingCount: ratedReviews.length,
          bestRating: 5,
          worstRating: 1,
        }
      : null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: pageUrl(params.locale) },
          { "@type": "ListItem", position: 2, name: "Products", item: pageUrl(params.locale, "products") },
          { "@type": "ListItem", position: 3, name: product.nameEn, item: pageCanonical },
        ],
      },
      {
        "@type": "Product",
        name: product.nameEn,
        description: product.descriptionEn || productDescription(product),
        url: pageCanonical,
        brand: { "@type": "Organization", name: COMPANY_NAME },
        ...(origin
          ? { countryOfOrigin: { "@type": "Country", name: origin } }
          : {}),
        ...(product.packagingOptions
          ? {
              additionalProperty: {
                "@type": "PropertyValue",
                name: "Standard packing",
                value: product.packagingOptions,
              },
            }
          : {}),
        ...(media ? { image: absoluteUrl(media.src) } : {}),
        ...(schemaReviews.length > 0 ? { review: schemaReviews } : {}),
        ...(aggregateRating ? { aggregateRating } : {}),
      },
    ],
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 text-sm">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <nav className="mb-4 text-xs text-slate-500" aria-label="Breadcrumb">
        <ol className="flex flex-wrap gap-1">
          <li>
            <Link className="hover:text-emerald-800" href={`/${params.locale}`}>
              Home
            </Link>
            <span aria-hidden> / </span>
          </li>
          <li>
            <Link className="hover:text-emerald-800" href={`/${params.locale}/products`}>
              Products
            </Link>
            <span aria-hidden> / </span>
          </li>
          <li className="text-slate-700">{product.nameEn}</li>
        </ol>
      </nav>
      <h1 className="text-2xl font-semibold text-slate-900 mb-3">{product.nameEn}</h1>
      {product.descriptionEn && (
        <p className="text-slate-600 mb-5 max-w-2xl">{product.descriptionEn}</p>
      )}
      {(origin || product.packagingOptions) && (
        <ul className="mb-6 text-sm text-slate-600 space-y-1">
          {origin ? <li>Origin: {origin}</li> : null}
          {product.packagingOptions ? <li>Standard packing: {product.packagingOptions}</li> : null}
        </ul>
      )}
      {media ? (
        <div className="relative mb-6 aspect-[4/3] max-w-xl overflow-hidden rounded-2xl bg-slate-100">
          <Image
            src={media.src}
            alt={media.alt}
            fill
            sizes="(max-width: 768px) 100vw, 576px"
            className="object-cover"
          />
        </div>
      ) : null}

      <div className="rounded-2xl border bg-slate-50 px-4 py-4 mb-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Request a quotation</h2>
        <p className="text-xs text-slate-600 mb-3">
          Prices are not public. Submit an RFQ with your quantity, destination port and Incoterms, or send a first
          inquiry.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/${params.locale}/buyer/rfq`}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Go to RFQ form
          </Link>
          <Link
            href={`/${params.locale}/contact`}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-800 hover:border-emerald-200"
          >
            Contact
          </Link>
          <Link
            href={`/${params.locale}/products`}
            className="inline-flex items-center justify-center rounded-full px-5 py-2 text-xs font-semibold text-emerald-800 hover:underline"
          >
            All products
          </Link>
        </div>
      </div>

      {reviews.length > 0 ? (
        <section className="space-y-3" aria-labelledby="customer-feedback-heading">
          <h2 id="customer-feedback-heading" className="text-sm font-semibold text-slate-900">
            Customer feedback
          </h2>
          <ul className="space-y-3">
            {reviews.map((review) => {
              const shownDate = reviewDisplayDate(review);
              return (
              <li key={review.id} className="rounded-2xl border bg-white px-4 py-3">
                {review.authorName ? (
                  <p className="text-xs font-semibold text-slate-900 mb-1">{review.authorName}</p>
                ) : null}
                {typeof review.rating === "number" ? (
                  <p className="text-xs font-medium text-emerald-800 mb-1">Rating: {review.rating} / 5</p>
                ) : null}
                <p className="text-sm text-slate-700 leading-relaxed">{review.body}</p>
                {review.country || shownDate ? (
                  <p className="mt-2 text-[11px] text-slate-500">
                    {[review.country, shownDate ? formatVisitorDate(shownDate) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
