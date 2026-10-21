import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

export function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL must be defined");

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 10, connectionTimeoutMillis: 5_000 }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}
