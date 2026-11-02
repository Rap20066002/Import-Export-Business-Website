import type { Metadata } from "next";

import { COMPANY_NAME, jsonLdString, pageUrl, publicPageMetadata, siteBaseUrl } from "@/lib/site";
import type { Locale } from "@/lib/i18n";

type Props = { children: React.ReactNode; params: { locale: Locale } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return publicPageMetadata({
    locale: params.locale,
    path: "contact",
    title: "Contact Qum Industries",
    description:
      "Contact Qum Industries about banana, date and apple import-export. Phone, email, or send a first inquiry for a private quotation.",
  });
}

export default function ContactLayout({ children, params }: Props) {
  const origin = siteBaseUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Contact Qum Industries",
    url: pageUrl(params.locale, "contact"),
    mainEntity: {
      "@type": "Organization",
      "@id": `${origin}/#organization`,
      name: COMPANY_NAME,
      email: "qumplastic.sales@gmail.com",
      telephone: ["+91-9737141455", "+91-9909918714", "+98-9378198405"],
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      {children}
    </>
  );
}
