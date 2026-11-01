import type { MetadataRoute } from "next";

type Product = { slug: string };

const PRODUCTION_SITE_URL = "https://qumindustries.com";

function siteBaseUrl() {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || PRODUCTION_SITE_URL).replace(/\/$/, "");
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (host.endsWith(".onrender.com")) return PRODUCTION_SITE_URL;
    return raw;
  } catch {
    return PRODUCTION_SITE_URL;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteBaseUrl();
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

  let products: Product[] = [];
  try {
    const res = await fetch(`${apiBase}/products`);
    if (res.ok) products = (await res.json()) as Product[];
  } catch {
    // if backend not reachable during build, keep sitemap minimal
    products = [];
  }

  const productUrls: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${baseUrl}/en/products/${p.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  })) as MetadataRoute.Sitemap;

  return [
    {
      url: `${baseUrl}/en`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 1,
    },
    ...productUrls,
  ] as MetadataRoute.Sitemap;
}
