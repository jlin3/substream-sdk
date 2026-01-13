/**
 * Prisma Client Singleton
 * Prevents multiple instances in development with hot reloading
 */

import { PrismaClient } from '../generated/prisma/client';

// Singleton pattern for Next.js
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
