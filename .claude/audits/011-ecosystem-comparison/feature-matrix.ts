// Feature matrix from repo trees (GitHub API) + local poneglyph tree (git ls-files).
import { execSync } from "node:child_process";

const REPOS = [
  "obra/superpowers",
  "affaan-m/ECC",
  "mattpocock/skills",
  "multica-ai/andrej-karpathy-skills",
  "garrytan/gstack",
  "addyosmani/agent-skills",
  "wshobson/agents",
  "github/spec-kit",
  "bmad-code-org/BMAD-METHOD",
  "Yeachan-Heo/oh-my-claudecode",
  "davila7/claude-code-templates",
  "SuperClaude-Org/SuperClaude_Framework",
  "gsd-build/get-shit-done",
  "JuliusBrussee/caveman",
  "DietrichGebert/ponytail",
];

type Row = Record<string, string | number>;

const F: Record<string, (p: string) => boolean> = {
  skills: (p) => /(^|\/)SKILL\.md$/i.test(p),
  commands: (p) => /(^|\/)commands\/[^/]+\.md$/i.test(p),
  agents: (p) => /(^|\/)agents\/[^/]+\.md$/i.test(p),
  hookFiles: (p) => /(^|\/)hooks\/[^/]+\.(ts|js|mjs|cjs|sh|py|json)$/i.test(p) && !/__tests__|\.test\./i.test(p),
  rules: (p) => /(^|\/)rules\/.*\.md$/i.test(p),
  outputStyles: (p) => /output-styles?\//i.test(p),
  statusline: (p) => /statusline/i.test(p),
  settingsJson: (p) => /(^|\/)settings(\.[a-z]+)*\.json$/i.test(p),
  claudeMd: (p) => /(^|\/)CLAUDE\.md$/i.test(p),
  agentsMd: (p) => /(^|\/)AGENTS\.md$/i.test(p),
  pluginManifest: (p) => /\.claude-plugin\/(plugin|marketplace)\.json$/i.test(p),
  mcp: (p) => /\.mcp\.json$/i.test(p) || /(^|\/)mcps?(\/|-)/i.test(p),
  tests: (p) => /(^|\/)(__tests__|tests?)\//i.test(p) || /\.(test|spec)\.(ts|js|py)$/i.test(p),
  evals: (p) => /(^|\/)(evals?|benchmarks?)\//i.test(p),
  ci: (p) => /^\.github\/workflows\//i.test(p),
  memory: (p) => /memory/i.test(p),
  plansTemplates: (p) => /(^|\/)(plans?|templates?)\//i.test(p),
  scripts: (p) => /(^|\/)(scripts?|bin)\//i.test(p),
  docs: (p) => /(^|\/)docs?\//i.test(p),
  // hosts
  hostCodex: (p) => /codex/i.test(p),
  hostCursor: (p) => /cursor/i.test(p),
  hostGemini: (p) => /gemini/i.test(p),
  hostCopilot: (p) => /copilot/i.test(p),
  hostOpenCode: (p) => /opencode/i.test(p),
  hostGrok: (p) => /grok/i.test(p),
  hostWindsurf: (p) => /windsurf|antigravity/i.test(p),
  hostLocalModel: (p) => /local-model|ollama|lmstudio|llama/i.test(p),
  // practices by path keyword
  kwTdd: (p) => /tdd|test-driven/i.test(p),
  kwReview: (p) => /review|critic/i.test(p),
  kwVerify: (p) => /verif/i.test(p),
  kwSecurity: (p) => /secur|secret|shield/i.test(p),
  kwPlanSpec: (p) => /(^|\/|-)(plan|spec|brainstorm)/i.test(p),
  kwInterrogate: (p) => /grill|interview|clarify|drill/i.test(p),
  kwRetroLessons: (p) => /retro|lesson|learn/i.test(p),
  kwWorktree: (p) => /worktree/i.test(p),
  kwTelemetryBudget: (p) => /telemetry|budget|usage|cost/i.test(p),
  kwDoctor: (p) => /doctor|health/i.test(p),
  kwPromptEng: (p) => /prompt-eng|prompt_eng|promptengineer/i.test(p),
  kwResearch: (p) => /research/i.test(p),
  kwModelRouting: (p) => /model-(routing|advisor|uplift)|headless|cheap|tier/i.test(p),
};

function classify(paths: string[]): Row {
  const row: Row = { files: paths.length };
  for (const [k, fn] of Object.entries(F)) row[k] = paths.filter(fn).length;
  return row;
}

function ghTree(repo: string): { paths: string[]; truncated: boolean } {
  const out = execSync(`gh api "repos/${repo}/git/trees/HEAD?recursive=1"`, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const j = JSON.parse(out);
  return { paths: (j.tree as { path: string; type: string }[]).filter((t) => t.type === "blob").map((t) => t.path), truncated: !!j.truncated };
}

const rows: Record<string, Row> = {};
// tracked + untracked (032/033 work is not committed yet), minus ignored
// run from the repo root: bun .claude/audits/011-ecosystem-comparison/feature-matrix.ts [--local-only]
const local = execSync("git ls-files --cached --others --exclude-standard", { encoding: "utf8", cwd: process.cwd() }).split(/\r?\n/).filter(Boolean);
rows["poneglyph"] = classify(local);
const localOnly = process.argv.includes("--local-only");
for (const r of localOnly ? [] : REPOS) {
  try {
    const t = ghTree(r);
    rows[r] = classify(t.paths);
    rows[r].truncated = t.truncated ? "yes" : "no";
  } catch (e) {
    rows[r] = { error: String(e).slice(0, 80) };
  }
}

const cols = Object.keys(rows);
const keys = ["files", ...Object.keys(F), "truncated"];
const lines: string[] = [];
lines.push("| feature | " + cols.map((c) => c.split("/").pop()).join(" | ") + " |");
lines.push("|---|" + cols.map(() => "---:").join("|") + "|");
for (const k of keys) lines.push(`| ${k} | ` + cols.map((c) => String(rows[c][k] ?? "")).join(" | ") + " |");
console.log(lines.join("\n"));
