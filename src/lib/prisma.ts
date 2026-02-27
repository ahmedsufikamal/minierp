import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!globalForPrisma.pgPool) {
    globalForPrisma.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
    });
  }

  return globalForPrisma.pgPool;
}

function initPrismaClient(): PrismaClient {
  try {
    const adapter = new PrismaPg(getPool());
    return new PrismaClient({ adapter });
  } catch (error) {
    const hint =
      "Failed to initialize Prisma Client with PostgreSQL adapter. " +
      "Verify DATABASE_URL and keep prisma, @prisma/client, and @prisma/adapter-pg on matching versions.";

    if (error instanceof Error) {
      error.message = `${hint} Original error: ${error.message}`;
      throw error;
    }

    throw new Error(hint);
  }
}

export const prisma =
  globalForPrisma.prisma ??
  initPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
