import type { MetadataRoute } from "next";

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

export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
