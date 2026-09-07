/**
 * charts.ts — html-report DYNAMIC mode (feature 010, US5).
 * Hand-rolled inline SVG charts (grammar-of-graphics defaults, palette via
 * theme tokens) with hover tooltip + no-JS fallback (aria-label + visible values).
 * Self-contained: zero runtime deps in the artefact. Hand-only by design — the
 * Observable Plot opt-in (`plotInline`) was removed at feature 010 close; the
 * hand-rolled path is canonical (see US5.AC3 re-frame in review.md).
 */
import type { Chart, ChartPoint } from "./contract.ts";

/** Linear scale domain→range. Pure; the testable core. */
export function scale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const dd = d1 - d0 || 1;
  return (v: number): number => r0 + ((v - d0) / dd) * (r1 - r0);
}

/** Chart CSS — injected ONCE into the document's single <style> (not per-SVG). */
export const chartCss = `
.c-lbl{fill:var(--ink-2);font:500 12px var(--mono)}.c-val{fill:var(--ink);font:600 12px var(--mono)}.c-track{fill:var(--track)}
.chart-svg .bar{transition:opacity .15s}.chart-svg .bar:hover{opacity:.82}
.donut-wrap{display:flex;align-items:center;gap:1.6rem;flex-wrap:wrap;margin:.6rem 0 .2rem}
.donut .dnum{fill:var(--ink);font-family:var(--serif);font-weight:600;font-size:26px;font-variant-numeric:tabular-nums}
.donut .dlbl{fill:var(--ink-3);font-family:var(--mono);font-weight:500;font-size:9px;letter-spacing:.12em;text-transform:uppercase}
.donut .dseg{transition:opacity .15s}.donut .dseg:hover{opacity:.82}
.dlegend{list-style:none;display:flex;flex-direction:column;gap:.5rem;font-size:var(--t-sm);color:var(--ink-2);min-width:160px}
.dlegend li{display:flex;align-items:center;gap:.55rem}.dlegend b{color:var(--ink);font-variant-numeric:tabular-nums;margin-left:auto}
.dlegend .ddot{width:11px;height:11px;border-radius:3px;flex-shrink:0}
@media(prefers-reduced-motion:no-preference){
.chart-svg .bar{transform-box:fill-box;transform-origin:left center;animation:bargrow .7s cubic-bezier(.22,1,.36,1) both}
@keyframes bargrow{from{transform:scaleX(0)}}
.donut .dseg{animation:dfade .9s ease-out both}@keyframes dfade{from{opacity:0}}
}`;

const PAL: Record<string, string> = {
  good: "var(--good)", mid: "var(--mid)", warn: "var(--warn)", bad: "var(--bad)",
  neutral: "var(--accent)",
};
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Horizontal bar chart. N points → N <rect class="bar">; width ∝ value. */
export function bar(series: ChartPoint[], opts: { max?: number; unit?: string; title?: string } = {}): string {
  const W = 196, rowH = 32, pad = 118, vw = W + pad + 46;
  const max = opts.max ?? Math.max(1, ...series.map((p) => p.value));
  const sx = scale([0, max], [0, W]);
  const h = Math.max(rowH, series.length * rowH) + 8;
  const rows = series
    .map((p, i) => {
      const y = i * rowH + 4;
      const w = Math.max(0, sx(p.value));
      const col = PAL[p.health || "neutral"];
      return `<text class="c-lbl" x="0" y="${y + 22}">${esc(p.label)}</text>
<rect class="c-track" x="${pad}" y="${y + 9}" width="${W}" height="17" rx="8"/>
<rect class="bar" x="${pad}" y="${y + 9}" width="${w.toFixed(1)}" height="17" rx="8" fill="${col}" data-label="${esc(p.label)}" data-value="${p.value}${opts.unit ? esc(opts.unit) : ""}"><title>${esc(p.label)}: ${p.value}${opts.unit ? esc(opts.unit) : ""}</title></rect>
<text class="c-val" x="${pad + W + 8}" y="${y + 22}">${p.value}${opts.unit ? esc(opts.unit) : ""}</text>`;
    })
    .join("\n");
  const aria = series.map((p) => `${p.label} ${p.value}`).join(", ");
  return `<svg class="chart-svg" role="img" aria-label="${esc(opts.title || "barras")}: ${esc(aria)}" viewBox="0 0 ${vw} ${h}" width="100%" style="max-width:${vw}px">
${rows}
</svg>`;
}

