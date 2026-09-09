import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "smol-toml";
import { CLAUDE_DESIRED, CONTEXT_POLICY, codexConfigPlan, codexDesired, grokConfigPlan, grokDesired, percentOfWindow, tomlPlan } from "../lib/host-config";

const REPO = join(import.meta.dir, "..", "..", "..");

describe("tomlPlan (plan 037 — one context policy for every host)", () => {
  it("merges only the desired keys and preserves foreign scalars, arrays, tables and array tables", () => {
    const original = 'model = "x"\nnotify = ["a", "b"]\n\n[mcp_servers.ctx]\nurl = "https://e"\n\n[[hooks.Stop]]\nmatcher = ""\n';
    const r = tomlPlan(original, { model_reasoning_effort: "high", session: { pct: 40 } });
    expect(r.changed).toBe(true);
    const out = parse(r.content) as any;
    expect(out.model).toBe("x");
    expect(out.notify).toEqual(["a", "b"]);
    expect(out.mcp_servers.ctx.url).toBe("https://e");
    expect(out.hooks.Stop[0].matcher).toBe("");
    expect(out.model_reasoning_effort).toBe("high");
    expect(out.session.pct).toBe(40);
  });

  it("is byte-stable once satisfied and accepts an empty file", () => {
    const desired = { a: 1, t: { b: "c" } };
    const r = tomlPlan("", desired);
    expect(r.changed).toBe(true);
    expect(tomlPlan(r.content, desired)).toEqual({ changed: false, content: r.content });
  });

  it("turns a scalar into a table when the policy needs a nested key", () => {
    const out = parse(tomlPlan("session = 5\n", { session: { pct: 40 } }).content) as any;
    expect(out.session).toEqual({ pct: 40 });
  });
});

describe("host plans", () => {
  it("codex: effort high, plan mode xhigh, compaction at the default ceiling; the model key is untouched", () => {
    expect(codexDesired()).toEqual({ model_reasoning_effort: "high", plan_mode_reasoning_effort: "xhigh", model_auto_compact_token_limit: 200_000 });
    const out = parse(codexConfigPlan('model = "gpt-6-astra"\nmodel_reasoning_effort = "xhigh"\nmodel_context_window = 872000\nmodel_auto_compact_token_limit = 800000\n').content) as any;
    expect(out.model).toBe("gpt-6-astra");
    expect(out.model_context_window).toBe(872000);
    expect(out.model_reasoning_effort).toBe("high");
    expect(out.model_auto_compact_token_limit).toBe(200_000);
  });

  it("grok: inherited hooks off, effort high, threshold = ceiling as a percent of the model window", () => {
    expect(percentOfWindow(200_000, 500_000)).toBe(40);
    expect(percentOfWindow(400_000, 500_000)).toBe(80);
    expect(percentOfWindow(1, 500_000)).toBe(1);
    expect(grokDesired()).toEqual({ compat: { claude: { hooks: false } }, models: { default_reasoning_effort: "high" }, model: { "grok-4.6": { context_window: 500_000 } }, session: { auto_compact_threshold_percent: 40 } });
    const original = '[permissions]\nmode = "ask"\n[compat.claude]\nskills = true\nhooks = true\n[models]\ndefault = "grok-4.6"\ndefault_reasoning_effort = "xhigh"\n';
    const out = parse(grokConfigPlan(original).content) as any;
    expect(out.permissions.mode).toBe("ask");
    expect(out.compat.claude).toEqual({ skills: true, hooks: false });
    expect(out.models).toEqual({ default: "grok-4.6", default_reasoning_effort: "high" });
    expect(out.model["grok-4.6"].context_window).toBe(500_000); // percent anchored to a stated window
    expect(out.session.auto_compact_threshold_percent).toBe(40);
  });
});

describe("the repo carries the same policy for every host (single source)", () => {
  it("settings.global.json (Claude) names the same ceiling and effort", () => {
    const s = JSON.parse(readFileSync(join(REPO, ".claude", "settings.global.json"), "utf8"));
    expect(s.autoCompactWindow).toBe(CLAUDE_DESIRED.autoCompactWindow);
    expect(s.effortLevel).toBe(CLAUDE_DESIRED.effortLevel);
    expect(`${CONTEXT_POLICY.defaultTokens / 1000}k`).toBe(CLAUDE_DESIRED.autoCompactWindow);
  });

  it(".codex/config.toml (project-level Codex) already satisfies the plan", () => {
    expect(codexConfigPlan(readFileSync(join(REPO, ".codex", "config.toml"), "utf8")).changed).toBe(false);
  });
});
