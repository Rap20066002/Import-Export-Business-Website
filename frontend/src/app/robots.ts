import type { MetadataRoute } from "next";

import { PRODUCTION_SITE_URL, siteBaseUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/en/admin",
          "/buyer",
          "/en/buyer",
          "/account",
          "/en/account",
          "/forgot-password",
          "/en/forgot-password",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl.replace(/^https?:\/\//, "") || PRODUCTION_SITE_URL.replace(/^https?:\/\//, ""),
  };
}
