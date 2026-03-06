import { PrismaClient } from "@prisma/client";
import { env } from "./env";

export const prisma = new PrismaClient();

// Keep SQLite pragmas only for local SQLite development fallback.
async function optimizeSQLiteIfNeeded() {
  if (!env.DATABASE_URL.startsWith("file:")) {
    return;
  }

  try {
    await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
    await prisma.$queryRawUnsafe("PRAGMA foreign_keys = ON;");
    await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
  } catch (e) {
    // Non-fatal: some environments may not support these pragmas
    console.warn("Could not set SQLite pragmas:", e);
  }
}

optimizeSQLiteIfNeeded();
