/**
 * Homepage product imagery.
 *
 * Default: high-quality stock photos (Unsplash) so the site looks polished before you add assets.
 * Your photos: drop files into `frontend/public/media/products/` and set `image` to e.g.
 * `/media/products/bananas-01.jpg`.
 */
export type HomeShowcaseItem = {
  slug: string;
  titleEn: string;
  taglineEn: string;
  /** Next/Image src — local `/...` or allowed remote URL */
  image: string;
  imageAltEn: string;
};

export const homeShowcaseProducts: HomeShowcaseItem[] = [
  {
    slug: "export-bananas",
    titleEn: "Banana",
    taglineEn: "India-origin · container-grade · RFQ pricing",
    image: "/media/products/bananas-01.jpg",
    imageAltEn: "Fresh bananas — export quality",
  },
  {
    slug: "mazafati-kimia-dates",
    titleEn: "Mazafati (Kimia)",
    taglineEn: "Iran-origin · cold chain aware · documentation ready",
    image: "/media/products/dates-01.jpg",
    imageAltEn: "Premium dates — Mazafati style presentation",
  },
  {
    slug: "export-apples",
    titleEn: "Apple",
    taglineEn: "Multi-origin · graded lots · shipment planning",
    image: "/media/products/apples-01.jpg",
    imageAltEn: "Fresh apples — graded for export",
  },
];

/** Hero collage tiles (visual only; can swap to `/media/...` like products) */
export const homeHeroCollage = [
  "/media/products/bananas-02.webp",
  "/media/products/dates-02.jpg",
  "/media/products/apples-02.webp",
  "/media/products/bananas-03.jpg",
] as const;
