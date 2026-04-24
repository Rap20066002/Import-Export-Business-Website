import type { MetadataRoute } from "next";

type Product = { slug: string };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://your-domain.com";
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

