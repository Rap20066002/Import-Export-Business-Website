import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { getFileForDownload, uploadBufferToS3 } from "../lib/s3";
import { notifyBuyerAndAdmin, sendEventEmail } from "../lib/email";
import { publicUserSelect } from "../lib/public-user";
import { handleUpload, safeFileName } from "../lib/uploads";

const router = Router();

const rfqInclude = {
  items: { include: { product: true } },
  buyer: { select: publicUserSelect },
  destinationPort: { include: { country: true } },
  quotations: {
    orderBy: { createdAt: "desc" as const },
    take: 10,
    include: { quotedBy: { select: { name: true, role: true } } },
  },
  order: true,
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: publicUserSelect } },
  },
};

async function addRfqMessage(rfqId: number, authorId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return null;
  return prisma.rfqMessage.create({
    data: { rfqId, authorId, body: trimmed },
    include: { author: { select: publicUserSelect } },
  });
}

const rfqSchema = z.object({
  productIds: z.array(z.number()).min(1),
  grade: z.string().optional(),
  quantityContainers: z.number().int().positive(),
  containerType: z.enum(["DRY_20", "DRY_40", "REEFER"]),
  packagingKg: z.number().positive(),
  numberOfBoxes: z.number().int().positive(),
  destinationPortId: z.number().int().positive(),
  incoterm: z.enum(["FOB", "CIF", "CFR"]),
  targetPricePerTon: z.number().positive().optional(),
  targetPriceCurrency: z.string().min(3).max(8).optional(),
  notes: z.string().optional(),
});

function estimatedTons(packagingKg: number, numberOfBoxes: number) {
  return (packagingKg * numberOfBoxes) / 1000;
}

function parseProductIds(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw.map(Number).filter((n) => Number.isFinite(n));
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(Number).filter((n) => Number.isFinite(n));
    } catch {
      return [];
    }
  }
  return [];
}

router.post(
  "/",
  requireAuth(["BUYER"]),
  handleUpload("companyDocument"),
  async (req, res) => {
    const parsed = rfqSchema.safeParse({
      ...req.body,
      productIds: parseProductIds(req.body.productIds),
      quantityContainers: Number(req.body.quantityContainers),
      destinationPortId: Number(req.body.destinationPortId),
      packagingKg: Number(req.body.packagingKg),
      numberOfBoxes: Number(req.body.numberOfBoxes),
      targetPricePerTon: req.body.targetPricePerTon ? Number(req.body.targetPricePerTon) : undefined,
      targetPriceCurrency: req.body.targetPriceCurrency || undefined,
    });
    if (!parsed.success || !req.user) {
      return res.status(400).json({ error: "Invalid input. Check product, quantity, port, and incoterm." });
    }

    let documentKey: string | undefined;
    if (req.file) {
      const key = `company-docs/${Date.now()}-${safeFileName(req.file.originalname)}`;
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
        containerType: parsed.data.containerType,
        packagingKg: parsed.data.packagingKg,
        numberOfBoxes: parsed.data.numberOfBoxes,
        targetPricePerTon: parsed.data.targetPricePerTon,
        targetPriceCurrency: parsed.data.targetPriceCurrency ?? null,
        grade: parsed.data.grade,
        notes: parsed.data.notes,
        companyDocumentKey: documentKey,
        items: {
          create: parsed.data.productIds.map((productId) => ({ productId })),
        },
        ...(parsed.data.notes?.trim()
          ? {
              messages: {
                create: { authorId: req.user.id, body: parsed.data.notes.trim() },
              },
            }
          : {}),
      },
      include: rfqInclude,
    });

    const productNames = rfq.items.map((item) => item.product.nameEn).join(", ");
    const details = {
      "RFQ ID": `#${rfq.id}`,
      Buyer: rfq.buyer.name,
      Company: rfq.buyer.company,
      Email: rfq.buyer.email,
      Phone: rfq.buyer.phone,
      Products: productNames,
      Quantity: `${rfq.quantityContainers} × ${rfq.containerType}`,
      Packaging: `${rfq.packagingKg} kg / box`,
      Boxes: rfq.numberOfBoxes,
      "Est. weight": `${estimatedTons(rfq.packagingKg, rfq.numberOfBoxes).toFixed(3)} t`,
      Incoterm: rfq.incoterm,
      Destination: `${rfq.destinationPort.name}, ${rfq.destinationPort.country.name}`,
      Grade: rfq.grade,
      "Target price": rfq.targetPricePerTon
        ? `${rfq.targetPricePerTon} ${rfq.targetPriceCurrency || "USD"} / t`
        : undefined,
      Notes: rfq.notes,
    };

    await sendEventEmail("RFQ_SUBMITTED", rfq.buyer.email, details);
    if (process.env.ADMIN_NOTIFICATION_EMAIL) {
      await sendEventEmail("RFQ_SUBMITTED", process.env.ADMIN_NOTIFICATION_EMAIL, details);
    }

    return res.status(201).json(rfq);
  }
);

