import type { MetadataRoute } from "next";

import { pageUrl, siteBaseUrl } from "@/lib/site";

type CatalogProduct = { slug?: string; isActive?: boolean; updatedAt?: string };

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

function isPublicSlug(slug: string) {
  return SLUG_PATTERN.test(slug);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteBaseUrl();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

  let products: CatalogProduct[] = [];
  try {
    const res = await fetch(`${apiBase}/products`, { next: { revalidate: 3600 } });
    if (res.ok) products = (await res.json()) as CatalogProduct[];
  } catch {
    products = [];
  }

  const seen = new Set<string>();
  const entries: MetadataRoute.Sitemap = [];

  const add = (
    path: string,
    options: { changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number; lastModified?: Date }
  ) => {
    const url = path.startsWith("http") ? path : pageUrl("en", path);
    if (seen.has(url) || url.includes("onrender.com")) return;
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

  return entries.filter((entry) => !entry.url.includes("onrender.com") && entry.url.startsWith(baseUrl));
}
