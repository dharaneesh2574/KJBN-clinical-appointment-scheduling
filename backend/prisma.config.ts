import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    // Generation and builds work without database credentials.
    // Database commands require DATABASE_URL in the environment or backend/.env.
    url: process.env.DATABASE_URL,
  },
});
