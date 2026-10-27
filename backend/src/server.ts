import "dotenv/config";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

import { authRouter } from "./routes/auth";
import { rfqRouter } from "./routes/rfq";
import { orderRouter } from "./routes/order";
import { productRouter } from "./routes/product";
import { lookupRouter } from "./routes/lookup";
import { inquiryRouter } from "./routes/inquiry";
import { isEmailConfigured } from "./lib/email";
import { storageMode } from "./lib/s3";

dotenv.config();

const app = express();

const configuredOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins = new Set([
  ...configuredOrigins,
  "http://localhost:3000",
  "http://localhost:3001",
]);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server or non-browser requests
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use(limiter);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    emailConfigured: isEmailConfigured(),
    storage: storageMode(),
  });
});

app.use("/api/auth", authRouter);
app.use("/api/lookups", lookupRouter);
app.use("/api/rfqs", rfqRouter);
app.use("/api/orders", orderRouter);
app.use("/api/products", productRouter);
app.use("/api/inquiries", inquiryRouter);

const port = Number(process.env.PORT) || 4000;

app.listen(port, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`Backend API running on port ${port}`);
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "replace-with-a-strong-secret") {
    console.warn("Set a strong JWT_SECRET in backend/.env before going live.");
  }
  if (!isEmailConfigured()) {
    console.warn(
      "Email is not configured. RFQ/order emails will not send until you set SENDGRID_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS."
    );
  }
});

