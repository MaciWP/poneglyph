#!/usr/bin/env bun
// Precision regression (post-audit 2026-08-07) — the hook's goal flipped from
// "surface more" (023) to "surface less noise": measured honor-rate was 2/54
// because single common words ("revisa", "prompt", "agent") qualified alone.
// This eval pins the fix against the REAL skills on disk: the measured false
// positives must stay silent; the precise multi-word matches must still fire.
//
// Also a listing-budget check substituting for the interactive `/doctor` (AC4).
//
// Run: bun .claude/evals/skill-activation-rate.ts

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadSkills, analyzePayload } from "../hooks/skill-activation";
import { frontmatterField } from "../scripts/lib/budget";

const skills = loadSkills([".claude/skills"]);

function surfaces(prompt: string): boolean {
  return analyzePayload(JSON.stringify({ prompt }), skills).injection.length > 0;
}

// Measured false positives (audit 2026-08-07) + non-human payloads: MUST stay silent.
const MUST_STAY_SILENT = [
  "revisa esto antes de continuar", // ex-FP: critic
  "en este caso, antes de continuar, revisa los tests que ya existen", // fixture obligatoria
  "dame un prompt para X", // ex-FP: prompt-engineer
  "el agent hizo esto", // ex-FP: orchestrator-protocol
  "[SYSTEM NOTIFICATION - NOT USER INPUT] revisa la pr y haz commit", // payload no-humano
  "gracias",
  "hola",
  "/clear",
];
// Precise matches that MUST keep firing (multi-word keyword or ≥2 distinct hits).
const MUST_STILL_SURFACE = [
  "revisa la pr antes de aprobarla", // pr-review, multi-word
  "quiero refactorizar este código, tiene mucha complexity y duplication", // review-patterns, 2 hits
];

const falseFires = MUST_STAY_SILENT.filter(surfaces);
const falseSilences = MUST_STILL_SURFACE.filter((p) => !surfaces(p));

console.log("# Skill-hint precision regression (audit 2026-08-07)");
console.log(`must-stay-silent (n=${MUST_STAY_SILENT.length}): ${MUST_STAY_SILENT.length - falseFires.length} silent, ${falseFires.length} fired`);
for (const p of falseFires) console.log(`  FALSE FIRE: "${p}"`);
console.log(`must-still-surface (n=${MUST_STILL_SURFACE.length}): ${MUST_STILL_SURFACE.length - falseSilences.length} fired, ${falseSilences.length} silent`);
for (const p of falseSilences) console.log(`  FALSE SILENCE: "${p}"`);

// Listing-budget proxy for /doctor (AC4): combined description+when_to_use per skill.
console.log("\n# Listing-budget check (proxy for /doctor, AC4)");
const CAP = 1536;
let maxCombined = 0, over = 0, total = 0;
for (const d of readdirSync(".claude/skills")) {
  const f = join(".claude/skills", d, "SKILL.md");
  if (!existsSync(f)) continue;
  // An LF-only frontmatter regex matched nothing on a CRLF checkout, so this check
  // reported 0 chars for every skill and could never fail (H74, quality review
  // 2026-09-11). Measure it the way the budget does, and skip skills the model never sees.
  const text = readFileSync(f, "utf8").replace(/\r\n/g, "\n");
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) continue;
  if (/^disable-model-invocation:\s*true\s*$/m.test(fm[1])) continue;
  const combined = (frontmatterField(text, "description") + frontmatterField(text, "when_to_use")).length;
  total += combined;
  if (combined > maxCombined) maxCombined = combined;
  if (combined > CAP) over++;
}
console.log(`skills: ${skills.length} | max combined: ${maxCombined} (cap ${CAP}) | over cap: ${over} | total listing chars: ${total}`);

const ok = falseFires.length === 0 && falseSilences.length === 0 && over === 0;
console.log(`\nRESULT: ${ok ? "PASS" : "REVIEW"} — measured FPs silent, precise matches intact, no skill over cap.`);
process.exit(ok ? 0 : 1);
