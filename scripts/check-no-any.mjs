#!/usr/bin/env node
// Fails CI if explicit `any`, @ts-ignore or @ts-nocheck sneak into first-party TypeScript.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src", "tests", "scripts", "prisma"];
const SKIP = new Set(["node_modules", "generated", ".next"]);
const PATTERNS = [/:\s*any\b/, /\bas any\b/, /<any[,>]/, /\bany\[\]/, /@ts-ignore/, /@ts-nocheck/];

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(name)) files.push(full);
  }
})(".");

const hits = [];
for (const file of files.filter((f) => ROOTS.some((r) => f.startsWith(r + "/")))) {
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (PATTERNS.some((p) => p.test(line))) hits.push(`${file}:${i + 1}: ${line.trim()}`);
  });
}
if (hits.length) {
  console.error(`Found ${hits.length} disallowed type escape(s):\n${hits.join("\n")}`);
  process.exit(1);
}
console.log(`No explicit any in ${files.length} files.`);
