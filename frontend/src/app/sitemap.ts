import type { MetadataRoute } from "next";

import { pageUrl, siteBaseUrl } from "@/lib/site";

type CatalogProduct = { slug?: string; isActive?: boolean; updatedAt?: string };

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

/** Always regenerate so a failed build-time API call cannot freeze an empty product list. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isPublicSlug(slug: string) {
  return SLUG_PATTERN.test(slug);
}

function catalogProductsUrl() {
  const fromEnv = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return `${fromEnv}/products`;
  if (process.env.NODE_ENV === "production") {
    return "https://qum-industries-backend.onrender.com/api/products";
  }
  return "http://localhost:4000/api/products";
}

async function fetchActiveProducts(): Promise<CatalogProduct[]> {
  try {
    const res = await fetch(catalogProductsUrl(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as CatalogProduct[]) : [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteBaseUrl();
  const products = await fetchActiveProducts();

  const seen = new Set<string>();
  const entries: MetadataRoute.Sitemap = [];

  const add = (
    path: string,
    options: { changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number; lastModified?: Date }
  ) => {
    const url = pageUrl("en", path);
    if (seen.has(url) || url.includes("onrender.com") || !url.startsWith(baseUrl)) return;
    seen.add(url);
    entries.push({
      url,
      lastModified: options.lastModified || new Date(),
      changeFrequency: options.changeFrequency,
      priority: options.priority,
    });
  };

  add("", { changeFrequency: "weekly", priority: 1 });
  add("about", { changeFrequency: "monthly", priority: 0.7 });
  add("trade-process", { changeFrequency: "monthly", priority: 0.6 });
  add("products", { changeFrequency: "weekly", priority: 0.9 });
  add("contact", { changeFrequency: "monthly", priority: 0.7 });

  for (const product of products) {
    const slug = typeof product.slug === "string" ? product.slug.trim() : "";
    if (!slug || !isPublicSlug(slug)) continue;
    if (product.isActive === false) continue;
    const updatedAt = product.updatedAt ? new Date(product.updatedAt) : undefined;
    add(`products/${slug}`, {
      changeFrequency: "weekly",
      priority: 0.8,
      lastModified: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : undefined,
    });
  }

  return entries;
}
