import AWS from "aws-sdk";
import { promises as fs } from "fs";
import path from "path";

const S3_BUCKET = process.env.AWS_S3_BUCKET || "";
const S3_REGION = process.env.AWS_S3_REGION || "ap-south-1";
const LOCAL_STORAGE_ROOT = path.resolve(process.cwd(), "storage");

const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const s3 = S3_BUCKET
  ? new AWS.S3({
      region: S3_REGION,
      ...(accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : {}),
    })
  : null;

export function storageMode() {
  return S3_BUCKET ? "s3" : "local";
}

export async function uploadBufferToS3(key: string, buffer: Buffer, contentType: string) {
  if (!S3_BUCKET || !s3) {
    const fullPath = path.join(LOCAL_STORAGE_ROOT, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
    return key;
  }
  await s3
    .putObject({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
    .promise();
  return key;
}

function guessContentTypeFromKey(key: string) {
  const lower = key.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

export async function getFileForDownload(key: string): Promise<{ buffer: Buffer; contentType: string }> {
  if (!S3_BUCKET || !s3) {
    const fullPath = path.join(LOCAL_STORAGE_ROOT, key);
    const buffer = await fs.readFile(fullPath);
    return { buffer, contentType: guessContentTypeFromKey(key) };
  }

  const output = await s3
    .getObject({
      Bucket: S3_BUCKET,
      Key: key,
    })
    .promise();

  const body = output.Body;
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body as Uint8Array);
  return { buffer, contentType: output.ContentType || guessContentTypeFromKey(key) };
}

export async function deleteFileByKey(key: string) {
  if (!S3_BUCKET || !s3) {
    const fullPath = path.join(LOCAL_STORAGE_ROOT, key);
    await fs.unlink(fullPath).catch(() => undefined);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    s3.deleteObject(
      {
        Bucket: S3_BUCKET,
        Key: key,
      },
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}
