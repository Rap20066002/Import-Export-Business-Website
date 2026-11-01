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
  "mazafati-kimia-dates": {
    src: "/media/products/dates-01.jpg",
    alt: "Mazafati Kimia dates",
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
