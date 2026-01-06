/**
 * Prisma Client Singleton
 * Prevents multiple instances in development with hot reloading
 * 
 * Uses Prisma 7's node-postgres adapter for direct database connections.
 */

import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/substream';

// Singleton pattern for Next.js
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

function createPrismaClient(): PrismaClient {
  const pool = new Pool({
    connectionString: databaseUrl,
  });
  
  const adapter = new PrismaPg(pool);
  
  return new PrismaClient({
    adapter,
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
