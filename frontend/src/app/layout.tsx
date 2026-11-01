import type { Metadata } from "next";

import { COMPANY_NAME, DEFAULT_OG_PATH, absoluteUrl, siteBaseUrl } from "@/lib/site";

const defaultTitle = `${COMPANY_NAME} | Agro import and export`;
const defaultDescription =
  "Qum Industries is an India-based B2B import-export company for agro commodities such as bananas, dates and apples. Request a private quotation for container-scale shipments.";

export const metadata: Metadata = {
  metadataBase: new URL(siteBaseUrl()),
  title: {
    default: defaultTitle,
    template: `%s | ${COMPANY_NAME}`,
  },
  description: defaultDescription,
  applicationName: COMPANY_NAME,
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: COMPANY_NAME,
    title: defaultTitle,
    description: defaultDescription,
    url: siteBaseUrl(),
    images: [{ url: DEFAULT_OG_PATH, alt: "Agro commodities for export" }],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: [absoluteUrl(DEFAULT_OG_PATH)],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
