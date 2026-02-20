#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const allowlistPath = path.join(rootDir, "scripts/theme-audit-allowlist.json");
const targetDirs = [path.join(rootDir, "src/app"), path.join(rootDir, "src/components")];
const targetExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

const neutralPatterns = [
  /\b(?:dark:)?(?:text|bg|border)-(?:slate|gray|zinc|neutral|stone)-\d{2,3}(?:\/\d{1,3})?\b/g,
  /\b(?:dark:)?(?:text|bg|border)-(?:white|black)(?:\/\d{1,3})?\b/g,
];

function loadAllowlist() {
  if (!fs.existsSync(allowlistPath)) {
    return {
      ignoredFiles: [],
      allowedMatchSubstrings: [],
      allowedMatches: [],
    };
  }

  const parsed = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
  return {
    ignoredFiles: Array.isArray(parsed.ignoredFiles) ? parsed.ignoredFiles : [],
    allowedMatchSubstrings: Array.isArray(parsed.allowedMatchSubstrings)
      ? parsed.allowedMatchSubstrings
      : [],
    allowedMatches: Array.isArray(parsed.allowedMatches) ? parsed.allowedMatches : [],
  };
}

function shouldIgnoreFile(relativePath, ignoredFiles) {
  return ignoredFiles.some((entry) => relativePath === entry || relativePath.startsWith(`${entry}/`));
}

function walk(dirPath, output) {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(absolutePath, output);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!targetExtensions.has(path.extname(entry.name))) continue;
    output.push(absolutePath);
  }
}

function findViolations(filePath, relativePath, allowlist) {
  const text = fs.readFileSync(filePath, "utf8");
  const violations = [];
  const lines = text.split(/\r?\n/);

  for (const [lineIndex, line] of lines.entries()) {
    for (const pattern of neutralPatterns) {
      pattern.lastIndex = 0;
      for (const match of line.matchAll(pattern)) {
        const found = match[0];
        const allowedBySubstring = allowlist.allowedMatchSubstrings.some((token) => found.includes(token));
        const allowedByExact = allowlist.allowedMatches.some(
          (entry) => entry.file === relativePath && entry.match === found,
        );
        if (allowedBySubstring || allowedByExact) {
          continue;
        }

        violations.push({
          line: lineIndex + 1,
          match: found,
          source: line.trim(),
        });
      }
    }
  }

  return violations;
}

function run() {
  const allowlist = loadAllowlist();
  const files = [];
  for (const dirPath of targetDirs) {
    walk(dirPath, files);
  }

  const allViolations = [];
  for (const filePath of files) {
    const relativePath = path.relative(rootDir, filePath).split(path.sep).join("/");
    if (shouldIgnoreFile(relativePath, allowlist.ignoredFiles)) {
      continue;
    }
    const violations = findViolations(filePath, relativePath, allowlist);
    for (const violation of violations) {
      allViolations.push({ ...violation, file: relativePath });
    }
  }

  if (allViolations.length === 0) {
    console.log("theme-audit: no forbidden raw theme classes found");
    return;
  }

  console.error("theme-audit: forbidden raw theme classes found");
  for (const violation of allViolations) {
    console.error(
      `- ${violation.file}:${violation.line} contains "${violation.match}" -> ${violation.source}`,
    );
  }
  process.exit(1);
}

run();
