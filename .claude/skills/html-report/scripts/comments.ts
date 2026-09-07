/**
 * comments.ts — markdown interpretation + copy-to-clipboard for the html-report
 * DYNAMIC mode. Lets a report author write **Markdown** (instead of hand-rolled
 * inline HTML) in `prose`/`comment` content, and makes fenced code blocks (and
 * comment blocks) copy-pasteable with one click.
 *
 * Self-contained: no dependencies. mdToHtml is a deliberately SMALL CommonMark
 * subset (bold/italic/code/links/lists/headings/paragraphs + fenced code).
 * Untrusted source is HTML-escaped first, link schemes are sanitized — the
 * output is inlined verbatim into a self-contained report, so it must be safe.
 */

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: string): string => esc(s).replace(/"/g, "&quot;");

/** Allow http(s)/mailto + relative/anchor only; reject javascript:, data:, … */
function safeUrl(u: string): string {
  const t = u.trim();
  if (/^(https?:|mailto:)/i.test(t)) return t;
  if (/^[#/.]/.test(t)) return t; // #anchor, /abs, ./rel, ../rel
  if (!/:/.test(t)) return t; // bare relative with no scheme
  return "#"; // anything carrying a scheme we don't allow
}

/** Inline formatting on an already-escaped string; code spans stay literal. */
function inline(escaped: string): string {
  // split on `code` spans — odd indices are literal code, never re-formatted
  return escaped
    .split(/(`[^`]+`)/g)
    .map((part, i) => {
      if (i % 2 === 1) return `<code>${part.slice(1, -1)}</code>`;
      return (
        part
          // bold: ** only. Underscore-bold is dropped on purpose — `__str__`,
          // `__init__` and other dunders are code, not emphasis.
          .replace(/\*\*(\S(?:[^*]*\S)?)\*\*/g, "<strong>$1</strong>")
          // italic: * with word-boundary flanking so `*args`, `**kwargs`, `a*b`
          // stay literal (only a fully-delimited `*word*` italicizes).
          .replace(/(^|[^*\w])\*([^*\s](?:[^*]*[^*\s])?)\*(?![*\w])/g, "$1<em>$2</em>")
          // NOTE: underscore emphasis (`_x_` / `__x__`) intentionally NOT
          // supported — snake_case and dunders must survive verbatim. Use ` ` ` ` `
          // for code identifiers and `**`/`*` for emphasis.
          .replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            (_m, text, url) => `<a href="${escAttr(safeUrl(url))}">${text}</a>`,
          )
      );
    })
    .join("");
}

interface CodeBlock {
  lang: string;
  code: string;
}

function renderCode(cb: CodeBlock): string {
  const body = `<pre class="code-pre"><code>${esc(cb.code)}</code></pre>`;
  return copyable(body, cb.code, cb.lang || "code");
}

function renderTextBlock(block: string): string {
  const lines = block.split("\n");
  const h = block.match(/^(#{1,3})\s+(.*)$/);
  if (h && lines.length === 1) {
    const lvl = h[1].length + 1; // # → h2, ## → h3, ### → h4 (h1 belongs to the report title)
    return `<h${lvl} class="cmt-h">${inline(esc(h[2]))}</h${lvl}>`;
  }
  if (lines.every((l) => /^[-*]\s+/.test(l))) {
    const items = lines.map((l) => `<li>${inline(esc(l.replace(/^[-*]\s+/, "")))}</li>`).join("");
    return `<ul>${items}</ul>`;
  }
  if (lines.every((l) => /^\d+\.\s+/.test(l))) {
    const items = lines.map((l) => `<li>${inline(esc(l.replace(/^\d+\.\s+/, "")))}</li>`).join("");
    return `<ol>${items}</ol>`;
  }
  return `<p>${lines.map((l) => inline(esc(l))).join("<br>")}</p>`;
}

/** Split a text run into blocks (by blank lines) and render each. */
function pushTextBlocks(out: string[], text: string): void {
  for (const block of text.split(/\n{2,}/)) {
    const t = block.trim();
    if (t) out.push(renderTextBlock(t));
  }
}

/**
 * Render a Markdown subset to safe, self-contained HTML. Fenced code blocks
 * become copy-pasteable `<pre>` panels.
 *
 * No placeholder/sentinel: we scan fences directly and alternate text/code
 * segments — robust against any whitespace reformatting.
 */
export function mdToHtml(src: string): string {
  const out: string[] = [];
  const fence = /```(\w*)\n([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(src)) !== null) {
    pushTextBlocks(out, src.slice(last, m.index));
    out.push(renderCode({ lang: m[1] || "", code: m[2].replace(/\n$/, "") }));
    last = fence.lastIndex;
  }
  pushTextBlocks(out, src.slice(last));
  return out.join("\n");
}

/**
 * Wrap rendered `body` with a copy-to-clipboard button. The raw `source` is
 * kept in a hidden `<pre>` — that text is what the button copies (so a reader
 * pastes the source, not the rendered HTML). No-JS fallback: body stays
 * visible/selectable; the button is an inert enhancement.
 */
export function copyable(body: string, source: string, label?: string): string {
  return (
    `<div class="cmt">` +
    `<div class="cmt-bar">${label ? `<span class="cmt-label">${esc(label)}</span>` : ""}` +
    `<button class="copy-btn" type="button" aria-label="Copiar al portapapeles">copiar</button></div>` +
    `<pre class="cmt-src" hidden aria-hidden="true">${esc(source)}</pre>` +
    `<div class="cmt-body">${body}</div>` +
    `</div>`
  );
}

/** Styles for the copy-block / button. Inlined into the report <style>. */
export const copyCss = `
.cmt{margin:.7rem 0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--surface)}
.cmt-bar{display:flex;align-items:center;justify-content:flex-end;gap:.6rem;padding:.3rem .5rem;background:var(--surface-2);border-bottom:1px solid var(--line)}
.cmt-label{margin-right:auto;font-family:var(--mono);font-size:var(--t-xs);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.copy-btn{font-family:var(--mono);font-size:var(--t-xs);letter-spacing:.06em;color:var(--ink-2);background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:.2rem .55rem;cursor:pointer}
.copy-btn:hover{color:var(--accent);border-color:var(--accent)}
.copy-btn.ok{color:var(--good);border-color:var(--good)}
.cmt-body{padding:.7rem .9rem}
.cmt-body .code-pre{margin:0;overflow-x:auto;font-family:var(--mono);font-size:var(--t-sm);line-height:1.5}
.cmt-body .code-pre code{background:none;border:none;padding:0}`;

/** Click handler for copy buttons. Inlined into the report <script>. */
export const copyScript = `
(function(){
  // copy-to-clipboard: clipboard API, with a textarea+execCommand fallback
  document.querySelectorAll(".copy-btn").forEach(function(b){
    b.addEventListener("click", function(){
      var box=b.closest(".cmt"), src=box?box.querySelector(".cmt-src"):null;
      var txt=src?src.textContent:"";
      function done(){var o=b.textContent;b.textContent="copiado";b.classList.add("ok");setTimeout(function(){b.textContent=o;b.classList.remove("ok")},1200)}
      function fallback(){try{var ta=document.createElement("textarea");ta.value=txt;ta.setAttribute("style","position:fixed;top:0;left:0;opacity:0");document.body.appendChild(ta);ta.focus();ta.select();document.execCommand("copy");document.body.removeChild(ta);done()}catch(e){}}
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done,fallback)}else{fallback()}
    });
  });
})();`;
