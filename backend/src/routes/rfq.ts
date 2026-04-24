import { Router } from "express";
import multer from "multer";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { getLocalFileDataUrlForKey, getSignedUrlForKey, uploadBufferToS3 } from "../lib/s3";
import { sendEventEmail } from "../lib/email";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const rfqSchema = z.object({
  productIds: z.array(z.number()).min(1),
  grade: z.string().optional(),
  quantityContainers: z.number().int().positive(),
  destinationPortId: z.number().int().positive(),
  incoterm: z.enum(["FOB", "CIF", "CFR"]),
  targetPricePerTon: z.number().positive().optional(),
  notes: z.string().optional(),
});

router.post(
  "/",
  requireAuth(["BUYER"]),
  upload.single("companyDocument"),
  async (req, res) => {
    const parsed = rfqSchema.safeParse({
      ...req.body,
      productIds: req.body.productIds ? JSON.parse(req.body.productIds) : [],
      quantityContainers: Number(req.body.quantityContainers),
      destinationPortId: Number(req.body.destinationPortId),
      targetPricePerTon: req.body.targetPricePerTon ? Number(req.body.targetPricePerTon) : undefined,
    });
    if (!parsed.success || !req.user) {
      return res.status(400).json({ error: "Invalid input" });
    }

    let documentKey: string | undefined;
    if (req.file) {
      const key = `company-docs/${Date.now()}-${req.file.originalname}`;
      await uploadBufferToS3(key, req.file.buffer, req.file.mimetype);
      documentKey = key;
    }

    const rfq = await prisma.rFQ.create({
      data: {
        buyerId: req.user.id,
        status: "SUBMITTED",
        destinationPortId: parsed.data.destinationPortId,
        incoterm: parsed.data.incoterm,
        quantityContainers: parsed.data.quantityContainers,
        targetPricePerTon: parsed.data.targetPricePerTon,
        grade: parsed.data.grade,
        notes: parsed.data.notes,
        companyDocumentKey: documentKey,
        items: {
          create: parsed.data.productIds.map((productId) => ({ productId })),
        },
      },
      include: { items: true, buyer: true },
    });

    // Email notifications (buyer + internal admin)
    try {
      await sendEventEmail("RFQ_SUBMITTED", rfq.buyer.email);
      if (process.env.ADMIN_NOTIFICATION_EMAIL) {
        await sendEventEmail("RFQ_SUBMITTED", process.env.ADMIN_NOTIFICATION_EMAIL);
      }
    } catch {
      // non-blocking
    }

    return res.status(201).json(rfq);
  }
);

