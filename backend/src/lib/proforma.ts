import PDFDocument from "pdfkit";

export async function generateProformaInvoicePdfBuffer(params: {
  order: { orderNumber: string };
  quotation?: { currency?: string };
  // Keep this minimal: the current proforma generator only needs these fields.
  items: { productId: number; quantityTons: number }[];
}) {
  const { order, items } = params;

  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  // Basic production-friendly proforma layout (you can replace with SendGrid/S3 branding later).
  doc.fontSize(18).text("Proforma Invoice", { align: "left" });
  doc.moveDown(0.5);
  doc.fontSize(11).text(`Order Number: ${order.orderNumber}`);
  doc.fontSize(11).text(`Generated: ${new Date().toISOString().slice(0, 10)}`);
  doc.moveDown();

  doc.fontSize(12).text("Line Items");
  doc.moveDown(0.25);

  doc
    .fontSize(10)
    .text("Product / Packaging", 0, doc.y, { continued: false })
    .text("Qty (tons)", { continued: false });
  doc.moveDown(0.3);

  for (const item of items) {
    // Note: product name is not available in our minimal generator, but you can enrich later.
    doc.fontSize(10).text(`Product ID: ${item.productId}`, { continued: false });
    doc.fontSize(10).text(`${item.quantityTons.toFixed(2)}`, { continued: false });
    doc.moveDown(0.2);
  }

  doc.moveDown();
  doc.fontSize(10).text("Terms: Prices are RFQ-based. Delivery and documents follow buyer confirmation.", {
    align: "left",
  });

  doc.end();

  await new Promise<void>((resolve) => doc.on("end", () => resolve()));
  return Buffer.concat(chunks);
}

