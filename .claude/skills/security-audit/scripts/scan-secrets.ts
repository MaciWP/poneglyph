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

// `extname` returns "" for a leading-dot file and ".local" for `.env.local`, so the whole
// `.env` family — the single most likely home of a real secret — was never scanned even
// though ".env" sits in the set (H54, quality review 2026-09-11).
function isScannable(filePath: string): boolean {
  const base = (filePath.split(/[\\/]/).pop() ?? "").toLowerCase();
  if (base === ".env" || base.startsWith(".env.")) return true;
  return SCANNABLE_EXTENSIONS.has(extname(filePath).toLowerCase());
}

// The scanner reports WHERE a secret is, never WHAT it is: its JSON goes to a transcript,
// a log or a PR comment, so echoing the matched value would leak it a second time (H17).
// The key stays visible because it names the finding; the value never survives.
export function redact(raw: string): string {
  const sep = raw.search(/[=:]/);
  if (sep === -1) return `<redacted ${raw.length} chars>`;
  return `${raw.slice(0, sep + 1)} <redacted ${raw.length - sep - 1} chars>`;
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
      snippet: redact(raw),
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