router.get("/", requireAuth(), async (req, res) => {
  const isBuyer = req.user?.role === "BUYER";
  const where = isBuyer ? { buyerId: req.user?.id } : {};
  const rfqs = await prisma.rFQ.findMany({
    where,
    include: {
      items: { include: { product: true } },
      buyer: true,
      destinationPort: { include: { country: true } },
      quotations: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      order: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return res.json(rfqs);
});

router.get(
  "/:rfqId/company-document",
  requireAuth(["SUPER_ADMIN", "SALES_MANAGER", "LOGISTICS_MANAGER"]),
  async (req, res) => {
    const rfqId = Number(req.params.rfqId);
    const rfq = await prisma.rFQ.findUnique({
      where: { id: rfqId },
      select: { companyDocumentKey: true },
    });

    if (!rfq) return res.status(404).json({ error: "RFQ not found" });
    if (!rfq.companyDocumentKey) return res.status(404).json({ error: "No company document uploaded" });

    const url = process.env.AWS_S3_BUCKET
      ? await getSignedUrlForKey(rfq.companyDocumentKey)
      : await getLocalFileDataUrlForKey(rfq.companyDocumentKey);

    return res.json({ url });
  }
);

router.post(
  "/:rfqId/quote",
  requireAuth(["SUPER_ADMIN", "SALES_MANAGER"]),
  async (req, res) => {
    const body = z.object({
      pricePerTon: z.number().positive(),
      currency: z.string().min(1).optional().default("USD"),
      validityDate: z.string().datetime().optional(),
      notes: z.string().optional(),
    });

    const parsed = body.safeParse(req.body);
    if (!parsed.success || !req.user) {
      return res.status(400).json({
        error: "Invalid input",
        details: parsed.success ? undefined : parsed.error.flatten(),
      });
    }

    const rfq = await prisma.rFQ.findUnique({
      where: { id: Number(req.params.rfqId) },
      include: { buyer: true },
    });
    if (!rfq) return res.status(404).json({ error: "RFQ not found" });

    const quotation = await prisma.quotation.create({
      data: {
        rfqId: rfq.id,
        quotedById: req.user.id,
        pricePerTon: parsed.data.pricePerTon,
        currency: parsed.data.currency,
        validityDate: parsed.data.validityDate ? new Date(parsed.data.validityDate) : new Date(Date.now() + 14 * 86400000),
        notes: parsed.data.notes,
      },
    });

    await prisma.rFQ.update({
      where: { id: rfq.id },
      data: { status: "QUOTED" },
    });

    // Email to buyer and admin (non-blocking)
    try {
      await sendEventEmail("RFQ_QUOTED", rfq.buyer.email);
      if (process.env.ADMIN_NOTIFICATION_EMAIL) {
        await sendEventEmail("RFQ_QUOTED", process.env.ADMIN_NOTIFICATION_EMAIL);
      }
    } catch {
      // ignore
    }

    return res.status(201).json({ rfq: { id: rfq.id, status: "QUOTED" }, quotation });
  }
);

router.post("/:rfqId/confirm", requireAuth(["BUYER"]), async (req, res) => {
  const parsedBody = z
    .object({
      // optional: allow buyer to send a note that will appear in proforma/email
      notes: z.string().optional(),
    })
    .safeParse(req.body);

  if (!parsedBody.success || !req.user) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const rfq = await prisma.rFQ.findUnique({
    where: { id: Number(req.params.rfqId) },
    include: {
      items: { include: { product: true } },
      buyer: true,
      destinationPort: true,
      quotations: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!rfq) return res.status(404).json({ error: "RFQ not found" });
  if (!rfq.buyer || rfq.buyer.id !== req.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!rfq.quotations?.length) {
    return res.status(400).json({ error: "No quotation available for this RFQ" });
  }

  const quotation = rfq.quotations[0]!;
  const generatedOrderNumber = `QUM-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const orderItemsData = rfq.items.map((item) => {
    const tons = rfq.quantityContainers * item.product.containerCapacityTons;
    return {
      productId: item.productId,
      quantityTons: tons,
      unitPrice: quotation.pricePerTon,
    };
  });

  const totalAmount = orderItemsData.reduce((sum, i) => sum + i.quantityTons * i.unitPrice, 0);

  const order = await prisma.order.create({
    data: {
      orderNumber: generatedOrderNumber,
      buyerId: rfq.buyerId,
      rfqId: rfq.id,
      destinationPortId: rfq.destinationPortId,
      status: "CONTAINER_BOOKING",
      totalAmount,
      currency: quotation.currency,
      items: { create: orderItemsData },
      statusHistory: {
        create: {
          status: "CONTAINER_BOOKING",
          changedById: req.user.id,
          note: parsedBody.data.notes,
        },
      },
    },
    include: {
      items: true,
      statusHistory: true,
      destinationPort: true,
      buyer: true,
    },
  });

  await prisma.rFQ.update({
    where: { id: rfq.id },
    data: { status: "CONVERTED_TO_ORDER" },
  });

  try {
    await sendEventEmail("ORDER_CONFIRMED", rfq.buyer.email);
    if (process.env.ADMIN_NOTIFICATION_EMAIL) {
      await sendEventEmail("ORDER_CONFIRMED", process.env.ADMIN_NOTIFICATION_EMAIL);
    }
  } catch {
    // ignore
  }

  return res.status(201).json({ order });
});

export const rfqRouter = router;

