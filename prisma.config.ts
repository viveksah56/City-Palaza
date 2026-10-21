import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

const envFile = process.env.PRISMA_ENV_FILE ?? (process.env.NODE_ENV === "production" ? ".env.production" : ".env.local");
config({ path: envFile });

const args = process.argv.slice(2);
const isReset = args.includes("migrate") && args.includes("reset");
const isForceReset = args.includes("db") && args.includes("push") && args.includes("--force-reset");
const databaseUrls = [process.env.DATABASE_URL, process.env.DIRECT_URL].filter((value): value is string => Boolean(value));
const targetsSupabase = databaseUrls.some((value) => {
  try {
    const hostname = new URL(value).hostname;
    return hostname.includes("supabase.com") || hostname.includes("supabase.co");
  } catch {
    return false;
  }
});

if ((isReset || isForceReset) && targetsSupabase) {
  console.error("Refusing destructive Prisma reset against a Supabase database.");
  process.exit(1);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --import tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
