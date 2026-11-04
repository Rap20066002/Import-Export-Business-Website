/** Local product photos already in public/media — only used when a slug clearly matches. */
const BY_SLUG: Record<string, { src: string; alt: string }> = {
  "export-bananas": {
    src: "/media/products/bananas-01.jpg",
    alt: "Export bananas packed for shipment",
  },
  "export-apples": {
    src: "/media/products/apples-01.jpg",
    alt: "Graded apples for import and export",
  },
  "rabbi-dates": {
    src: "/media/products/rabbi-dates.jpg",
    alt: "Rabbi dates for export",
  },
  "mazafati-kimia-dates": {
    src: "/media/products/mazafati-kimia-dates.jpg",
    alt: "Mazafati Kimia dates for export",
  },
  "mazafati-loose-dates": {
    src: "/media/products/mazafati-loose-dates.jpg",
    alt: "Mazafati loose dates for export",
  },
  "mazafati-semi-dry-dates": {
    src: "/media/products/mazafati-semi-dry-dates.jpg",
    alt: "Mazafati semi-dry dates for export",
  },
  "kaluteh-dates": {
    src: "/media/products/kaluteh-dates.jpg",
    alt: "Kaluteh dates for export",
  },
  "kabkab-dates": {
    src: "/media/products/kabkab-dates.jpg",
    alt: "Kabkab dates for export",
  },
  "shahani-dates": {
    src: "/media/products/shahani-dates.jpg",
    alt: "Shahani dates for export",
  },
  "zahedi-dates": {
    src: "/media/products/zahedi-dates.jpg",
    alt: "Zahedi dates for export",
  },
};

export function productMedia(slug: string, productName?: string) {
  if (BY_SLUG[slug]) return BY_SLUG[slug];
  if (slug.includes("date")) {
    return {
      src: "/media/products/dates-01.jpg",
      alt: productName ? `${productName}` : "Dates for export",
    };
  }
  if (slug.includes("banana")) {
    return {
      src: "/media/products/bananas-01.jpg",
      alt: productName ? `${productName}` : "Bananas for export",
    };
  }
  if (slug.includes("apple")) {
    return {
      src: "/media/products/apples-01.jpg",
      alt: productName ? `${productName}` : "Apples for export",
    };
  }
  return null;
}
