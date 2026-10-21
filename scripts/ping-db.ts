

import { createPrismaClient } from "@/lib/prisma";

const prisma = createPrismaClient();

async function main() {
  for (let i = 0; i < 6; i++) {
    const startedAt = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    console.log(`Query ${i + 1}: ${(performance.now() - startedAt).toFixed(2)} ms`);
  }
}

main()
  .catch(() => {
    console.error("Database ping failed. Check database connectivity and TLS configuration.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
