import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

function isLocalPostgresHost(connectionString: string) {
  try {
    const parsed = new URL(connectionString.replace(/^postgres(ql)?:/i, "http:"));
    const host = parsed.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  } catch {
    return false;
  }
}

const adapter = new PrismaPg(
  isLocalPostgresHost(databaseUrl)
    ? { connectionString: databaseUrl }
    : {
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false },
      }
);

export const prisma = new PrismaClient({
  adapter,
});
