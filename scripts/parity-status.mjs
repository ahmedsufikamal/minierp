#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const scopePath = process.argv[2] ?? path.join(process.cwd(), "docs/erpnext-parity/00_scope.md");

const requiredSourceModules = [
  "Accounting",
  "CRM",
  "Buying",
  "Projects",
  "Selling",
  "Setup",
  "Manufacturing",
  "Stock",
  "Support",
  "Utilities",
  "Assets",
  "Portal",
  "Maintenance",
  "Regional",
  "Integrations",
  "Quality",
  "Communication",
  "Telephony",
  "Bulk Transaction",
  "Subcontracting",
  "EDI",
];

const statusLabels = new Set(["[ ] Not Started", "[-] In Progress", "[x] Done"]);

function fail(message) {
  console.error(`parity-status: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(scopePath)) {
  fail(`scope file not found: ${scopePath}`);
}

const text = fs.readFileSync(scopePath, "utf8");
const rows = [];
const errors = [];

for (const [idx, line] of text.split(/\r?\n/).entries()) {
  if (!line.startsWith("|")) continue;
  if (
    (line.includes("ERPNext Module") && line.includes("ERPNext Feature")) ||
    line.includes("|---") ||
    /^\|\s*:?-{3,}\s*\|/.test(line)
  ) {
    continue;
  }

  const columns = line.split("|").slice(1, -1).map((s) => s.trim());
  if (columns.length < 6) {
    errors.push(`line ${idx + 1}: expected at least 6 columns`);
    continue;
  }

  const [moduleName, feature, sourceLink, equivalent, rawStatus, notes] = columns;
  const status = rawStatus.replace(/`/g, "");
  if (!moduleName) errors.push(`line ${idx + 1}: missing module name`);
  if (!feature) errors.push(`line ${idx + 1}: missing feature name`);
  if (!sourceLink) errors.push(`line ${idx + 1}: missing source link`);
  if (!equivalent) errors.push(`line ${idx + 1}: missing miniERP equivalent`);
  if (!statusLabels.has(status)) {
    errors.push(`line ${idx + 1}: invalid status '${status}'`);
  }
  if (!notes) errors.push(`line ${idx + 1}: missing notes`);

  rows.push({ moduleName, status });
}

if (rows.length === 0) {
  fail("no parity rows found in scope table");
}

const presentModules = new Set(rows.map((row) => row.moduleName));
const missingModules = requiredSourceModules.filter((moduleName) => !presentModules.has(moduleName));
if (missingModules.length > 0) {
  errors.push(`missing required source modules: ${missingModules.join(", ")}`);
}

if (errors.length > 0) {
  console.error("parity-status: validation errors detected");
  for (const e of errors) {
    console.error(`- ${e}`);
  }
  process.exit(1);
}

const statusCount = {
  done: 0,
  progress: 0,
  notStarted: 0,
};

for (const row of rows) {
  if (row.status === "[x] Done") statusCount.done += 1;
  else if (row.status === "[-] In Progress") statusCount.progress += 1;
  else statusCount.notStarted += 1;
}

console.log(`Scope file: ${path.relative(process.cwd(), scopePath)}`);
console.log(`Rows: ${rows.length}`);
console.log(`Done: ${statusCount.done}`);
console.log(`In Progress: ${statusCount.progress}`);
console.log(`Not Started: ${statusCount.notStarted}`);
console.log(`Covered source modules: ${requiredSourceModules.length}/${requiredSourceModules.length}`);
