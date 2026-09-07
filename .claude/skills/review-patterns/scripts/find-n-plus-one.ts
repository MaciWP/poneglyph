#!/usr/bin/env bun

import { readdirSync, statSync } from "fs";
import { join, extname } from "path";

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".go"]);

const IGNORE_SEGMENTS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  "__pycache__",
  ".venv",
  "vendor",
]);

interface NplusOnePattern {
  regex: RegExp;
  name: string;
  severity: "high" | "medium";
  suggestion: string;
}

const PATTERNS: NplusOnePattern[] = [
  {
    regex:
      /\b(for|while|forEach)\b[^{]*\{[^}]*(\.query|\.execute|\.find|\.findOne|\.get|\.fetch|\.select|\.insert|\.update|\.delete)\s*\(/,
    name: "Query inside loop",
    severity: "high",
    suggestion: "Batch queries outside loop using IN clause or JOIN",
  },
  {
    regex:
      /\b(for|while)\b[^{]*\{[^}]*\bawait\b[^}]*(fetch|axios|got|request|http\.get)\s*\(/,
    name: "HTTP fetch inside loop",
    severity: "high",
    suggestion: "Use Promise.all() for parallel requests or batch API",
  },
  {
    regex: /for\s*(await\s*)?\([^)]*\bof\b[^)]*\)[^{]*\{[^}]*\bawait\b/,
    name: "Sequential await in for...of",
    severity: "high",
    suggestion: "Collect promises and use Promise.all() for parallel execution",
  },
  {
    regex:
      /\.map\s*\(\s*(async\s*)?\([^)]*\)\s*=>[^}]*(\.query|\.execute|\.find|\.findOne|\.fetch)\s*\(/,
    name: "Query inside map callback",
    severity: "high",
    suggestion: "Batch load data before mapping, or use a DataLoader pattern",
  },
  {
    regex:
      /\b(for|while|forEach)\b[^{]*\{[^}]*(INSERT|UPDATE|DELETE)\s+(INTO|FROM|SET)\b/i,
    name: "Individual SQL write in loop",
    severity: "medium",
    suggestion: "Use batch INSERT/UPDATE or transaction with single statement",
  },
  {
    regex: /\.forEach\s*\(\s*(async\s*)?\([^)]*\)\s*=>[^}]*\bawait\b/,
    name: "Await inside forEach (no parallelism)",
    severity: "medium",
    suggestion:
      "forEach doesn't await async callbacks; use for...of or Promise.all(array.map(...))",
  },
  {
    regex:
      /for\s+\w+\s*,?\s*\w*\s*:?=\s*range\b[^{]*\{[^}]*(\.Query|\.Exec|\.Get|\.Select)\s*\(/,
    name: "Go: query inside range loop",
    severity: "high",
    suggestion: "Batch query with IN clause before the loop",
  },
  {
    regex:
      /for\s+\w+\s+in\s+\w+[^:]*:[^#]*(\.execute|\.fetchone|\.fetchall|cursor\.\w+)\s*\(/,
    name: "Python: DB call inside for loop",
    severity: "high",
    suggestion: "Use executemany() or batch query with IN clause",
  },
];

interface Finding {
  file: string;
  line: number;
  pattern: string;
  severity: "high" | "medium";
  code: string;
  suggestion: string;
}

function isCodeFile(filePath: string): boolean {
  return CODE_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function shouldIgnore(path: string): boolean {
  const parts = path.split("/");
  return parts.some((p) => IGNORE_SEGMENTS.has(p));
}

function scanContent(content: string, filePath: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const windowSize = Math.min(5, lines.length - i);
    const window = lines.slice(i, i + windowSize).join(" ");

    for (const pat of PATTERNS) {
      pat.regex.lastIndex = 0;
      if (pat.regex.test(window)) {
        const codeLine = lines[i].trim();
        const preview =
          codeLine.length > 100 ? `${codeLine.slice(0, 100)}...` : codeLine;
        const isDuplicate = findings.some(
          (f) =>
            f.file === filePath &&
            f.pattern === pat.name &&
            Math.abs(f.line - (i + 1)) < 3,
        );
        if (!isDuplicate) {
          findings.push({
            file: filePath,
            line: i + 1,
            pattern: pat.name,
            severity: pat.severity,
            code: preview,
            suggestion: pat.suggestion,
          });
        }
      }
    }
  }

  return findings;
}

function collectFiles(target: string): string[] {
  const files: string[] = [];
  try {
    const stat = statSync(target);
    if (stat.isFile()) {
      return isCodeFile(target) ? [target] : [];
    }
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
      if (shouldIgnore(full)) continue;
      try {
        const s = statSync(full);
        if (s.isDirectory()) {
          queue.push(full);
        } else if (s.isFile() && isCodeFile(full)) {
          files.push(full);
        }
      } catch {
        continue;
      }
    }
  }

  return files;
}

async function main(): Promise<void> {
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: find-n-plus-one.ts <file-or-directory>");
    process.exit(1);
  }

  const files = collectFiles(target);
  const allFindings: Finding[] = [];

  for (const filePath of files) {
    try {
      const content = await Bun.file(filePath).text();
      const results = scanContent(content, filePath);
      allFindings.push(...results);
    } catch {
      continue;
    }
  }

  const output = { findings: allFindings, total: allFindings.length };
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

main();
