/** Offline follow-up probes. Run with Bun and --repo pointing to main 802d795.
 * No model calls, command strings below are data; no global configuration mutations.
 * Exit 0 means observations reproduced, NOT product correctness.
 */
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

const i = process.argv.indexOf("--repo");
if (i < 0 || !process.argv[i + 1]) throw new Error("Pass --repo <checkout of main 802d795>");
const root = resolve(process.argv[i + 1]);
const base = "802d7953ea6da0f6c8116e8947932b52ea1130ea";
const proc = Bun.spawn(["git", "rev-parse", "HEAD"], { cwd: root, stdout: "pipe", stderr: "pipe" });
const [head, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
if (code !== 0 || head.trim() !== base) throw new Error("Expected pinned main commit " + base);
const load = (p: string) => import(pathToFileURL(join(root, p)).href);
const doctor = await load(".claude/scripts/doctor.ts");
const gate = await load(".claude/hooks/headless-model-gate.ts");
const resolver = await load(".claude/scripts/lib/headless.ts");
const budget = await load(".claude/scripts/lib/budget.ts");
const runner = await load(".claude/evals/run.ts");
const rank = await load(".claude/skills/skill-advisor/lib/rank.ts");
const results: Array<{ id: string; reproduced: boolean; observed: unknown }> = [];
const record = (id: string, reproduced: boolean, observed: unknown) => results.push({ id, reproduced, observed });

const empty = doctor.statusFromSyncOutput("");
record("N01-empty-sync-green", empty === "🟢", { status: empty });
const summary = doctor.summarizeTests("(pass) fixture > 1 pass + 1 fail → aggregate reflects both\n454 pass\n0 fail\nRan 454 tests across 26 files.\n", 0);
record("N02-test-name-as-summary", summary.status === "🔴", summary);
const commands = [
  "claude -p audit --model haiku && claude -p audit --model opus",
  "env claude -p audit --model opus",
  "bun .claude/evals/run.ts --model haiku --dry-run && claude -p audit --model opus",
];
const decisions = commands.map(command => ({ command, allowed: gate.judgeCommand(command).allow }));
record("N03-shell-boundaries", decisions.every(d => d.allowed), decisions);
const equals = resolver.resolveHeadlessModel(["--model=claude-opus-4-6"], "smoke");
record("N04-model-equals-ignored", !equals.explicit && !equals.model.includes("opus"), equals);
const malformed = resolver.resolveHeadlessModel(["--model", "--dry-run"], "smoke");
record("N05-flag-as-model", malformed.model === "--dry-run", malformed);
const field = budget.frontmatterField("---\nname: example\ndescription: Short inline description\n---\nBody\n", "description");
record("N06-inline-budget-zero", field === "", { measuredInlineDescriptionBytes: Buffer.byteLength(field) });
const health = runner.transcriptHealth(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "unfinished" }] } }));
record("N07-incomplete-session-healthy", health.ok === true, health);
const skills = rank.loadSkillsFromDisk([join(root, ".claude/skills")]);
const broken = skills.filter((s: { description: string }) => s.description === "|" || s.description === ">").length;
record("N08-ranker-still-broken", broken > 0, { skills: skills.length, descriptionsParsedAsMarker: broken });
const activation = ["before", "after", "after-rerun"].map(label => {
  const data = JSON.parse(readFileSync(join(root, `.claude/plans/032-polish-pass/activation/${label}.json`), "utf8"));
  return { label, trials: data.length, hits: data.filter((x: { hit: boolean }) => x.hit).length };
});
console.log(JSON.stringify({ base_commit: base, kind: "observations-not-product-pass", offline: true,
  reproduced: results.filter(r => r.reproduced).length, observations: results.length, results, activation }, null, 2));
process.exit(results.every(r => r.reproduced) ? 0 : 1);
