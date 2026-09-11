// One resolver for every headless `claude -p` the repo launches (plan 033, D1).
//
// 2026-09-03: 82 headless sessions in a day — 44 on Opus because `evals/run.ts` passed no
// `--model` (the print default is not the cheap tier) and 29 on Fable by explicit choice.
// From now on a script never inherits the host default: it names a cheap tier per kind of
// work, and an expensive tier needs `--allow-expensive` on top of Oriol's permission.
import { CHEAP_TIER, EXPENSIVE_MODEL_RE, MID_TIER } from "../../hooks/lib/headless-models";

export type HeadlessKind = "style" | "smoke" | "skill-trigger" | "probe";

export const DEFAULT_MODEL: Record<HeadlessKind, string> = {
  style: CHEAP_TIER, // deterministic prose graders — the model's register, not its reasoning
  smoke: CHEAP_TIER, // `READY` checks
  "skill-trigger": MID_TIER, // Haiku's native trigger rate (~20 %) is too noisy to read deltas
  probe: MID_TIER,
};

export class ExpensiveModelRefused extends Error {}

export interface Resolved {
  model: string;
  explicit: boolean; // came from --model
  dryRun: boolean;
}

// Pure. `argv` is the script's own argv (without bun/script). `--model X` overrides the
// kind default; X matching /fable|opus/ throws unless `--allow-expensive` is present too.
export function resolveHeadlessModel(argv: string[], kind: HeadlessKind): Resolved {
  // Both spellings are the same flag to every CLI that accepts it. Reading only the
  // space-separated form let `--model=claude-opus-5` walk past the expensive-tier refusal
  // and silently run on the cheap default instead (H34, quality review 2026-09-11).
  const equals = argv.find((a) => a.startsWith("--model="));
  const i = argv.indexOf("--model");
  const explicit = equals !== undefined || (i >= 0 && typeof argv[i + 1] === "string");
  const model = equals !== undefined ? equals.slice("--model=".length) : explicit ? argv[i + 1] : DEFAULT_MODEL[kind];
  if (EXPENSIVE_MODEL_RE.test(model) && !argv.includes("--allow-expensive")) {
    throw new ExpensiveModelRefused(
      `refusing headless run on "${model}": Fable/Opus cost several times the cheap tiers and are never the default (plan 033). ` +
        `Use the ${kind} default (${DEFAULT_MODEL[kind]}) or pass --allow-expensive together with Oriol's this-turn permission.`,
    );
  }
  return { model, explicit, dryRun: argv.includes("--dry-run") };
}

// Strip the resolver's own flags before forwarding argv to a script's other parsing.
export function stripHeadlessFlags(argv: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--model") { i++; continue; }
    if (argv[i] === "--allow-expensive" || argv[i] === "--dry-run") continue;
    out.push(argv[i]);
  }
  return out;
}
