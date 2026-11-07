import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

const adminRoles = ["SUPER_ADMIN", "SALES_MANAGER", "LOGISTICS_MANAGER"] as const;

const optionalCountry = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}, z.string().max(80).nullable());

const optionalRating = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : value;
}, z.number().int().min(1).max(5).nullable());

const FABRICATED_AUTHOR = /^(verified customer|qum industries customer)$/i;

const optionalAuthorName = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}, z
  .string()
  .max(99)
  .refine((name) => /[A-Za-z]/.test(name), "Author must be a genuine person or team name")
  .refine((name) => !FABRICATED_AUTHOR.test(name), "Do not use a fabricated author name")
  .nullable());

const reviewBodySchema = z.object({
  productId: z.coerce.number().int().positive(),
  body: z.string().trim().min(1).max(4000),
  authorName: optionalAuthorName.optional(),
  country: optionalCountry.optional(),
  rating: optionalRating.optional(),
  isPublished: z.boolean().optional(),
});

const publishSchema = z.object({
  isPublished: z.boolean(),
});

function publicReview(review: {
  id: number;
  body: string;
  authorName: string | null;
  country: string | null;
  rating: number | null;
  createdAt: Date;
}) {
  return {
    id: review.id,
    body: review.body,
    authorName: review.authorName,
    country: review.country,
    rating: review.rating,
    createdAt: review.createdAt,
  };
}

router.get("/public", async (req, res) => {
  const slug = typeof req.query.slug === "string" ? req.query.slug.trim() : "";
  if (!slug) return res.status(400).json({ error: "Product slug is required" });

  const product = await prisma.product.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!product) return res.status(404).json({ error: "Product not found" });

  const reviews = await prisma.productReview.findMany({
    where: { productId: product.id, isPublished: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, body: true, authorName: true, country: true, rating: true, createdAt: true },
  });
  return res.json(reviews.map(publicReview));
});

router.get("/", requireAuth([...adminRoles]), async (_req, res) => {
  const reviews = await prisma.productReview.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { id: true, slug: true, nameEn: true } },
    },
  });
  return res.json(reviews);
});

router.post("/", requireAuth([...adminRoles]), async (req, res) => {
  const parsed = reviewBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true },
  });
  if (!product) return res.status(400).json({ error: "Product not found" });

  const review = await prisma.productReview.create({
    data: {
      productId: parsed.data.productId,
      body: parsed.data.body,
      authorName: parsed.data.authorName ?? null,
      country: parsed.data.country ?? null,
      rating: parsed.data.rating ?? null,
      isPublished: parsed.data.isPublished ?? false,
    },
    include: { product: { select: { id: true, slug: true, nameEn: true } } },
  });
  return res.status(201).json(review);
});

router.put("/:id", requireAuth([...adminRoles]), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid review id" });

  const parsed = reviewBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const existing = await prisma.productReview.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Review not found" });

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true },
  });
  if (!product) return res.status(400).json({ error: "Product not found" });

  const review = await prisma.productReview.update({
    where: { id },
    data: {
      productId: parsed.data.productId,
      body: parsed.data.body,
      authorName: parsed.data.authorName ?? null,
      country: parsed.data.country ?? null,
      rating: parsed.data.rating ?? null,
      isPublished: parsed.data.isPublished ?? existing.isPublished,
    },
    include: { product: { select: { id: true, slug: true, nameEn: true } } },
  });
  return res.json(review);
});

router.patch("/:id/publish", requireAuth([...adminRoles]), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid review id" });

  const parsed = publishSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const existing = await prisma.productReview.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Review not found" });

  const review = await prisma.productReview.update({
    where: { id },
    data: { isPublished: parsed.data.isPublished },
    include: { product: { select: { id: true, slug: true, nameEn: true } } },
  });
  return res.json(review);
});

router.delete("/:id", requireAuth([...adminRoles]), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid review id" });

  const existing = await prisma.productReview.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Review not found" });

  await prisma.productReview.delete({ where: { id } });
  return res.json({ ok: true });
});

export const reviewRouter = router;
