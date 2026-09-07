#!/usr/bin/env bun

import { loadPatterns, getBestFix } from "../../../hooks/lib/error-patterns";
import { matchError } from "../../../hooks/lib/error-pattern-matching";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: analyze-error.ts <error message>");
    process.exit(1);
  }

  const errorMessage = args.join(" ");
  const patterns = loadPatterns();
  const result = matchError(errorMessage, patterns);

  if (!result) {
    console.log(JSON.stringify({ matched: false }));
    process.exit(0);
  }

  const bestFix = getBestFix(result.pattern);

  const output: Record<string, unknown> = {
    matched: true,
    pattern: {
      message: result.pattern.normalizedMessage,
      category: result.pattern.category,
      occurrences: result.pattern.occurrences,
      successRate: result.pattern.successRate,
    },
    confidence: result.confidence,
    matchType: result.matchType,
  };

  if (bestFix) {
    output.bestFix = bestFix;
  }

  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

main();
