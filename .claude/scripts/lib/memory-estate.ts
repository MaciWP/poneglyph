/**
 * Lint for the auto-memory estate (`~/.claude/projects/<slug>/memory/`).
 *
 * The estate is the one Poneglyph layer with no grader, and it drifted: two files asserted a
 * sync root that no longer existed, a description contradicted its own body, and the index had
 * grown from hooks into a second copy of the facts. This checks the mechanical invariants only
 * — it can prove that a link resolves, never that a sentence is still true.
 *
 * Severity follows how certain the check is:
 *   error — a structural fact. A reader lands nowhere, or a hook carries a token (date, hash,
 *           PR number, absolute path) whose whole purpose is to name a moment that passes.
 *   warn  — a judgement call. Status words and legacy frontmatter keys are reported, never
 *           enforced: "Handling closed connections" is a subject, not a stale status, and no
 *           consumer has been shown to depend on `node_type` either way.
 */
import { frontmatter } from "./skill-metadata";

export interface EstateFile {
  /** File name including the `.md` extension. */
  name: string;
  text: string;
}

export interface Finding {
  level: "error" | "warn";
  file: string;
  message: string;
}

export interface EstateReport {
  findings: Finding[];
  /** Bytes of the index, which is the only part loaded into every session. */
  indexBytes: number;
  entries: number;
}

const TYPES = ["user", "feedback", "project", "reference"] as const;
const KNOWN_METADATA = new Set(["type", "modified"]);

/**
 * Tokens that exist to name a moment. These are shapes, not meanings, so they are errors.
 *
 * Two near-misses cost a false error each before they were excluded:
 * - a URL (`https://…`) ends in `s:/`, the drive-letter shape. The lookbehind demands a
 *   non-letter before the drive letter. A `reference` memory exists to carry links, so this
 *   one would have made the contract unusable for its own type.
 * - a word spelled only from a-f (`effaced`) is the hash shape. Requiring a digit excludes it.
 */
export const VOLATILE_SHAPE =
  /\bPR #\d|(?<![A-Za-z])[A-Za-z]:[\\/]|(?:^|\s)\/\w[\w.-]*\/\w|\b(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b|\d{4}-\d{2}-\d{2}/i;

/**
 * Words that usually report a state that has since moved on — but that also appear as ordinary
 * subjects. Reported, never enforced; the heuristic is not good enough to block on.
 */
export const VOLATILE_STATUS =
  /\b(?:merged|closed|blocked|uncommitted|pending|still\s+(?:open|carries|carry)|private\s+until|open\s+for\s+merge)\b/i;

const INDEX_LINK = /^-\s*\[[^\]]+\]\(([^)]+)\)/;
/** Captured loosely on purpose: a malformed target must be reported, not silently skipped. */
const WIKILINK = /\[\[([^\]\n]+)\]\]/g;
const SLUG = /^[a-z0-9-]+$/;

/**
 * Prose about links is not a link. Claude Code's own import parser skips code spans and fenced
 * blocks for the same reason; without this, writing `[[link]]` as an example reports a dangling
 * target that does not exist. Both fence styles count.
 */
function withoutCode(text: string): string {
  return text
    .replace(/^(?:```|~~~)[\s\S]*?^(?:```|~~~)/gm, "")
    .replace(/`[^`\n]*`/g, "");
}

/** Pure: every input is supplied, so the caller owns all file access. */
export function lintEstate(index: string, files: EstateFile[]): EstateReport {
  const findings: Finding[] = [];
  const add = (level: Finding["level"], file: string, message: string) => findings.push({ level, file, message });
  const names = new Set(files.map((f) => f.name));
  const stems = new Set(files.map((f) => f.name.replace(/\.md$/, "")));

  const linked = new Map<string, number>();
  const indexLines = index.split(/\r?\n/).filter((l) => l.trim().length > 0);
  for (const line of indexLines) {
    const target = INDEX_LINK.exec(line)?.[1];
    if (!target) {
      add("error", "MEMORY.md", `line is not an index entry: ${line.slice(0, 60)}`);
      continue;
    }
    // The target must be the file name itself — `[alpha](alpha)` resolved by accident before.
    if (!names.has(target)) {
      add("error", "MEMORY.md", `entry points at a missing file: ${target}`);
    }
    linked.set(target, (linked.get(target) ?? 0) + 1);
    if (VOLATILE_SHAPE.test(line)) add("error", "MEMORY.md", `index entry carries a token that names a moment: ${line.slice(0, 80)}`);
    else if (VOLATILE_STATUS.test(line)) add("warn", "MEMORY.md", `index entry may be asserting a status: ${line.slice(0, 80)}`);
  }
  for (const [target, count] of linked) {
    if (count > 1) add("error", "MEMORY.md", `${count} entries point at ${target}; one fact, one entry`);
  }

  for (const file of files) {
    const stem = file.name.replace(/\.md$/, "");
    if (!linked.has(file.name)) add("error", file.name, "file has no entry in MEMORY.md");

    let fields: Record<string, unknown>;
    try {
      fields = frontmatter(file.text).fields;
    } catch (e) {
      add("error", file.name, `frontmatter unreadable: ${(e as Error).message}`);
      continue;
    }

    if (fields.name !== stem) add("error", file.name, `name "${String(fields.name)}" does not match the file name`);

    const description = fields.description;
    if (typeof description !== "string" || description.trim().length === 0) {
      add("error", file.name, "description is missing or empty");
    } else if (VOLATILE_SHAPE.test(description)) {
      add("error", file.name, "description carries a token that names a moment");
    } else if (VOLATILE_STATUS.test(description)) {
      add("warn", file.name, "description may be asserting a status");
    }

    const metadata = fields.metadata;
    if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
      add("error", file.name, "metadata is missing or not a mapping");
    } else {
      const entries = metadata as Record<string, unknown>;
      if (!TYPES.includes(entries.type as (typeof TYPES)[number])) {
        add("error", file.name, `type "${String(entries.type)}" is not one of ${TYPES.join(", ")}`);
      }
      for (const key of Object.keys(entries)) {
        if (!KNOWN_METADATA.has(key)) add("warn", file.name, `unknown metadata key "${key}"`);
      }
    }

    for (const [, target] of withoutCode(file.text).matchAll(WIKILINK)) {
      if (!SLUG.test(target)) add("error", file.name, `[[${target}]] is not a valid memory slug`);
      else if (!stems.has(target)) add("error", file.name, `[[${target}]] resolves to no file`);
    }
  }

  return { findings, indexBytes: Buffer.byteLength(index, "utf8"), entries: indexLines.length };
}

/** Renders the report as a doctor row body. The caller owns the row name. */
export function summarizeEstate(report: EstateReport): { status: "🟢" | "🟡" | "🔴"; detail: string } {
  const errors = report.findings.filter((f) => f.level === "error");
  const warns = report.findings.filter((f) => f.level === "warn");
  const size = `index ${report.indexBytes} B, ${report.entries} entries`;
  if (errors.length) {
    const shown = errors.slice(0, 3).map((f) => `${f.file}: ${f.message}`).join("; ");
    return { status: "🔴", detail: `${errors.length} error(s) — ${shown}${errors.length > 3 ? "; …" : ""} (${size})` };
  }
  if (warns.length) {
    const keys = [...new Set(warns.map((f) => f.message))].slice(0, 3).join("; ");
    return { status: "🟡", detail: `${warns.length} warning(s) — ${keys} (${size})` };
  }
  return { status: "🟢", detail: `clean — ${size}` };
}
