import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

export function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL must be defined");

  const logQueries = process.env.PRISMA_LOG_QUERIES === "true";

  const client = new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: Number(process.env.DB_POOL_MAX ?? 5),
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
    }),
    log: logQueries
        ? [
          { emit: "event", level: "query" },
          { emit: "stdout", level: "warn" },
          { emit: "stdout", level: "error" },
        ]
        : process.env.NODE_ENV === "development"
            ? ["warn", "error"]
            : ["error"],
  });

  if (logQueries) {

    client.$on("query", (e: { duration: number; query: string }) => {
      console.log(`[prisma] ${e.duration}ms ${e.query.slice(0, 140)}`);
    });
  }

  return client;
}
