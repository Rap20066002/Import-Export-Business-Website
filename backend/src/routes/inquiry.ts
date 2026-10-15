import { Router } from "express";
import { z } from "zod";

import { sendEventEmail } from "../lib/email";

const router = Router();

const inquirySchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  company: z.string().min(2).max(160),
  phone: z.string().max(40).optional(),
  country: z.string().max(80).optional(),
  productInterest: z.string().max(120).optional(),
  message: z.string().min(10).max(4000),
});

router.post("/", async (req, res) => {
  const parsed = inquirySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Please complete name, company, email, and a short message." });
  }

  const to = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_FROM_EMAIL;
  if (!to) {
    return res.status(503).json({
      error: "Inquiry inbox is not configured yet. Please email us directly from the contact page.",
    });
  }

  await sendEventEmail("CONTACT_INQUIRY", to, {
    Name: parsed.data.name,
    Company: parsed.data.company,
    Email: parsed.data.email,
    Phone: parsed.data.phone,
    Country: parsed.data.country,
    Product: parsed.data.productInterest,
    Message: parsed.data.message,
  });

  return res.status(201).json({ ok: true });
});

export const inquiryRouter = router;
