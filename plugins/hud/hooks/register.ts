import type { EngineInterface, Register } from "claude-code";
import {
  addSample,
  bar,
  cacheLeft,
  FIVE_HOUR,
  fullAt,
  imageNumbers,
  layout,
  shouldPropose,
  usageFile,
  type Limit,
  type Sample,
} from "./core.ts";
import { bmpCells, thumbSize } from "./raster.ts";

// Pasting an image raises no prompt.edit (the tag shows up on the next keystroke), so the
// draft is polled, as claude-image-view (MIT, jarrodwatts) found.
const POLL_MS = 200;
const TICK_MS = 1000;
const THUMB = { columns: 48, rows: 12 };
// As workboard.mjs: a stuck Agentic OS never holds the draft poll for longer.
const POST_MS = 8000;
// An [Image #N] whose file never shows up is given up on after this many polls of one draft.
const MAX_MISSES = 5;

type Thumb = { n: number; raster?: { columns: number; rows: number; cells: string; size: string } };
// Inside an Agentic OS terminal: where to send the draft's images and which terminal this is.
type Aos = { origin: string; id: string };

let model: string | undefined;
let effort: string | number | undefined;
let context: number | undefined;
let limits: Limit[] = [];
let costUsd: number | undefined;
let samples: Sample[] = [];
let lastAnswerAt: number | undefined;
let dismissedFor: number | undefined;
let compacting = false;
let shownKey = "";
let thumbs: Thumb[] = [];
let draftKey = "";
let polling = false;
let imagesDir: string | undefined;
let tmpDir: string | undefined;
let misses = 0;
let missKey = "";
// Interactive session only; the timers are set once, on the first start.
let active = false;
let timers = false;
const rasters = new Map<string, Thumb["raster"] | null>();
let aos: Aos | undefined;
// The draft images Agentic OS shows, by number; null when it refused or could not be reached.
let inAos: number[] | null = null;
let sentKey = "";

// AOS_URL and AOS_AGENT_ID are set by Agentic OS for the terminals it runs; only a loopback
// origin is taken, as workboard does.
async function findAos($: EngineInterface): Promise<Aos | undefined> {
  const [url, id] = [await $.env.get("AOS_URL"), await $.env.get("AOS_AGENT_ID")];
  if (!url || !id) return undefined;
  try {
    const u = new URL(url);
    const loopback = ["127.0.0.1", "localhost", "agentic-os.localhost", "[::1]"].includes(u.hostname);
    if (u.protocol !== "http:" || !loopback || u.username || u.password || u.pathname !== "/" || u.search || u.hash) return undefined;
    return { origin: u.origin, id };
  } catch {
    return undefined;
  }
}

// Agentic OS draws the draft's images at full resolution beside the terminal, which Claude Code
// cannot do in xterm.js. The bytes go, never a path. True when it took them.
async function sendDraft($: EngineInterface, target: Aos, dir: string | undefined, numbers: number[]): Promise<boolean> {
  try {
    const images = [];
    for (const n of numbers) {
      const src = `${dir}/${n}.png`;
      if (!dir || !(await $.fs.exists(src))) return false;
      images.push({ n, image: { mime: "image/png", data: (await $.fs.read(src, { as: "bytes" })).base64 } });
    }
    // The host's fetch takes no AbortSignal, so the wait is raced against a timer.
    const response = await Promise.race([
      $.http.fetch(`${target.origin}/api/terminals/${encodeURIComponent(target.id)}/drafts`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: target.origin, "x-aos-agent-id": target.id },
        body: JSON.stringify({ images }),
      }),
      $.clock.sleep(POST_MS).then(() => null),
    ]);
    return !!response?.ok;
  } catch {
    return false;
  }
}

// The cache lives an hour on a subscription (rate limits reported) and five minutes on an
// API key; HUD_CACHE_TTL_MIN overrides both.
async function ttlMs($: EngineInterface) {
  const env = Number(await $.env.get("HUD_CACHE_TTL_MIN"));
  return (Number.isFinite(env) && env > 0 ? env : limits.length ? 60 : 5) * 60_000;
}

async function snapshot($: EngineInterface) {
  const now = await $.clock.now();
  const left = cacheLeft(now, lastAnswerAt, await ttlMs($));
  const five = limits.find((l) => l.kind === FIVE_HOUR);
  return { now, left, snap: { model, effort, context, limits, costUsd, cacheLeftMs: left, fullAt: fullAt(samples, five, now) } };
}

const proposing = (left: number | undefined) =>
  !compacting && dismissedFor !== lastAnswerAt && shouldPropose(left, context);

// Redraw only when something the person sees changed: any field of the bar or the proposal.
async function tick($: EngineInterface) {
  const { now, left, snap } = await snapshot($);
  const key = JSON.stringify(bar(snap, now)) + (proposing(left) ? "!" : "");
  if (key === shownKey) return;
  shownKey = key;
  $.ui.invalidate("ui.render");
}

function measure(e: { context: { percent?: number }; rateLimits: Limit[]; cost?: { usd: number } }) {
  context = e.context.percent ?? context;
  costUsd = e.cost?.usd ?? costUsd;
  limits = e.rateLimits.length ? e.rateLimits : limits;
}

