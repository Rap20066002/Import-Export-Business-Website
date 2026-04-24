import { Router } from "express";
import { z } from "zod";
import multer from "multer";

import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { deleteFileByKey, getFileForDownload, uploadBufferToS3 } from "../lib/s3";
import { sendEventEmail } from "../lib/email";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const convertSchema = z.object({
  rfqId: z.number().int().positive(),
  orderNumber: z.string().min(3),
  totalAmount: z.number().positive(),
  currency: z.string().min(1),
});

router.post("/convert-from-rfq", requireAuth(["SUPER_ADMIN", "SALES_MANAGER"]), async (req, res) => {
  const parsed = convertSchema.safeParse({
    ...req.body,
    rfqId: Number(req.body.rfqId),
    totalAmount: Number(req.body.totalAmount),
  });
  if (!parsed.success || !req.user) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const rfq = await prisma.rFQ.findUnique({
    where: { id: parsed.data.rfqId },
    include: { items: true },
  });
  if (!rfq) return res.status(404).json({ error: "RFQ not found" });

  const order = await prisma.order.create({
    data: {
      orderNumber: parsed.data.orderNumber,
      buyerId: rfq.buyerId,
      rfqId: rfq.id,
      destinationPortId: rfq.destinationPortId,
      status: "AWAITING_CONFIRMATION",
      totalAmount: parsed.data.totalAmount,
      currency: parsed.data.currency,
      items: {
        create: rfq.items.map((item) => ({
          productId: item.productId,
          quantityTons: rfq.quantityContainers,
          unitPrice: parsed.data.totalAmount / rfq.quantityContainers,
        })),
      },
      statusHistory: {
        create: {
          status: "AWAITING_CONFIRMATION",
          changedById: req.user.id,
        },
      },
    },
    include: { items: true },
  });

  await prisma.rFQ.update({
    where: { id: rfq.id },
    data: { status: "CONVERTED_TO_ORDER" },
  });

  return res.status(201).json(order);
});

router.get("/", requireAuth(), async (req, res) => {
  const isBuyer = req.user?.role === "BUYER";
  const where = isBuyer ? { buyerId: req.user?.id } : {};
  const orders = await prisma.order.findMany({
    where,
    include: {
      items: { include: { product: true } },
      buyer: true,
      destinationPort: { include: { country: true } },
      statusHistory: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return res.json(orders);
});

// Update order stage (logistics/admin)
router.post(
  "/:orderId/status",
  requireAuth(["SUPER_ADMIN", "LOGISTICS_MANAGER"]),
  async (req, res) => {
    const schema = z.object({
      status: z.enum([
        "AWAITING_CONFIRMATION",
        "CONTAINER_BOOKING",
        "LOADED",
        "SHIPPED",
        "DOCUMENTS_UPLOADED",
        "COMPLETED",
      ]),
      note: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success || !req.user) {
      return res.status(400).json({
        error: "Invalid input",
        details: parsed.success ? undefined : parsed.error.flatten(),
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.orderId) },
      include: { buyer: true },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });

    await prisma.order.update({
      where: { id: order.id },
      data: { status: parsed.data.status },
    });

    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: parsed.data.status,
        changedById: req.user.id,
        note: parsed.data.note,
      },
    });

    // Email to buyer + admin (best-effort)
    try {
      await sendEventEmail("ORDER_STATUS_UPDATED", order.buyer.email);
      if (process.env.ADMIN_NOTIFICATION_EMAIL) {
        await sendEventEmail("ORDER_STATUS_UPDATED", process.env.ADMIN_NOTIFICATION_EMAIL);
      }
    } catch {
      // ignore
    }

    return res.json({ ok: true });
  }
);

router.get("/:orderId/documents", requireAuth(), async (req, res) => {
  const orderId = Number(req.params.orderId);
  const isBuyer = req.user?.role === "BUYER";

  const order = await prisma.order.findFirst({
    where: isBuyer ? { id: orderId, buyerId: req.user?.id } : { id: orderId },
    select: { id: true },
  });

  if (!order) return res.status(404).json({ error: "Order not found" });

  const documents = await prisma.document.findMany({
    where: { orderId },
    orderBy: { uploadedAt: "desc" },
  });

  return res.json(documents);
});

// Upload a document to an order (S3-backed)
router.post(
  "/:orderId/documents",
  requireAuth(["SUPER_ADMIN", "SALES_MANAGER", "LOGISTICS_MANAGER", "BUYER"]),
  upload.single("file"),
  async (req, res) => {
    const schema = z.object({
      type: z.enum([
        "PROFORMA_INVOICE",
        "COMMERCIAL_INVOICE",
        "PACKING_LIST",
        "BILL_OF_LADING",
        "PHYTOSANITARY_CERTIFICATE",
        "OTHER",
      ]),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success || !req.user || !req.file) {
      return res.status(400).json({
        error: "Invalid input",
        details: parsed.success ? null : parsed.error.flatten(),
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.orderId) },
      include: { buyer: true },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (req.user.role === "BUYER" && order.buyerId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const documentKey = `orders/${order.id}/documents/${Date.now()}-${req.file.originalname}`;
    await uploadBufferToS3(documentKey, req.file.buffer, req.file.mimetype);

    const doc = await prisma.document.create({
      data: {
        orderId: order.id,
        type: parsed.data.type,
        fileKey: documentKey,
        fileName: req.file.originalname,
        uploadedById: req.user.id,
      },
    });

    try {
      await sendEventEmail("DOCUMENT_UPLOADED", order.buyer.email);
      if (process.env.ADMIN_NOTIFICATION_EMAIL) {
        await sendEventEmail("DOCUMENT_UPLOADED", process.env.ADMIN_NOTIFICATION_EMAIL);
      }
    } catch {
      // ignore
    }

    return res.status(201).json(doc);
  }
);

router.get(
  "/:orderId/documents/:documentId/download",
  requireAuth(),
  async (req, res) => {
    const orderId = Number(req.params.orderId);
    const documentId = Number(req.params.documentId);
    const isBuyer = req.user?.role === "BUYER";

    const document = await prisma.document.findFirst({
      where: { id: documentId, orderId },
      include: { order: { select: { buyerId: true } } },
    });
    if (!document) return res.status(404).json({ error: "Document not found" });

    if (isBuyer && document.order.buyerId !== req.user?.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { buffer, contentType } = await getFileForDownload(document.fileKey);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${document.fileName}"`);
    return res.send(buffer);
  }
);

router.delete(
  "/:orderId/documents/:documentId",
  requireAuth(["SUPER_ADMIN", "LOGISTICS_MANAGER", "SALES_MANAGER"]),
  async (req, res) => {
    const orderId = Number(req.params.orderId);
    const documentId = Number(req.params.documentId);

    const document = await prisma.document.findFirst({
      where: { id: documentId, orderId },
    });
    if (!document) return res.status(404).json({ error: "Document not found" });

    await deleteFileByKey(document.fileKey).catch(() => undefined);
    await prisma.document.delete({ where: { id: document.id } });
    return res.json({ ok: true });
  }
);

export const orderRouter = router;

