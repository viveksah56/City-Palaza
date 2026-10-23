import { existsSync } from "node:fs";

if (existsSync(".env.prod")) process.loadEnvFile(".env.prod");
await import("../node_modules/next/dist/bin/next");
