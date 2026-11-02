import type { MetadataRoute } from "next";

import { pageUrl, siteBaseUrl } from "@/lib/site";

type CatalogProduct = { slug?: string; isActive?: boolean; updatedAt?: string };

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const REVALIDATE_SECONDS = 3600;

/** ISR: Google can reuse this XML without hitting the backend on every crawl. */
export const revalidate = REVALIDATE_SECONDS;

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

/** Last successful catalog in this Node process (survives API blips; lost on restart). */
let lastSuccessfulProducts: CatalogProduct[] | null = null;

async function fetchActiveProducts(): Promise<CatalogProduct[]> {
  try {
    const res = await fetch(catalogProductsUrl(), {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return lastSuccessfulProducts ?? [];
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return lastSuccessfulProducts ?? [];
    lastSuccessfulProducts = data as CatalogProduct[];
    return lastSuccessfulProducts;
  } catch {
    return lastSuccessfulProducts ?? [];
  }
}

function staticEntries(baseUrl: string): MetadataRoute.Sitemap {
  const seen = new Set<string>();
  const entries: MetadataRoute.Sitemap = [];

  const add = (
    path: string,
    options: {
      changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
      priority: number;
      lastModified?: Date;
    }
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
  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const baseUrl = siteBaseUrl();
    const entries = staticEntries(baseUrl);
    const seen = new Set(entries.map((e) => e.url));
    const products = await fetchActiveProducts();

    for (const product of products) {
      const slug = typeof product.slug === "string" ? product.slug.trim() : "";
      if (!slug || !isPublicSlug(slug)) continue;
      if (product.isActive === false) continue;
      const url = pageUrl("en", `products/${slug}`);
      if (seen.has(url) || url.includes("onrender.com") || !url.startsWith(baseUrl)) continue;
      seen.add(url);
      const updatedAt = product.updatedAt ? new Date(product.updatedAt) : undefined;
      entries.push({
        url,
        lastModified: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    return entries;
  } catch {
    try {
      return staticEntries(siteBaseUrl());
    } catch {
      return [
        {
          url: "https://qumindustries.com/en",
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: 1,
        },
      ];
    }
  }
}
