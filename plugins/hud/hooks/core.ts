// Pure logic for the hud mod: what the stats bar says, when to propose a compaction and the
// file Agentic OS reads. register.ts only wires events to it; raster.ts draws thumbnails.

// Theme keys, so every color follows the person's light or dark theme. Each figure has its own
// hue (context runs a traffic light, the 5 hours blue, the week violet, the cache teal); a
// window near its limit turns red whatever its hue.
export type Tone = "success" | "warning" | "claude" | "error" | "ide" | "autoAccept" | "planMode";
export type Limit = { kind: string; percentUsed: number; resetsAt?: string };
export type Sample = { at: number; percent: number };
export type Snapshot = {
  model?: string;
  effort?: string | number;
  context?: number;
  limits: Limit[];
  costUsd?: number;
  cacheLeftMs?: number;
  fullAt?: number;
};
// One figure of the bar, before layout picks how much of it fits: `label` names it at full and
// compact width, `short` at minimal width (empty: dropped there), `trail` is the reset or the
// effort, shown only when there is room, and `alert` is shown at every width.
export type Segment = {
  id: "model" | "context" | "five" | "week" | "cache" | "cost";
  label: string;
  short: string;
  value: string;
  gauge?: number;
  tone?: Tone;
  dim?: boolean;
  trail?: string;
  alert?: string;
};
// A run of text with one style; register.ts maps `style` to the theme.
// A gauge is two runs: `gauge` (the fill, in the figure's hue over the track) and `track`.
export type Run = { text: string; tone?: Tone; style?: "pill" | "label" | "value" | "dim" | "gauge" | "track" };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
export const FIVE_HOUR = "five_hour";
const SEVEN_DAY = "seven_day";

export const contextTone = (percent: number): Tone =>
  percent < 50 ? "success" : percent < 70 ? "warning" : percent < 85 ? "claude" : "error";
const windowTone = (percent: number, hue: Tone): Tone => (percent < 85 ? hue : "error");

// A gauge to an eighth of a cell: full blocks, one partial block, then the empty track.
const EIGHTHS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"];
export function meter(percent: number, width = 8) {
  const eighths = Math.round((Math.max(0, Math.min(100, percent)) / 100) * width * 8);
  const fill = "█".repeat(Math.floor(eighths / 8)) + EIGHTHS[eighths % 8];
  return { fill, track: " ".repeat(width - fill.length) };
}

// "claude-opus-5-5" and "claude-opus-5-5[1m]" read as "Opus 5.5"; anything else as given.
export function modelName(id: string): string {
  const [, family, major, minor] = /(opus|sonnet|haiku|fable)-(\d+)-(\d+)/i.exec(id) ?? [];
  return family ? `${family[0]?.toUpperCase()}${family.slice(1).toLowerCase()} ${major}.${minor}` : id;
}

// Time left as the bar shows it: "41:00" under an hour when `clock`, else "2 h 10", "3 d".
export function left(ms: number, clock = false): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (clock && s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  if (m < 48 * 60) return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
  return `${Math.round(m / 1440)} d`;
}

