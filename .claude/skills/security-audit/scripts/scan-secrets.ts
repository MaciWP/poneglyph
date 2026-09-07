#!/usr/bin/env bun

import { readdirSync, statSync } from "fs";
import { join, extname } from "path";

interface SecretPattern {
  name: string;
  pattern: RegExp;
}

const PK_MARKER = ["-----BEGIN", ".*", "PRIVATE", " ", "KEY-----"].join("");

const SECRET_PATTERNS: SecretPattern[] = [
  { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/g },
  { name: "Private Key", pattern: new RegExp(PK_MARKER, "g") },
  { name: "JWT Token", pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ/g },
  {
    name: "Hardcoded Secret",
    pattern: /(password|secret|api_key|token)\s*[:=]\s*['"][^'"]{8,}/gi,
  },
  {
    name: "MongoDB Connection String",
    pattern: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/g,
  },
  {
    name: "PostgreSQL Connection String",
    pattern: /postgres:\/\/[^:]+:[^@]+@/g,
  },
  {
    name: "API Key (Stripe/OpenAI)",
    pattern: /(sk-|pk_live_|sk_live_)[a-zA-Z0-9]{20,}/g,
  },
  { name: "GitHub Token", pattern: /ghp_[a-zA-Z0-9]{36}/g },
];

const SCANNABLE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".go",
  ".java",
  ".rs",
  ".c",
  ".cpp",
  ".cs",
  ".rb",
  ".php",
  ".swift",
  ".kt",
  ".env",
  ".yaml",
  ".yml",
  ".json",
  ".toml",
  ".cfg",
  ".ini",
  ".conf",
]);

const IGNORE_SEGMENTS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "__pycache__",
  ".venv",
  "vendor",
]);

interface Finding {
  file: string;
  line: number;
  type: string;
  severity: string;
  snippet: string;
}

function shouldIgnore(path: string): boolean {
  return path.split("/").some((p) => IGNORE_SEGMENTS.has(p));
}

function isScannable(filePath: string): boolean {
  return SCANNABLE_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function scanLine(
  line: string,
  lineNum: number,
  filePath: string,
  pat: SecretPattern,
): Finding[] {
  const hits: Finding[] = [];
  pat.pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pat.pattern.exec(line)) !== null) {
    const raw = match[0];
    hits.push({
      file: filePath,
      line: lineNum,
      type: pat.name,
      severity: "high",
      snippet: raw.length > 60 ? `${raw.slice(0, 60)}...` : raw,
    });
  }
  return hits;
}

function scanContent(content: string, filePath: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split("\n");
  for (const pat of SECRET_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      findings.push(...scanLine(lines[i], i + 1, filePath, pat));
    }
  }
  return findings;
}

function addEntry(queue: string[], files: string[], full: string): void {
  try {
    const s = statSync(full);
    if (s.isDirectory()) queue.push(full);
    else if (s.isFile() && isScannable(full)) files.push(full);
  } catch {
    // skip inaccessible entries
  }
}

function collectFiles(target: string): string[] {
  const files: string[] = [];
  try {
    const stat = statSync(target);
    if (stat.isFile()) return isScannable(target) ? [target] : [];
    if (!stat.isDirectory()) return [];
  } catch {
    return [];
  }
  const queue = [target];
  while (queue.length > 0) {
    const dir = queue.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      if (!shouldIgnore(full)) addEntry(queue, files, full);
    }
  }
  return files;
}

async function main(): Promise<void> {
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: scan-secrets.ts <file-or-directory>");
    process.exit(1);
  }

  const files = collectFiles(target);
  const allFindings: Finding[] = [];

  for (const filePath of files) {
    try {
      const content = await Bun.file(filePath).text();
      allFindings.push(...scanContent(content, filePath));
    } catch {
      continue;
    }
  }

  console.log(
    JSON.stringify(
      { findings: allFindings, total: allFindings.length },
      null,
      2,
    ),
  );
  process.exit(0);
}

main();
