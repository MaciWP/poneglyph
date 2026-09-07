/**
 * components.ts — html-report DYNAMIC mode (feature 010, US4).
 * Live-filterable table (search box + per-row data-text) with a static fallback:
 * without JS every row stays in the markup and visible. Wired into render.ts in US6.
 */
import type { Table } from "./contract.ts";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Filterable table. Each <tr> carries data-text (lowercased row text) for the filter JS. */
export function tableFilterable(t: Table, id = "tbl"): string {
  const head = t.columns
    .map((c) => `<th${c.numeric ? ' class="num"' : ""}>${esc(c.label)}</th>`)
    .join("");
  const rows = t.rows
    .map((r) => {
      const text = t.columns.map((c) => (r.cells[c.key] ?? "")).join(" ").replace(/<[^>]+>/g, "").toLowerCase();
      const sev = r.severity ? ` class="sev-${r.severity}"` : "";
      const cells = t.columns
        .map((c) => `<td${c.numeric ? ' class="num"' : ""}>${r.cells[c.key] ?? ""}</td>`)
        .join("");
      return `<tr${sev} data-text="${esc(text)}">${cells}</tr>`;
    })
    .join("");
  const search = t.filterable
    ? `<input class="tbl-search" type="search" placeholder="filtrar…" aria-label="Filtrar tabla" data-for="${esc(id)}">`
    : "";
  return `${t.title ? `<h3 class="blk">${esc(t.title)}</h3>` : ""}${search}<div class="tbl-wrap"><table class="tbl" id="${esc(id)}"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** JS that wires every .tbl-search to its table. Inert without JS (rows stay visible). */
export const filterScript = `
(function(){
  document.querySelectorAll(".tbl-search").forEach(function(inp){
    var tbl=document.getElementById(inp.getAttribute("data-for"));if(!tbl)return;
    inp.addEventListener("input",function(){
      var q=inp.value.trim().toLowerCase();
      tbl.querySelectorAll("tbody tr").forEach(function(tr){
        tr.style.display=(!q||(tr.getAttribute("data-text")||"").indexOf(q)>=0)?"":"none";
      });
    });
  });
})();
`;

export const filterCss = `
.tbl-search{font-family:var(--mono);font-size:var(--t-xs);color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:.35rem .7rem;margin:.4rem 0;width:min(280px,100%)}
.tbl-search:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
`;