router.get("/", requireAuth(), async (req, res) => {
  const isBuyer = req.user?.role === "BUYER";
  const where = isBuyer ? { buyerId: req.user?.id } : {};
  const rfqs = await prisma.rFQ.findMany({
    where,
    include: rfqInclude,
    orderBy: { createdAt: "desc" },
  });
  return res.json(rfqs);
});

router.post(
  "/:rfqId/review",
  requireAuth(["SUPER_ADMIN", "SALES_MANAGER"]),
  async (req, res) => {
    const body = z.object({
      status: z.enum(["UNDER_REVIEW", "REJECTED"]),
      notes: z.string().optional(),
    });
    const parsed = body.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const rfq = await prisma.rFQ.findUnique({
      where: { id: Number(req.params.rfqId) },
      include: { buyer: { select: publicUserSelect } },
    });
    if (!rfq) return res.status(404).json({ error: "RFQ not found" });
    if (rfq.status === "CONVERTED_TO_ORDER") {
      return res.status(400).json({ error: "This RFQ is already converted to an order" });
    }

    const updated = await prisma.rFQ.update({
      where: { id: rfq.id },
      data: { status: parsed.data.status },
      include: rfqInclude,
    });
    if (parsed.data.notes?.trim() && req.user) {
      await addRfqMessage(rfq.id, req.user.id, parsed.data.notes);
    }

    if (parsed.data.status === "REJECTED") {
      await notifyBuyerAndAdmin("RFQ_REJECTED", rfq.buyer.email, {
        "RFQ ID": `#${rfq.id}`,
        Note: parsed.data.notes,
      });
    }

    return res.json(updated);
  }
);

router.get(
  "/:rfqId/company-document/download",
  requireAuth(["SUPER_ADMIN", "SALES_MANAGER", "LOGISTICS_MANAGER"]),
  async (req, res) => {
    const rfqId = Number(req.params.rfqId);
    const rfq = await prisma.rFQ.findUnique({
      where: { id: rfqId },
      select: { companyDocumentKey: true },
    });

    if (!rfq) return res.status(404).json({ error: "RFQ not found" });
    if (!rfq.companyDocumentKey) return res.status(404).json({ error: "No company document uploaded" });

    try {
      const { buffer, contentType } = await getFileForDownload(rfq.companyDocumentKey);
      const fileName = rfq.companyDocumentKey.split("/").pop() || "company-document";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(buffer);
    } catch {
      return res.status(404).json({ error: "Document file is missing from storage" });
    }
  }
);

router.post(
  "/:rfqId/quote",
  requireAuth(["SUPER_ADMIN", "SALES_MANAGER"]),
  async (req, res) => {
    const body = z.object({
      pricePerTon: z.number().positive(),
      currency: z.string().min(1).optional().default("USD"),
      validityDate: z.string().optional(),
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
      include: rfqInclude,
    });
    if (!rfq) return res.status(404).json({ error: "RFQ not found" });
    if (rfq.status === "CONVERTED_TO_ORDER") {
      return res.status(400).json({ error: "This RFQ is already converted to an order" });
    }
    if (rfq.status === "REJECTED") {
      return res.status(400).json({ error: "Rejected RFQs cannot be quoted" });
    }

    const validityDate = parsed.data.validityDate
      ? new Date(parsed.data.validityDate)
      : new Date(Date.now() + 14 * 86400000);
    if (Number.isNaN(validityDate.getTime())) {
      return res.status(400).json({ error: "Invalid validity date" });
    }

    const quotation = await prisma.quotation.create({
      data: {
        rfqId: rfq.id,
        quotedById: req.user.id,
        pricePerTon: parsed.data.pricePerTon,
        currency: parsed.data.currency,
        validityDate,
        notes: parsed.data.notes,
      },
    });

    await prisma.rFQ.update({
      where: { id: rfq.id },
      data: { status: "QUOTED" },
    });
    if (parsed.data.notes?.trim()) {
      await addRfqMessage(
        rfq.id,
        req.user.id,
        `Quotation: ${quotation.pricePerTon} ${quotation.currency} per ton. Valid until ${validityDate.toISOString().slice(0, 10)}.\n${parsed.data.notes.trim()}`
      );
    } else {
      await addRfqMessage(
        rfq.id,
        req.user.id,
        `Quotation sent: ${quotation.pricePerTon} ${quotation.currency} per ton, valid until ${validityDate.toISOString().slice(0, 10)}.`
      );
    }

    const productNames = rfq.items.map((item) => item.product.nameEn).join(", ");
    await notifyBuyerAndAdmin("RFQ_QUOTED", rfq.buyer.email, {
      "RFQ ID": `#${rfq.id}`,
      Products: productNames,
      "Price per ton": `${quotation.pricePerTon} ${quotation.currency}`,
      "Valid until": validityDate.toISOString().slice(0, 10),
      Notes: quotation.notes,
    });

    return res.status(201).json({ rfq: { id: rfq.id, status: "QUOTED" }, quotation });
  }
);

