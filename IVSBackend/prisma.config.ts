import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Load environment variables
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/substream';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  migrate: {
    adapter: async () => {
      const { Pool } = await import('pg');
      const { PrismaPg } = await import('@prisma/adapter-pg');
      
      const pool = new Pool({ connectionString });
      
      return new PrismaPg(pool);
    },
  },
  datasource: {
    url: connectionString,
  },
});
