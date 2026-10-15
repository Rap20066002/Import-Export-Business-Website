import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { generateToken, requireAuth, Role } from "../middleware/auth";
import { sendEventEmail } from "../lib/email";
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