// Claude Code caches each paste as <tmp>/<project>/<session>/images/<n>.png; the project
// folder is named after a directory that may have moved, so find it by the session id.
async function findImages($: EngineInterface): Promise<string | undefined> {
  if (imagesDir) return imagesDir;
  tmpDir ??= (await $.env.get("CLAUDE_CODE_TMPDIR")) ?? `/tmp/claude-${(await $.process.run(["id", "-u"])).stdout.trim()}`;
  const tmp = tmpDir;
  const session = await $.session.id();
  for (const entry of await $.fs.list(tmp).catch(() => [])) {
    const dir = `${tmp}/${entry.name}/${session}/images`;
    if (entry.kind === "dir" && (await $.fs.exists(dir))) return (imagesDir = dir);
  }
  return undefined;
}

// macOS sips scales the PNG and writes an uncompressed BMP that raster.ts turns into cells.
// ponytail: macOS only, other systems show the [Image #N] tag alone; decode PNG in-process if hud runs elsewhere.
async function rasterOf($: EngineInterface, dir: string, n: number): Promise<Thumb["raster"] | null> {
  const src = `${dir}/${n}.png`;
  if (rasters.has(src)) return rasters.get(src);
  if (!(await $.fs.exists(src))) return undefined;
  let raster: Thumb["raster"] | null = null;
  try {
    const dims = (await $.process.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", src])).stdout;
    const w = Number(/pixelWidth: (\d+)/.exec(dims)?.[1]);
    const h = Number(/pixelHeight: (\d+)/.exec(dims)?.[1]);
    if (w > 0 && h > 0) {
      const { columns, rows } = thumbSize(w, h, THUMB.columns, THUMB.rows);
      // In the temp folder, not Claude's images folder, and removed once read, as vista does.
      const out = `${(await $.env.get("TMPDIR")) ?? "/tmp"}/hud-${crypto.randomUUID()}.bmp`.replace("//", "/");
      try {
        const run = await $.process.run(["sips", "-z", String(rows * 2), String(columns * 2), "-s", "format", "bmp", src, "--out", out]);
        if (run.exitCode === 0) raster = { ...bmpCells(Uint8Array.fromBase64((await $.fs.read(out, { as: "bytes" })).base64)), size: `${w}×${h}` };
      } finally {
        await $.process.run(["rm", "-f", out]).catch(() => {});
      }
    }
  } catch {
    raster = null;
  }
  rasters.set(src, raster);
  return raster;
}

async function poll($: EngineInterface) {
  if (polling) return;
  polling = true;
  try {
    const numbers = imageNumbers((await $.prompt.read()).text);
    const key = numbers.join(",");
    if (key === draftKey) return;
    const dir = numbers.length ? await findImages($) : undefined;
    // Agentic OS shows them: one line here instead of block thumbnails. Refused or unreachable,
    // the thumbnails come back, so the person still sees what is attached.
    if (aos && key !== sentKey) {
      inAos = (await sendDraft($, aos, dir, numbers)) ? numbers : null;
      sentKey = inAos ? key : "";
      if (inAos) {
        draftKey = key;
        thumbs = numbers.map((n) => ({ n }));
        $.ui.invalidate("ui.render");
        return;
      }
    }
    const next: Thumb[] = [];
    for (const n of numbers) next.push({ n, raster: dir ? ((await rasterOf($, dir, n)) ?? undefined) : undefined });
    // A file still being written keeps the key open, so the next poll draws it; a few misses
    // for the same draft and it is given up on (the tag alone stays).
    if (key !== missKey) [missKey, misses] = [key, 0];
    const settled = next.every((t) => t.raster || rasters.get(`${dir}/${t.n}.png`) === null);
    draftKey = settled || ++misses >= MAX_MISSES ? key : "";
    thumbs = next;
    $.ui.invalidate("ui.render");
  } finally {
    polling = false;
  }
}

async function writeUsage($: EngineInterface) {
  const data = usageFile(limits);
  const home = await $.env.get("HOME");
  if (data && home) await $.fs.write(`${home}/.cache/poneglyph/usage.json`, JSON.stringify(data)).catch(() => {});
}

// The bar draws on the terminal and on the desktop app, which starts the session with no surface
// and joins it later. Pasted images are read from the terminal's own draft, so only it polls.
let polls = false;
async function activate($: EngineInterface, terminal: boolean) {
  if (!active) {
    active = true;
    imagesDir = tmpDir = undefined;
    [shownKey, draftKey, sentKey, missKey] = ["", "", "", ""];
    [thumbs, inAos, misses] = [[], null, 0];
    rasters.clear();
    model = await $.session.model();
    aos = await findAos($);
    measure(await $.session.usage());
  }
  if (!timers) {
    timers = true;
    $.clock.every(TICK_MS, () => tick($).catch(() => {}));
  }
  if (terminal && !polls) {
    polls = true;
    $.clock.every(POLL_MS, () => poll($).catch(() => {}));
  }
}

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    const r = await next(e);
    active = false;
    if (e.isInteractive && e.surface === "terminal") await activate($, true);
    return r;
  });

  on("session.attach", { surface: "desktop" }, async ($, e, next) => {
    const r = await next(e);
    await activate($, false);
    return r;
  });

  on("session.measure", async ($, e, next) => {
    const r = await next(e);
    if (!active) return r;
    measure(e);
    // Written on every reading, moved or not: Agentic OS dates the figures by the file's mtime.
    if (e.rateLimits.length) {
      const five = limits.find((l) => l.kind === FIVE_HOUR);
      if (five) samples = addSample(samples, { at: await $.clock.now(), percent: five.percentUsed });
      await writeUsage($);
    }
    await tick($);
    return r;
  });

  on("turn.step", async function* ($, e, next) {
    if (!e.agentId) {
      model = e.model;
      effort = e.effort;
    }
    return yield* next(e);
  });

  on("turn.complete", async ($, e, next) => {
    const r = await next(e);
    if (e.agentId || !active) return r;
    lastAnswerAt = await $.clock.now();
    await tick($);
    return r;
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const theirs = await next(e);
    if (!active || e.props.hasSurvey) return theirs;
    const { now, left, snap } = await snapshot($);
    const runs = layout(bar(snap, now), e.props.bodyColumns);
    const propose = proposing(left);
    const shown = e.surface === "terminal" ? thumbs : [];
    if (!runs.length && !propose && !shown.length) return theirs;
    const ui = $.ui.resolve(e);
    const { Box, Text, Button } = ui;
    const Raster = "Raster" in ui ? ui.Raster : undefined;
    const ours = [];
    if (runs.length)
      ours.push(
        Text({
          wrap: "truncate-end",
          children: runs.map((r) =>
            r.style === "pill"
              ? Text({ backgroundColor: "suggestion", color: "inverseText", weight: "semibold", children: [r.text] })
              : r.style === "label"
                ? Text({ color: "inactive", children: [r.text] })
                : r.style === "gauge" || r.style === "track"
                  ? Text({ color: r.tone, backgroundColor: "subtle", children: [r.text] })
                  : Text({ color: r.tone, weight: r.style === "value" ? "semibold" : "regular", dimColor: r.style === "dim", children: [r.text] }),
          ),
        }),
      );
    if (shown.length && inAos?.length) {
      ours.push(
        Text({
          wrap: "truncate-end",
          children: [
            Text({ color: "suggestion", children: ["▣ "] }),
            Text({ color: "suggestion", weight: "semibold", children: [shown.map((t) => `#${t.n}`).join(" ")] }),
            Text({ dimColor: true, children: [" · a resolución completa en Agentic OS"] }),
          ],
        }),
      );
    } else if (shown.length) {
      let width = 0;
      // Each in a rounded frame (2 columns) with its number and size underneath.
      const fit = shown.filter((t) => (width += Math.max(t.raster?.columns ?? 10, 12) + 3) <= e.props.bodyColumns);
      ours.push(
        Box({
          flexDirection: "row",
          columnGap: 1,
          children: [
            ...fit.map((t) =>
              Box({
                flexDirection: "column",
                borderStyle: "round",
                borderColor: "subtle",
                alignItems: "center",
                children: [
                  t.raster && Raster
                    ? Raster({ key: `hud-image-${t.n}`, columns: t.raster.columns, rows: t.raster.rows, cells: t.raster.cells })
                    : Text({ dimColor: true, children: ["sin vista"] }),
                  Text({ wrap: "truncate-end", children: [Text({ color: "suggestion", weight: "semibold", children: [`#${t.n}`] }), Text({ dimColor: true, children: [t.raster ? ` · ${t.raster.size}` : ""] })] }),
                ],
              }),
            ),
            ...(fit.length < shown.length ? [Text({ dimColor: true, children: [`+${shown.length - fit.length}`] })] : []),
          ],
        }),
      );
    }
    if (propose) {
      const why = (context ?? 0) >= 80 ? `Contexto al ${Math.round(context ?? 0)} %` : "Caché a punto de enfriarse";
      ours.push(
        Box({
          flexDirection: "row",
          columnGap: 1,
          children: [
            Text({ color: "warning", wrap: "truncate-end", children: [`${why}: compactar sale más barato`] }),
            Button({
              key: "hud-compact",
              label: "Compactar ahora",
              hotkey: "c",
              onPress: () => {
                compacting = true;
                void $.session
                  .compact({})
                  .then(async ({ skip }) => {
                    if (skip) return $.ui.toast("Otro mod ha parado la compactación");
                    // The summary is a fresh prefix: the cache starts over from now.
                    lastAnswerAt = await $.clock.now();
                  })
                  .catch(() => $.ui.toast("No se puede compactar mientras Claude trabaja"))
                  .finally(() => {
                    compacting = false;
                    void tick($);
                  });
              },
            }),
            Button({
              key: "hud-dismiss",
              label: "Descartar",
              hotkey: "x",
              onPress: () => {
                dismissedFor = lastAnswerAt;
                void tick($);
              },
            }),
          ],
        }),
      );
    }
    return Box({ flexDirection: "column", children: [theirs, ...ours] });
  });
};
