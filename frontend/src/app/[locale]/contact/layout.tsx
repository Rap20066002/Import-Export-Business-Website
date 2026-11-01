import type { Metadata } from "next";

import { publicPageMetadata } from "@/lib/site";
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

export default function ContactLayout({ children }: Props) {
  return children;
}