/** Simple line/area sparkline. */
export function line(series: ChartPoint[], opts: { title?: string } = {}): string {
  if (!series.length) return `<svg class="chart-svg" role="img" aria-label="línea vacía" viewBox="0 0 300 80"></svg>`;
  const W = 300, H = 70, max = Math.max(1, ...series.map((p) => p.value));
  const sx = scale([0, series.length - 1 || 1], [4, W - 4]);
  const sy = scale([0, max], [H - 6, 6]);
  const pts = series.map((p, i) => `${sx(i).toFixed(1)},${sy(p.value).toFixed(1)}`).join(" ");
  const aria = series.map((p) => `${p.label} ${p.value}`).join(", ");
  return `<svg class="chart-svg" role="img" aria-label="${esc(opts.title || "línea")}: ${esc(aria)}" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">
<polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${pts}"/>
${series.map((p, i) => `<circle class="bar" cx="${sx(i).toFixed(1)}" cy="${sy(p.value).toFixed(1)}" r="3" fill="var(--accent)" data-label="${esc(p.label)}" data-value="${p.value}"><title>${esc(p.label)}: ${p.value}</title></circle>`).join("\n")}
</svg>`;
}

/** Donut chart (hero data-viz): proportional ring + center total + legend. */
export function donut(series: ChartPoint[], opts: { title?: string; centerLabel?: string } = {}): string {
  const total = series.reduce((s, p) => s + p.value, 0) || 1;
  const r = 54, C = 2 * Math.PI * r, cx = 70, cy = 70;
  let off = 0;
  const segs = series
    .map((p) => {
      const len = (p.value / total) * C;
      const col = PAL[p.health || "neutral"];
      const seg = `<circle class="dseg" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="18" stroke-linecap="butt" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})" data-label="${esc(p.label)}" data-value="${p.value}"><title>${esc(p.label)}: ${p.value}</title></circle>`;
      off += len;
      return seg;
    })
    .join("\n");
  const legend = series
    .map((p) => `<li><span class="ddot" style="background:${PAL[p.health || "neutral"]}"></span>${esc(p.label)}<b>${p.value}</b></li>`)
    .join("");
  const aria = series.map((p) => `${p.label} ${p.value}`).join(", ");
  return `<div class="donut-wrap">
<svg class="donut" role="img" aria-label="${esc(opts.title || "distribución")}: ${esc(aria)}" viewBox="0 0 140 140" width="140" height="140">
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--track)" stroke-width="18"/>
${segs}
<text x="${cx}" y="${cy - 4}" text-anchor="middle" class="dnum">${total}</text>
<text x="${cx}" y="${cy + 14}" text-anchor="middle" class="dlbl">${esc(opts.centerLabel || "total")}</text>
</svg>
<ul class="dlegend">${legend}</ul>
</div>`;
}

/** Dispatch by kind. */
export function chart(ch: Chart): string {
  if (ch.kind === "line") return line(ch.series, { title: ch.title });
  if (ch.kind === "donut") return donut(ch.series, { title: ch.title, centerLabel: ch.unit });
  return bar(ch.series, { max: ch.max, unit: ch.unit, title: ch.title });
}

// plotInline (Observable Plot opt-in hook) removed at close (feature 010, hand-only
// decision): hand-rolled SVG charts are the contract — self-contained, zero gen-time
// deps. If a real Plot path is wanted later, reintroduce as a separate feature.
