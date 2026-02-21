#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const targetRoot = path.join(rootDir, "src/modules/inventory/application");
const allowlistPath = path.join(rootDir, "scripts/inventory-tenancy-audit-allowlist.json");

const prismaCallPattern = /prisma\.[a-zA-Z0-9_]+\.(?:findMany|findFirst|findUnique|count|aggregate|groupBy|create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(\s*\{/g;

function walk(dirPath, output) {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      walk(absolutePath, output);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!absolutePath.endsWith(".ts")) continue;
    output.push(absolutePath);
  }
}

function loadAllowlist() {
  if (!fs.existsSync(allowlistPath)) {
    return { files: [] };
  }
  const parsed = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
  return {
    files: Array.isArray(parsed.files) ? parsed.files : [],
  };
}

function findLine(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function isLikelyScoped(segment) {
  return /\b(?:companyId|tenantId)\b/.test(segment);
}

function run() {
  const allowlist = loadAllowlist();
  const files = [];
  walk(targetRoot, files);

  const violations = [];

  for (const filePath of files) {
    const relativePath = path.relative(rootDir, filePath).split(path.sep).join("/");
    if (allowlist.files.includes(relativePath)) continue;

    const text = fs.readFileSync(filePath, "utf8");

    for (const match of text.matchAll(prismaCallPattern)) {
      const start = match.index ?? 0;
      const segment = text.slice(start, start + 1400);
      if (isLikelyScoped(segment)) continue;

      violations.push({
        file: relativePath,
        line: findLine(text, start),
        call: match[0].trim(),
      });
    }
  }

  if (violations.length === 0) {
    console.log("inventory-tenancy-audit: no obvious unscoped Prisma calls found");
    return;
  }

  console.error("inventory-tenancy-audit: potential unscoped Prisma calls detected");
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} -> ${violation.call}`);
  }

  process.exit(1);
}

run();
