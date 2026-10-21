import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join, resolve, dirname, relative, sep } from "node:path";

const ROOT = process.cwd();
const SRC = resolve(ROOT, "src");
const DIRS = ["src", "prisma", "scripts", "tests", "e2e"]; // missing folders are skipped
const EXT = /\.(ts|tsx|js|jsx|mjs|mts|cts)$/;
const SKIP = new Set(["node_modules", ".next", "generated", "dist", "build", ".git"]);
// matches: from "../x"   import("../x")   import "../x"   require("../x")
const RE = /(from\s+|import\s*\(\s*|import\s+|require\s*\(\s*)(["'])(\.{1,2}\/[^"']*)\2/g;

// set to true to also convert same-folder "./x" imports
const CONVERT_SAME_FOLDER = false;

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        if (SKIP.has(name)) continue;
        const p = join(dir, name);
        statSync(p).isDirectory() ? walk(p, out) : EXT.test(p) && out.push(p);
    }
    return out;
}

const files = DIRS.map((d) => resolve(ROOT, d)).filter(existsSync).flatMap((d) => walk(d));

let changed = 0;
for (const file of files) {
    const text = readFileSync(file, "utf8");
    const next = text.replace(RE, (m, lead, q, spec) => {
        if (spec.startsWith("./") && !CONVERT_SAME_FOLDER) return m;
        const abs = resolve(dirname(file), spec);
        if (!abs.startsWith(SRC + sep) && abs !== SRC) return m; // target is outside src, leave it
        const alias = "@/" + relative(SRC, abs).split(sep).join("/");
        return `${lead}${q}${alias}${q}`;
    });
    if (next !== text) {
        writeFileSync(file, next);
        changed++;
        console.log("updated", relative(ROOT, file));
    }
}
console.log(`${changed} file(s) changed`);