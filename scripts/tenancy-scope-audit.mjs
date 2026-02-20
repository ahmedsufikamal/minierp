#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const modulesRoot = path.join(rootDir, "src/modules");
const allowlistPath = path.join(rootDir, "scripts/tenancy-scope-audit-allowlist.json");

const scopedModules = new Set([
  "accounting",
  "assets",
  "buying",
  "communication",
  "crm",
  "edi",
  "hr",
  "integrations",
  "inventory",
  "maintenance",
  "manufacturing",
  "payroll",
  "portal",
  "pos",
  "projects",
  "quality",
  "regional",
  "selling",
  "subcontracting",
  "support",
  "telephony",
  "utilities",
]);

const prismaCallPattern = /prisma\.[a-zA-Z0-9_]+\.(?:findMany|findFirst|findUnique|count|aggregate|groupBy|create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(\s*\{/g;

function walk(dirPath, output) {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "domain" || entry.name === "interface") continue;
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
  // Cheap heuristic: we require tenant/company markers in the prisma call payload.
  return /\b(?:companyId|tenantId)\b/.test(segment);
}

function run() {
  const allowlist = loadAllowlist();
  const files = [];

  for (const moduleName of scopedModules) {
    walk(path.join(modulesRoot, moduleName, "application"), files);
  }

  const violations = [];

  for (const filePath of files) {
    const relativePath = path.relative(rootDir, filePath).split(path.sep).join("/");
    if (allowlist.files.includes(relativePath)) continue;

    const text = fs.readFileSync(filePath, "utf8");

    for (const match of text.matchAll(prismaCallPattern)) {
      const start = match.index ?? 0;
      const segment = text.slice(start, start + 700);
      if (isLikelyScoped(segment)) continue;

      violations.push({
        file: relativePath,
        line: findLine(text, start),
        call: match[0].trim(),
      });
    }
  }

  if (violations.length === 0) {
    console.log("tenancy-scope-audit: no obvious unscoped Prisma calls found in scoped modules");
    return;
  }

  console.error("tenancy-scope-audit: potential unscoped Prisma calls detected");
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} -> ${violation.call}`);
  }

  if (process.env.TENANCY_AUDIT_STRICT === "1") {
    process.exit(1);
  }

  console.error("tenancy-scope-audit: advisory mode (set TENANCY_AUDIT_STRICT=1 to fail)");
}

run();
