/**
 * render.ts — html-report DYNAMIC mode generator (feature 010, US3).
 * `render(data: ReportData) -> string` : ONE self-contained interactive HTML.
 * Shell + nav(sticky/scrollspy) + collapsible sections + theme toggle + footer.
 * Rich blocks (table/chart/sidenote) get a functional baseline here; US4/US5
 * upgrade them and US6 wires the dedicated modules in.
 *
 * Self-contained: 1 <style>, inline <script> (no src=http), 1 optional Fonts link.
 * No-JS fallback: <details open> sections, anchor nav, content in static markup.
 *
 * CLI:  bun run render.ts < data.json > out.html
 */
import type { ReportData, Section, Kpi, Callout } from "./contract.ts";
import { themeCss } from "./theme.ts";
import { chart, chartCss } from "./charts.ts";
import { tableFilterable, filterScript, filterCss } from "./components.ts";
import { mdToHtml, copyable, copyCss, copyScript } from "./comments.ts";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const healthClass = (h?: string): string => (h && h !== "neutral" ? ` h-${h}` : "");

function kpiRow(kpis: Kpi[]): string {
  if (!kpis.length) return "";
  const cards = kpis
    .map(
      (k) => `<div class="kpi">
      <span class="kpi-k">${k.flag ? '<span class="pip"></span>' : ""}${esc(k.label)}</span>
      <span class="kpi-v num${healthClass(k.health)}">${esc(k.value)}</span>
      ${k.sub ? `<span class="kpi-sub">${esc(k.sub)}</span>` : ""}
    </div>`
    )
    .join("");
  return `<section class="kpi-grid" aria-label="Indicadores">${cards}</section>`;
}

function callout(c: Callout): string {
  return `<aside class="callout c-${c.kind}">${
    c.title ? `<strong>${esc(c.title)}</strong> ` : ""
  }<span>${c.body}</span></aside>`;
}

// Baseline table/chart removed in US6 — now delegated to components.ts (tableFilterable) / charts.ts (chart).

function sectionHtml(s: Section): string {
  const blocks = (s.blocks || [])
    .map((b, i) => {
      switch (b.type) {
        case "prose": return `<div class="prose">${b.md ? mdToHtml(b.md) : (b.html || "")}</div>`;
        case "comment": return b.data.copy
          ? copyable(`<div class="prose">${mdToHtml(b.data.md)}</div>`, b.data.md, b.data.title)
          : `<div class="prose">${b.data.title ? `<h3 class="blk">${esc(b.data.title)}</h3>` : ""}${mdToHtml(b.data.md)}</div>`;
        case "kpis": return kpiRow(b.data);
        case "callout": return callout(b.data);
        case "table": return tableFilterable(b.data, `tbl-${s.id}-${i}`);
        case "chart": return `<figure class="chart-block">${b.data.title ? `<figcaption>${esc(b.data.title)}</figcaption>` : ""}${chart(b.data)}</figure>`;
        case "sidenote":
          return `<aside class="sidenote"><sup>${esc(b.data.marker)}</sup> ${b.data.body}</aside>`;
        default: return "";
      }
    })
    .join("\n");
  return `<details class="sec" id="${esc(s.id)}" open>
    <summary class="sec-h">${s.num ? `<span class="sec-n">${esc(s.num)}</span>` : ""}<span class="sec-t">${esc(s.title)}</span></summary>
    <div class="sec-body">${blocks}</div>
  </details>`;
}