router.post("/:rfqId/confirm", requireAuth(["BUYER"]), async (req, res) => {
  const parsedBody = z
    .object({
      notes: z.string().optional(),
    })
    .safeParse(req.body ?? {});

  if (!parsedBody.success || !req.user) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const rfq = await prisma.rFQ.findUnique({
    where: { id: Number(req.params.rfqId) },
    include: rfqInclude,
  });

  if (!rfq) return res.status(404).json({ error: "RFQ not found" });
  if (rfq.buyer.id !== req.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (rfq.status === "CONVERTED_TO_ORDER" || rfq.order.length) {
    return res.status(400).json({ error: "This RFQ is already converted to an order" });
  }
  if (rfq.status !== "QUOTED" && rfq.status !== "NEGOTIATION") {
    return res.status(400).json({ error: "This RFQ does not have an active quotation to confirm" });
  }
  if (!rfq.quotations?.length) {
    return res.status(400).json({ error: "No quotation available for this RFQ" });
  }

  const quotation = rfq.quotations[0]!;
  if (quotation.validityDate && quotation.validityDate.getTime() < Date.now()) {
    return res.status(400).json({ error: "This quotation has expired. Please request a revised quote." });
  }

  const generatedOrderNumber = `QUM-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const estimatedWeightTons =
    rfq.packagingKg && rfq.numberOfBoxes
      ? estimatedTons(rfq.packagingKg, rfq.numberOfBoxes)
      : rfq.items.reduce((sum, item) => sum + rfq.quantityContainers * item.product.containerCapacityTons, 0);

  const orderItemsData = rfq.items.map((item) => ({
    productId: item.productId,
    quantityTons: estimatedWeightTons,
    unitPrice: quotation.pricePerTon,
  }));

  const quotedEstimate = estimatedWeightTons * quotation.pricePerTon;

  const order = await prisma.order.create({
    data: {
      orderNumber: generatedOrderNumber,
      buyerId: rfq.buyerId,
      rfqId: rfq.id,
      destinationPortId: rfq.destinationPortId,
      status: "CONTAINER_BOOKING",
      totalAmount: quotedEstimate,
      estimatedWeightTons,
      amountReceived: 0,
      currency: quotation.currency,
      items: { create: orderItemsData },
      statusHistory: {
        create: {
          status: "CONTAINER_BOOKING",
          changedById: req.user.id,
          note: parsedBody.data.notes ?? "Buyer confirmed quotation",
        },
      },
    },
    include: {
      items: true,
      statusHistory: true,
      destinationPort: true,
      buyer: { select: publicUserSelect },
    },
  });

  if (parsedBody.data.notes?.trim()) {
    await addRfqMessage(rfq.id, req.user.id, parsedBody.data.notes);
  } else {
    await addRfqMessage(rfq.id, req.user.id, `Order confirmed (${generatedOrderNumber}).`);
  }

  await prisma.rFQ.update({
    where: { id: rfq.id },
    data: { status: "CONVERTED_TO_ORDER" },
  });

  await notifyBuyerAndAdmin("ORDER_CONFIRMED", rfq.buyer.email, {
    "Order number": order.orderNumber,
    "RFQ ID": `#${rfq.id}`,
    "Quoted estimate": `${quotedEstimate.toFixed(2)} ${quotation.currency}`,
    "Est. weight": `${estimatedWeightTons.toFixed(3)} t`,
    Destination: rfq.destinationPort.name,
  });

  return res.status(201).json({ order });
});

router.post("/:rfqId/messages", requireAuth(), async (req, res) => {
  const parsed = z.object({ body: z.string().min(1).max(4000) }).safeParse(req.body);
  if (!parsed.success || !req.user) {
    return res.status(400).json({ error: "Please write a message." });
  }

  const rfq = await prisma.rFQ.findUnique({
    where: { id: Number(req.params.rfqId) },
    include: { buyer: { select: publicUserSelect } },
  });
  if (!rfq) return res.status(404).json({ error: "RFQ not found" });

  const isBuyer = req.user.role === "BUYER";
  if (isBuyer && rfq.buyerId !== req.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const message = await addRfqMessage(rfq.id, req.user.id, parsed.data.body);
  if (isBuyer && (rfq.status === "QUOTED" || rfq.status === "SUBMITTED" || rfq.status === "UNDER_REVIEW")) {
    await prisma.rFQ.update({
      where: { id: rfq.id },
      data: { status: rfq.status === "QUOTED" ? "NEGOTIATION" : rfq.status },
    });
  }

  const notifyTo = isBuyer ? process.env.ADMIN_NOTIFICATION_EMAIL : rfq.buyer.email;
  if (notifyTo) {
    await sendEventEmail("RFQ_MESSAGE", notifyTo, {
      "RFQ ID": `#${rfq.id}`,
      From: req.user.email,
      Message: parsed.data.body.trim(),
    });
  }

  return res.status(201).json(message);
});

export const rfqRouter = router;
