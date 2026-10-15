import path from "path";
import multer from "multer";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error("Only PDF, Word, or image files are allowed"));
      return;
    }
    cb(null, true);
  },
});

export function handleUpload(fieldName: string) {
  return (req: any, res: any, next: any) => {
    memoryUpload.single(fieldName)(req, res, (err: unknown) => {
      if (!err) return next();
      const message = err instanceof Error ? err.message : "Upload failed";
      if (message.toLowerCase().includes("file too large")) {
        return res.status(400).json({ error: "File must be 10MB or smaller" });
      }
      return res.status(400).json({ error: message });
    });
  };
}

export function safeFileName(originalName: string) {
  const base = path.basename(originalName || "document");
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return cleaned.length ? cleaned : "document";
}