const clockTime = (at: number) => {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const cacheLeft = (now: number, lastAnswerAt: number | undefined, ttlMs: number) =>
  lastAnswerAt === undefined ? undefined : Math.max(0, lastAnswerAt + ttlMs - now);

// When the window fills at the pace of the last hour, if that comes before it resets. Needs at
// least ten minutes of readings and a rising percent; anything else says nothing.
export function fullAt(samples: Sample[], limit: Limit | undefined, now: number): number | undefined {
  if (!limit?.resetsAt) return undefined;
  const recent = samples.filter((s) => now - s.at <= HOUR);
  const first = recent[0];
  const last = recent.at(-1);
  if (!first || !last || last.at - first.at < 10 * MINUTE || last.percent <= first.percent) return undefined;
  const rate = (last.percent - first.percent) / (last.at - first.at);
  const at = last.at + (100 - last.percent) / rate;
  return at < Date.parse(limit.resetsAt) ? at : undefined;
}

// Keep an hour of readings; a lower percent means the window reset, so start over.
export function addSample(samples: Sample[], sample: Sample): Sample[] {
  const last = samples.at(-1);
  if (last && sample.percent < last.percent) return [sample];
  if (last && last.percent === sample.percent) return samples;
  return [...samples.filter((s) => sample.at - s.at <= HOUR), sample];
}

const usd = (n: number) => (n < 0.01 ? "<$0,01" : `$${n.toFixed(2).replace(".", ",")}`);

const EFFORT: Record<string, string> = { low: "bajo", medium: "medio", high: "alto", xhigh: "muy alto", max: "máximo" };
export const effortName = (e: string | number) => (typeof e === "number" ? String(e) : (EFFORT[e] ?? e));

// The figures in reading order: model, context, the 5-hour window (and when it fills at this
// pace), week, cache, cost. Words, not glyphs, say what each number is.
export function bar(s: Snapshot, now: number): Segment[] {
  const five = s.limits.find((l) => l.kind === FIVE_HOUR);
  const week = s.limits.find((l) => l.kind === SEVEN_DAY);
  const pct = (n: number) => `${Math.round(n)} %`;
  const segs: Segment[] = [];
  if (s.model)
    segs.push({ id: "model", label: "", short: "", value: modelName(s.model), trail: s.effort === undefined ? undefined : effortName(s.effort) });
  if (s.context !== undefined)
    segs.push({ id: "context", label: "CONTEXTO", short: "ctx", value: pct(s.context), gauge: s.context, tone: contextTone(s.context) });
  if (five)
    segs.push({
      id: "five",
      label: "5 HORAS",
      short: "5h",
      value: pct(five.percentUsed),
      gauge: five.percentUsed,
      tone: windowTone(five.percentUsed, "ide"),
      trail: five.resetsAt ? `↻ ${left(Date.parse(five.resetsAt) - now)}` : undefined,
      alert: s.fullAt === undefined ? undefined : `→ lleno ${clockTime(s.fullAt)}`,
    });
  if (week) segs.push({ id: "week", label: "SEMANA", short: "", value: pct(week.percentUsed), gauge: week.percentUsed, tone: windowTone(week.percentUsed, "autoAccept") });
  if (s.cacheLeftMs !== undefined) {
    const cold = s.cacheLeftMs === 0;
    const soon = s.cacheLeftMs < 5 * MINUTE;
    segs.push({
      id: "cache",
      label: "CACHÉ",
      short: "caché",
      // Minutes until the last five, then a clock: one redraw a minute, one a second at the end.
      value: cold ? "fría" : soon ? left(s.cacheLeftMs, true) : left(s.cacheLeftMs),
      tone: cold ? "error" : soon ? "warning" : "planMode",
    });
  }
  if (s.costUsd) segs.push({ id: "cost", label: "GASTO", short: "", value: usd(s.costUsd), dim: true });
  return segs;
}

// Gauge widths per level: full shows all three; mid keeps only the context's traffic light.
const GAUGES = { full: { context: 10, five: 6, week: 6 }, mid: { context: 6 } } as const;
type Level = "full" | "mid" | "compact" | "minimal";
const width = (runs: Run[]) => runs.reduce((n, r) => n + r.text.length, 0);

// The bar at four widths, the widest that fits `columns`: full (labels, gauges, resets), mid
// (labels, values and the context gauge), compact (labels and values) and minimal (model,
// context, 5 h and cache in short words). Minimal is returned even when it overflows; the Text
// cuts it at the edge.
export function layout(segs: Segment[], columns: number): Run[] {
  const level = (kind: Level) => {
    const runs: Run[] = [];
    const value = (s: Segment, text = s.value): Run => ({ text, tone: s.tone, style: s.dim ? "dim" : "value" });
    for (const s of segs) {
      if (s.id === "model") {
        runs.push({ text: kind === "minimal" || !s.trail ? ` ${s.value} ` : ` ◆ ${s.value} · ${s.trail} `, style: "pill" });
        continue;
      }
      if (kind === "minimal") {
        if (!s.short) continue;
        runs.push({ text: !runs.length ? "" : runs.at(-1)?.style === "pill" ? " " : " · ", style: "label" }, { text: `${s.short} `, style: "label" }, value(s, s.value.replace(" %", "%")));
      } else {
        runs.push({ text: runs.length ? "  " : "" }, { text: `${s.label} `, style: "label" });
        const g = kind === "compact" ? undefined : (GAUGES[kind] as Partial<Record<Segment["id"], number>>)[s.id];
        if (g && s.gauge !== undefined) {
          const { fill, track } = meter(s.gauge, g);
          runs.push({ text: fill, tone: s.tone, style: "gauge" }, { text: track, style: "track" }, { text: " " });
        }
        runs.push(value(s));
        if (kind === "full" && s.trail) runs.push({ text: ` ${s.trail}`, style: "dim" });
      }
      if (s.alert) runs.push({ text: ` ${s.alert}`, tone: "warning" });
    }
    return runs.filter((r) => r.text);
  };
  for (const kind of ["full", "mid", "compact"] as const) {
    const runs = level(kind);
    if (width(runs) <= columns) return runs;
  }
  return level("minimal");
}

// Propose a compaction when the cache is about to go cold over a half-full window, or the
// window is nearly full. The person always decides; one proposal per cache window.
export const shouldPropose = (cacheLeftMs: number | undefined, context: number | undefined) =>
  context !== undefined &&
  (context >= 80 || (cacheLeftMs !== undefined && cacheLeftMs > 0 && cacheLeftMs < 5 * MINUTE && context >= 50));

// The shape of ccstatusline's usage cache, so Agentic OS parses both files with one schema.
export function usageFile(limits: Limit[]) {
  const five = limits.find((l) => l.kind === FIVE_HOUR);
  const week = limits.find((l) => l.kind === SEVEN_DAY);
  if (!five && !week) return undefined;
  return {
    sessionUsage: five?.percentUsed ?? null,
    sessionResetAt: five?.resetsAt ?? null,
    weeklyUsage: week?.percentUsed ?? null,
    weeklyResetAt: week?.resetsAt ?? null,
  };
}

// The image numbers a draft holds, in order and once each: "[Image #2] … [Image #1]" → [2, 1].
export const imageNumbers = (draft: string) => [...new Set([...draft.matchAll(/\[Image #(\d+)\]/g)].map((m) => Number(m[1])))];
