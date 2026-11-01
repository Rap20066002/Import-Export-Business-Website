export const PRODUCTION_SITE_URL = "https://qumindustries.com";
export const COMPANY_NAME = "Qum Industries";
export const DEFAULT_OG_PATH = "/media/products/bananas-01.jpg";

export function siteBaseUrl() {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || PRODUCTION_SITE_URL).replace(/\/$/, "");
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (host.endsWith(".onrender.com")) return PRODUCTION_SITE_URL;
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    return PRODUCTION_SITE_URL;
  } catch {
    return PRODUCTION_SITE_URL;
  }
}

export function absoluteUrl(path = "/") {
  const base = siteBaseUrl();
  if (!path || path === "/") return base;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function pageUrl(locale: string, path = "") {
  const suffix = path.replace(/^\/+|\/+$/g, "");
  return suffix ? absoluteUrl(`/${locale}/${suffix}`) : absoluteUrl(`/${locale}`);
}

export function jsonLdString(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function publicPageMetadata(options: {
  title: string;
  description: string;
  path: string;
  locale?: string;
  imagePath?: string | null;
  imageAlt?: string;
}) {
  const locale = options.locale || "en";
  const url = pageUrl(locale, options.path);
  const imagePath = options.imagePath || DEFAULT_OG_PATH;
  const image = absoluteUrl(imagePath);
  const imageAlt = options.imageAlt || options.title;

  return {
    title: { absolute: options.title },
    description: options.description,
    alternates: {
      canonical: url,
      languages: {
        en: url,
        "x-default": url,
      },
    },
    openGraph: {
      type: "website" as const,
      locale: "en_US",
      siteName: COMPANY_NAME,
      title: options.title,
      description: options.description,
      url,
      images: [{ url: image, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: options.title,
      description: options.description,
      images: [image],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}
