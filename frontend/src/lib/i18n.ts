export type Locale = "en";

export const defaultLocale = "en";

type Namespace = "common" | "homepage" | "about" | "trade" | "products" | "dashboard";

type Messages = Record<Namespace, Record<string, string>>;

const messages: Record<Locale, Messages> = {
  en: {
    common: {
      companyName: "Qum Plastic Industries - International Agro & Commodity Trade",
      navHome: "Home",
      navAbout: "About",
      navTradeProcess: "Trade Process",
      navProducts: "Products",
      navContact: "Contact",
      navBuyerPortal: "Buyer Portal",
      navAdmin: "Admin Panel",
      ctaRequestQuote: "Request Quotation",
    },
    homepage: {
      heroTitle: "International Agro & Commodity Trade",
      heroSubtitle:
        "Connecting India, Iran, UAE and Iraq with reliable, compliant and timely agro commodity exports.",
      heroBadge: "B2B • RFQ-based • No public pricing",
      countriesTitle: "Trade Corridors",
      whyTitle: "Why Qum Plastic Industries",
      trustTitle: "Partners Trusting Our Team",
    },
    about: {
      title: "About Qum Plastic Industries",
    },
    trade: {
      title: "How Our Trade Process Works",
    },
    products: {
      title: "Core Agro Commodities",
    },
    dashboard: {
      title: "Buyer Dashboard",
    },
  },
};

export function getTranslations(locale: Locale) {
  return messages[locale] ?? messages[defaultLocale];
}

