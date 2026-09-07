#!/usr/bin/env bun

import { readdirSync, statSync } from "fs";
import { join, extname } from "path";

const COMPLEXITY_THRESHOLD = 25;
const WARN_THRESHOLD = 20;

const COMPLEXITY_PATTERNS: RegExp[] = [
  /\bif\s*\(/g,
  /\belse\b/g,
  /\bfor\s*\(/g,
  /\bwhile\s*\(/g,
  /\bcase\s+/g,
  /\bcatch\s*\(/g,
  /&&/g,
  /\|\|/g,
  /\?(?!:)/g,
];

const CODE_EXTENSIONS = new Set([
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
]);

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

interface FileReport {
  path: string;
  complexity: number;
  threshold: number;
  status: "pass" | "warn" | "fail";
  hotspots: string[];
}

function isCodeFile(p: string): boolean {
  return CODE_EXTENSIONS.has(extname(p).toLowerCase());
}

function shouldIgnore(p: string): boolean {
  return p.split("/").some((s) => IGNORE_SEGMENTS.has(s));
}

function countPatternMatches(content: string): number {
  let total = 0;
  for (const pattern of COMPLEXITY_PATTERNS) {
    total += content.match(pattern)?.length ?? 0;
  }
  return total;
}

function scoreLineComplexity(line: string): number {
  let score = 0;
  for (const pattern of COMPLEXITY_PATTERNS) {
    pattern.lastIndex = 0;
    score += line.match(pattern)?.length ?? 0;
  }
  return score;
}

function findHotspots(content: string): string[] {
  const hotspots: string[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (scoreLineComplexity(lines[i]) < 2) continue;
    const trimmed = lines[i].trim();
    const preview =
      trimmed.length > 80 ? `${trimmed.slice(0, 80)}...` : trimmed;
    hotspots.push(`L${i + 1}: ${preview}`);
  }
  return hotspots.slice(0, 10);
}

function addEntry(queue: string[], files: string[], full: string): void {
  try {
    const s = statSync(full);
    if (s.isDirectory()) queue.push(full);
    else if (s.isFile() && isCodeFile(full)) files.push(full);
  } catch {
    // skip inaccessible
  }
}

function collectFiles(target: string): string[] {
  const files: string[] = [];
  try {
    const stat = statSync(target);
    if (stat.isFile()) return isCodeFile(target) ? [target] : [];
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

function getStatus(complexity: number): "pass" | "warn" | "fail" {
  if (complexity > COMPLEXITY_THRESHOLD) return "fail";
  if (complexity >= WARN_THRESHOLD) return "warn";
  return "pass";
}

async function analyzeFile(filePath: string): Promise<FileReport | null> {
  try {
    const content = await Bun.file(filePath).text();
    const complexity = countPatternMatches(content);
    const status = getStatus(complexity);
    const hotspots = complexity >= WARN_THRESHOLD ? findHotspots(content) : [];
    return {
      path: filePath,
      complexity,
      threshold: COMPLEXITY_THRESHOLD,
      status,
      hotspots,
    };
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: complexity-report.ts <file-or-directory>");
    process.exit(1);
  }

  const files = collectFiles(target);
  const reports: FileReport[] = [];
  let failing = 0;

  for (const filePath of files) {
    const report = await analyzeFile(filePath);
    if (!report) continue;
    if (report.status === "fail") failing++;
    reports.push(report);
  }

  const output = {
    files: reports,
    summary: {
      total: reports.length,
      passing: reports.length - failing,
      failing,
    },
  };
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

main();
