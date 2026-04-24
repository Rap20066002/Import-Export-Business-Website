import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

const productSchema = z.object({
  id: z.number().int().optional(),
  slug: z.string().min(3),
  nameEn: z.string().min(1),
  nameFa: z.string().optional(),
  descriptionEn: z.string().optional(),
  descriptionFa: z.string().optional(),
  originCountryId: z.number().int().positive(),
  moq: z.number().int().positive(),
  containerCapacityTons: z.number().positive(),
  packagingOptions: z.string().min(1),
  incoterms: z.string().min(1),
  isActive: z.boolean().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
});

router.get("/", async (_req, res) => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { originCountry: true, loadingPorts: true },
  });
  return res.json(products);
});

router.get("/:slug", async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { slug: req.params.slug },
    include: { originCountry: true, loadingPorts: true },
  });
  if (!product) return res.status(404).json({ error: "Product not found" });
  return res.json(product);
});

router.post("/", requireAuth(["SUPER_ADMIN", "SALES_MANAGER"]), async (req, res) => {
  const parsed = productSchema.safeParse({
    ...req.body,
    originCountryId: Number(req.body.originCountryId),
    moq: Number(req.body.moq),
    containerCapacityTons: Number(req.body.containerCapacityTons),
  });
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  const data = parsed.data;

  const product = await prisma.product.upsert({
    where: { slug: data.slug },
    create: {
      ...data,
      isActive: data.isActive ?? true,
    },
    update: {
      ...data,
    },
  });
  return res.status(201).json(product);
});

router.put(
  "/:slug",
  requireAuth(["SUPER_ADMIN", "SALES_MANAGER"]),
  async (req, res) => {
    const slug = String(req.params.slug);
    const parsed = productSchema.safeParse({
      ...req.body,
      id: undefined,
    });
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const product = await prisma.product.update({
      where: { slug },
      data: {
        ...parsed.data,
        // Ensure slug is preserved from route.
        slug,
        id: undefined,
      } as any,
    });

    return res.json(product);
  }
);

router.delete(
  "/:slug",
  requireAuth(["SUPER_ADMIN", "SALES_MANAGER"]),
  async (req, res) => {
    const slug = String(req.params.slug);
    await prisma.product.delete({ where: { slug } });
    return res.json({ ok: true });
  }
);

export const productRouter = router;

