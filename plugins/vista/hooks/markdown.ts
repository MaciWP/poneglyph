// Cuts a reply's markdown into the blocks vista draws itself (GFM tables, `> [!NOTE]` style
// callouts and task lists) and the text between them, which Claude Code keeps drawing. Code
// fences are never looked into, and anything incomplete or ambiguous stays text.

export type CalloutKind = "note" | "tip" | "important" | "warning" | "caution";
export type Task = { done: boolean; text: string };
export type Block =
  | { kind: "text"; text: string }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "callout"; type: CalloutKind; text: string }
  | { kind: "tasks"; items: Task[] };

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const DELIMITER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const CALLOUT = /^ {0,3}>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i;
const TASK = /^[-*+] \[( |x|X)\] (.+)$/;

// A row's cells: split on pipes not escaped, outer pipes dropped.
export function cells(line: string): string[] {
  const out: string[] = [];
  let cell = "";
  const body = line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "\\" && body[i + 1] === "|") {
      cell += "|";
      i++;
    } else if (c === "|") {
      out.push(cell.trim());
      cell = "";
    } else cell += c;
  }
  out.push(cell.trim());
  return out;
}

// Inline markers a plain Text cannot draw: bold, italics and code spans lose their marks.
export const plain = (s: string) =>
  s
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/g, "$1")
    .replace(/`([^`]+)`/g, "$1");

export function parse(md: string): Block[] {
  const lines = md.split("\n");
  const blocks: Block[] = [];
  let text: string[] = [];
  const flush = () => {
    const t = text.join("\n").replace(/^\n+|\n+$/g, "");
    if (t) blocks.push({ kind: "text", text: t });
    text = [];
  };
  let fence: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const open = FENCE.exec(line)?.[1];
    if (fence) {
      text.push(line);
      if (open && open[0] === fence[0] && open.length >= fence.length && !line.trim().slice(open.length)) fence = undefined;
      continue;
    }
    if (open) {
      fence = open;
      text.push(line);
      continue;
    }
    const head = line.includes("|") ? cells(line) : [];
    const next = lines[i + 1] ?? "";
    if (head.length >= 2 && DELIMITER.test(next) && cells(next).length === head.length) {
      const rows: string[][] = [];
      let j = i + 2;
      for (; j < lines.length && (lines[j] ?? "").includes("|") && (lines[j] ?? "").trim(); j++) {
        const row = cells(lines[j] ?? "");
        rows.push(head.map((_, k) => plain(row[k] ?? "")));
      }
      if (rows.length) {
        flush();
        blocks.push({ kind: "table", head: head.map(plain), rows });
        i = j - 1;
        continue;
      }
    }
    const callout = CALLOUT.exec(line)?.[1];
    if (callout) {
      const body: string[] = [];
      let j = i + 1;
      for (; j < lines.length && /^ {0,3}>/.test(lines[j] ?? ""); j++) body.push((lines[j] ?? "").replace(/^ {0,3}> ?/, ""));
      if (body.some((l) => l.trim())) {
        flush();
        blocks.push({ kind: "callout", type: callout.toLowerCase() as CalloutKind, text: body.join("\n").trim() });
        i = j - 1;
        continue;
      }
    }
    if (TASK.test(line)) {
      const items: Task[] = [];
      let j = i;
      for (; j < lines.length; j++) {
        const m = TASK.exec(lines[j] ?? "");
        if (!m) break;
        items.push({ done: m[1] !== " ", text: plain(m[2] ?? "") });
      }
      // A nested line under the list makes it more than a flat checklist: leave it as text.
      if (!/^\s+\S/.test(lines[j] ?? "")) {
        flush();
        blocks.push({ kind: "tasks", items });
        i = j - 1;
        continue;
      }
      // The whole list stays text: its items and everything nested under them.
      while (j < lines.length && /^(\s+\S|[-*+] )/.test(lines[j] ?? "")) j++;
      text.push(...lines.slice(i, j));
      i = j - 1;
      continue;
    }
    text.push(line);
  }
  flush();
  return blocks;
}

// Whether vista has anything to draw in this reply; false leaves it to Claude Code untouched.
export const hasBlocks = (blocks: Block[]) => blocks.some((b) => b.kind !== "text");
