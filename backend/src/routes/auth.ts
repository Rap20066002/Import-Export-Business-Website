import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { generateToken, requireAuth, Role } from "../middleware/auth";
import { isEmailConfigured, sendEventEmail } from "../lib/email";
import { publicUserSelect } from "../lib/public-user";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(120),
  company: z.string().min(2).max(160),
  phone: z.string().min(6).max(40).optional(),
});

router.post("/register-buyer", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Please provide a valid name, company, email, and password (min 8 characters)." });
  }
  const { email, password, name, company, phone } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return res.status(400).json({ error: "Email already registered" });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hash,
      name,
      company,
      phone: phone ?? null,
      role: "BUYER",
    },
  });

  await sendEventEmail("BUYER_WELCOME", user.email, {
    Name: user.name,
    Company: user.company,
  });
  if (process.env.ADMIN_NOTIFICATION_EMAIL) {
    await sendEventEmail("BUYER_WELCOME", process.env.ADMIN_NOTIFICATION_EMAIL, {
      Name: user.name,
      Company: user.company,
      Email: user.email,
      Phone: user.phone,
    });
  }

  const token = generateToken({ id: user.id, role: user.role as Role, email: user.email });
  return res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      company: user.company,
      phone: user.phone,
    },
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    return res.status(400).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(400).json({ error: "Invalid credentials" });
  }

  const token = generateToken({ id: user.id, role: user.role as Role, email: user.email });
  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      company: user.company,
      phone: user.phone,
    },
  });
});

router.post("/forgot-password", async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (!isEmailConfigured()) {
    return res.status(503).json({
      error: "Email is not configured yet, so a temporary password cannot be sent. Please contact our team.",
    });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user) {
    return res.status(404).json({ error: "This email is not registered." });
  }

  const tempPassword = `Qum${crypto.randomBytes(4).toString("hex")}!`;
  const hash = await bcrypt.hash(tempPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password: hash } });
  await sendEventEmail("PASSWORD_RESET", user.email, {
    Name: user.name,
    "Temporary password": tempPassword,
  });

  return res.json({
    ok: true,
    message: "We sent a temporary password to this email. Sign in, then use Change password in the header.",
  });
});

router.post("/change-password", requireAuth(), async (req, res) => {
  const parsed = z
    .object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    })
    .safeParse(req.body);
  if (!parsed.success || !req.user) {
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.password);
  if (!valid) {
    return res.status(400).json({ error: "Current password is incorrect" });
  }

  const hash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password: hash } });
  return res.json({ ok: true });
});

router.get("/me", requireAuth(), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: publicUserSelect,
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json(user);
});

export const authRouter = router;