export function render(data: ReportData): string {
  const m = data.meta;
  const nav = data.sections
    .map((s) => `<a href="#${esc(s.id)}" data-spy="${esc(s.id)}">${s.num ? esc(s.num) + " · " : ""}${esc(s.title)}</a>`)
    .join("");
  const verdictCls = m.verdict ? ` v-${m.verdict.kind}` : "";
  return `<!DOCTYPE html>
<html lang="es"${data.defaultTheme ? ` data-theme="${data.defaultTheme}"` : ""}>
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(m.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>${themeCss()}${filterCss}${chartCss}${copyCss}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:16px;scroll-behavior:smooth}
body{font-family:var(--sans);background:var(--bg);color:var(--ink);line-height:1.6;font-size:var(--t-base);-webkit-font-smoothing:antialiased;padding:clamp(1.5rem,4vw,3rem) clamp(1rem,4vw,2rem) 4rem}
.wrap{max-width:var(--maxw);margin:0 auto;display:grid;grid-template-columns:230px minmax(0,1fr);column-gap:clamp(1.5rem,3vw,3rem);align-items:start}
a{color:var(--link);text-decoration:none}a:hover{text-decoration:underline}
code{font-family:var(--mono);font-size:.88em;background:var(--surface-2);border:1px solid var(--line);border-radius:5px;padding:.04em .34em}
.num{font-variant-numeric:tabular-nums}
/* header spans both cols — no card, type carries it */
.masthead{grid-column:1/-1;position:relative;padding-top:1.4rem;border-bottom:1px solid var(--line);padding-bottom:1.4rem;margin-bottom:1.8rem}
.masthead::before{content:'';position:absolute;top:0;left:0;width:128px;height:3px;border-radius:2px;background:linear-gradient(90deg,var(--accent),var(--accent-2) 55%,transparent)}
.eyebrow{font-family:var(--mono);font-size:var(--t-xs);letter-spacing:.18em;text-transform:uppercase;color:var(--ink-3);display:flex;gap:.6rem;flex-wrap:wrap;align-items:center}
.eyebrow time{margin-left:auto}
.verdict{display:inline-flex;align-items:center;gap:.5rem;font-family:var(--mono);font-size:var(--t-xs);letter-spacing:.1em;text-transform:uppercase;color:var(--ok);margin:.9rem 0}
.verdict.v-warn,.verdict.v-major{color:var(--warn)}.verdict.v-blocker{color:var(--bad)}
.verdict .pip{width:7px;height:7px;border-radius:50%;background:currentColor}
h1.title{font-family:var(--serif);font-weight:500;font-size:var(--t-3xl);line-height:1.05;letter-spacing:-.015em}
h1.title em{font-style:italic;color:var(--ink-2);font-weight:400}
.lede{margin-top:.7rem;font-family:var(--serif);font-size:var(--t-md);color:var(--ink-2);max-width:60ch}
.nowbar{grid-column:1/-1;display:flex;gap:.7rem;flex-wrap:wrap;align-items:baseline;margin:0 0 1.8rem;padding:.8rem 1.05rem;background:color-mix(in srgb,var(--bad) 8%,var(--surface));border:1px solid var(--line);border-left:3px solid var(--bad);border-radius:10px;box-shadow:var(--shadow)}
.nowbar .k{font-family:var(--mono);font-size:var(--t-xs);letter-spacing:.12em;text-transform:uppercase;color:var(--bad)}
.nowbar .v{font-size:.9rem;color:var(--ink-2)}.nowbar .v b{color:var(--ink);font-weight:500}
/* KPI row: subtle bg, no heavy borders */
.kpi-grid{grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.7rem;margin-bottom:2rem}
.kpi{background:var(--surface);border:1px solid var(--line);border-top:2px solid color-mix(in srgb,var(--accent) 60%,var(--line));border-radius:12px;padding:.85rem 1rem;display:flex;flex-direction:column;gap:.35rem;box-shadow:var(--shadow);transition:transform .2s ease,box-shadow .2s ease}
.kpi:hover{transform:translateY(-3px);box-shadow:var(--shadow),0 14px 30px rgba(0,0,0,.16)}
.kpi-k{font-family:var(--mono);font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3);display:flex;align-items:center;gap:.4rem}
.kpi-k .pip{width:6px;height:6px;border-radius:50%;background:var(--bad)}
.kpi-v{font-family:var(--sans);font-weight:600;font-size:1.9rem;line-height:1;letter-spacing:-.01em;color:var(--accent)}
.kpi-v.h-good{color:var(--good)}.kpi-v.h-mid{color:var(--mid)}.kpi-v.h-warn{color:var(--warn)}.kpi-v.h-bad{color:var(--bad)}
.kpi-sub{font-size:var(--t-xs);color:var(--ink-3);margin-top:auto}
/* sticky TOC */
.toc{position:sticky;top:1.5rem;align-self:start;font-size:var(--t-sm);display:flex;flex-direction:column;gap:.1rem;max-height:calc(100vh - 3rem);overflow:auto}
.toc a{padding:.32rem .5rem;border-left:2px solid transparent;color:var(--ink-2);border-radius:4px}
.toc a:hover{color:var(--accent);background:var(--accent-bg);text-decoration:none}
.toc a.active{color:var(--accent);border-left-color:var(--accent);font-weight:500}
main{min-width:0}
/* sections: hairline rhythm, NOT uniform cards */
.sec{border-bottom:1px solid var(--line);padding:.3rem 0 1.4rem;margin-bottom:1.4rem}
.sec-h{cursor:pointer;list-style:none;display:flex;align-items:baseline;gap:.6rem;font-family:var(--serif);font-weight:600;font-size:var(--t-lg);margin-bottom:.9rem}
.sec-h::-webkit-details-marker{display:none}
.sec-n{font-family:var(--mono);font-size:var(--t-xs);color:var(--accent);font-weight:700;background:var(--accent-bg);padding:.18rem .5rem;border-radius:6px}
.sec-h::after{content:'';flex:1;height:1px;background:var(--line);align-self:center}
.sec[open] .sec-t::before{content:'▾ ';color:var(--ink-3)}.sec:not([open]) .sec-t::before{content:'▸ ';color:var(--ink-3)}
.prose{max-width:68ch}.prose p{margin-bottom:.9rem}
h3.blk{font-family:var(--sans);font-weight:600;font-size:var(--t-md);margin:1.2rem 0 .6rem}
.callout{display:block;border-left:3px solid var(--accent);background:var(--accent-bg);border-radius:8px;padding:.8rem 1.05rem;margin:.9rem 0;max-width:68ch;font-size:var(--t-base)}
.callout.c-warn{border-left-color:var(--warn)}.callout.c-danger{border-left-color:var(--bad)}.callout.c-tip{border-left-color:var(--good)}
.callout strong{color:var(--accent)}
.tbl-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin:.6rem 0}
.tbl{width:100%;border-collapse:collapse;font-size:var(--t-sm)}
.tbl th{text-align:left;padding:.55rem .8rem;font-family:var(--mono);font-size:var(--t-xs);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);background:var(--surface-2);border-bottom:1px solid var(--line-strong)}
.tbl td{padding:.55rem .8rem;border-bottom:1px solid var(--line);vertical-align:top}.tbl tr:last-child td{border-bottom:none}
.tbl tbody tr{transition:background .15s ease}.tbl tbody tr:hover td{background:var(--surface-2)}
.tbl th.num,.tbl td.num{text-align:right;font-variant-numeric:tabular-nums}
.tbl tr.sev-blocker td:first-child{box-shadow:inset 3px 0 0 var(--blocker)}.tbl tr.sev-major td:first-child{box-shadow:inset 3px 0 0 var(--major)}.tbl tr.sev-minor td:first-child{box-shadow:inset 3px 0 0 var(--minor)}.tbl tr.sev-nit td:first-child{box-shadow:inset 3px 0 0 var(--nit)}
.chart{display:flex;flex-direction:column;gap:.5rem;margin:.6rem 0;max-width:68ch}
.chart-block{display:inline-block;vertical-align:top;width:min(100%,380px);margin:0 1.6rem 1.4rem 0}
.chart-block figcaption{font-family:var(--sans);font-weight:600;font-size:var(--t-sm);color:var(--ink);margin-bottom:.55rem;letter-spacing:-.01em}
/* Tufte-style sidenote: margin on desktop, inline on mobile */
.sidenote{font-size:var(--t-sm);color:var(--ink-2);border-left:2px solid var(--line-strong);padding-left:.7rem;margin:.6rem 0}
@media(min-width:1100px){.sidenote{float:right;clear:right;width:14rem;margin-right:-15.5rem;border-left:none;padding-left:0;border-top:1px solid var(--line-strong);padding-top:.4rem}}
.toolbar{grid-column:1/-1;display:flex;justify-content:flex-end;margin-bottom:.4rem}
.tbtn{font-family:var(--mono);font-size:var(--t-xs);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:.3rem .7rem;cursor:pointer}
.tbtn:hover{color:var(--accent);border-color:var(--accent)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:3px}
footer{grid-column:1/-1;margin-top:2.5rem;padding-top:1.2rem;border-top:1px solid var(--line);font-family:var(--mono);font-size:var(--t-xs);color:var(--ink-3);display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem}
@media(prefers-reduced-motion:no-preference){.sec-body{animation:fade .3s ease-out}@keyframes fade{from{opacity:0}}}
@media(max-width:820px){.wrap{grid-template-columns:1fr}.toc{position:static;flex-flow:row wrap;max-height:none;margin-bottom:1.5rem;border:1px solid var(--line);border-radius:10px;padding:.5rem}.sidenote{float:none;width:auto;margin-right:0}}
@media print{body{background:#fff;color:#000}.toc,.toolbar,.nowbar{display:none}.wrap{display:block}.sec{break-inside:avoid}a[href^="http"]::after{content:" ("attr(href)")";font-size:.8em}}
</style>
</head>
<body>
<div class="wrap">
  <header class="masthead">
    <div class="eyebrow"><span>${esc(m.brand || "PONEGLYPH")}</span>${m.kicker ? `<span>/ ${esc(m.kicker)}</span>` : ""}${m.mode ? `<span>/ ${esc(m.mode)}</span>` : ""}<time>${esc(m.date)}</time></div>
    ${m.verdict ? `<div class="verdict${verdictCls}"><span class="pip"></span>${esc(m.verdict.text)}</div>` : ""}
    <h1 class="title">${esc(m.title)}${m.titleEm ? ` <em>${esc(m.titleEm)}</em>` : ""}</h1>
    ${m.lede ? `<p class="lede">${esc(m.lede)}</p>` : ""}
  </header>
  ${m.now ? `<div class="nowbar"><span class="k">${esc(m.now.label)}</span><span class="v">${m.now.action}</span></div>` : ""}
  <div class="toolbar"><button class="tbtn" id="themeBtn" type="button" aria-label="Cambiar tema">◐ tema</button></div>
  ${kpiRow(data.kpis || [])}
  <nav class="toc" aria-label="Índice">${nav}</nav>
  <main>${data.sections.map(sectionHtml).join("\n")}</main>
  <footer><span>${esc(m.footLeft || "Poneglyph · html-report dynamic")}</span><span>${esc(m.footRight || m.date)}</span></footer>
</div>
<script>
(function(){
  // theme toggle (persisted) — fallback: prefers-color-scheme handles no-JS
  var KEY="poneglyph-theme",root=document.documentElement,btn=document.getElementById("themeBtn");
  var saved=null;try{saved=localStorage.getItem(KEY)}catch(e){}
  if(saved)root.setAttribute("data-theme",saved);
  if(btn)btn.addEventListener("click",function(){
    var cur=root.getAttribute("data-theme")==="dark"?"light":"dark";
    root.setAttribute("data-theme",cur);try{localStorage.setItem(KEY,cur)}catch(e){}
  });
  // scrollspy
  var links={};document.querySelectorAll(".toc a[data-spy]").forEach(function(a){links[a.getAttribute("data-spy")]=a});
  if("IntersectionObserver" in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(en){
      var a=links[en.target.id];if(!a)return;
      if(en.isIntersecting){Object.values(links).forEach(function(l){l.classList.remove("active")});a.classList.add("active")}
    })},{rootMargin:"-20% 0px -70% 0px"});
    document.querySelectorAll("main .sec[id]").forEach(function(s){io.observe(s)});
  }
})();
${filterScript}
${copyScript}
</script>
</body>
</html>`;
}

// CLI entry: bun run render.ts < data.json > out.html
if (import.meta.main) {
  const input = await Bun.stdin.text();
  const data = JSON.parse(input) as ReportData;
  process.stdout.write(render(data));
}
