import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { alreadyNoted, buildNote, commandPaths, findDesignFiles, isUiFile, noteOnce } from "../design-file-hint";

// Plan 041 US3. Each test builds its own temp project with the named design files.
function project(files: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "design-file-hint-"));
  for (const f of files) {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), "# design\n");
  }
  return dir;
}

const HOOK = resolve(import.meta.dir, "../design-file-hint.ts");
const logOf = (dir: string) => join(dir, ".claude", "learned", "design-file-hints.log");
const logLines = (dir: string) => readFileSync(logOf(dir), "utf8").split("\n").filter(Boolean);
const IMPERATIVE = /^(Read|Ask|You must|Do not|Never)\b/m;

// The hook reads CLAUDE_PROJECT_DIR; strip the runner's own value so payload cwd decides.
function run(stdin: string, projectDir?: string): { code: number; out: string } {
  const { CLAUDE_PROJECT_DIR: _drop, ...env } = process.env;
  const proc = Bun.spawnSync([process.execPath, HOOK], {
    stdin: Buffer.from(stdin),
    env: projectDir ? { ...env, CLAUDE_PROJECT_DIR: projectDir } : env,
  });
  return { code: proc.exitCode, out: proc.stdout.toString().trim() };
}

describe("design-file-hint — pure parts", () => {
  it("T3.1 recognises UI files by extension, case-insensitive", () => {
    for (const p of ["src/App.tsx", "a/B.VUE", "styles.scss", "index.html", "x.svelte", "y.jsx", "z.css"]) {
      expect(isUiFile(p)).toBe(true);
    }
    for (const p of ["hook.ts", "README.md", "data.json", "Makefile"]) {
      expect(isUiFile(p)).toBe(false);
    }
  });

  it("T3.2 lists design files in lookup order, not creation order", () => {
    expect(findDesignFiles(project(["DESIGN.md", "docs/DESIGN_SYSTEM.md"]))).toEqual(["docs/DESIGN_SYSTEM.md", "DESIGN.md"]);
    expect(findDesignFiles(project([]))).toEqual([]);
  });

  it("T3.3 builds factual notes for found and none", () => {
    const found = buildNote(["docs/DESIGN_SYSTEM.md", "DESIGN.md"]);
    expect(found).toMatch(/docs\/DESIGN_SYSTEM\.md[^.]*in use/);
    expect(found).toContain("DESIGN.md");
    const none = buildNote([]);
    for (const p of ["docs/DESIGN_SYSTEM.md", "DESIGN_SYSTEM.md", "DESIGN.md", "references/design-file.md", "**Decide:**"]) {
      expect(none).toContain(p);
    }
    expect(found).not.toMatch(IMPERATIVE);
    expect(none).not.toMatch(IMPERATIVE);
  });

  it("T3.4 matches the whole session field, not a prefix", () => {
    const log = "2026-10-02T10:00:00Z s-1 none -\n";
    expect(alreadyNoted(log, "s-1")).toBe(true);
    expect(alreadyNoted(log, "s-10")).toBe(false);
    expect(alreadyNoted("", "s-1")).toBe(false);
  });

  it("T3.9 the host-neutral core notes once across several paths", () => {
    const dir = project([]);
    expect(noteOnce({ cwd: dir, session: "m-1", paths: ["src/util.ts"] })).toBeNull();
    expect(existsSync(logOf(dir))).toBe(false);
    expect(noteOnce({ cwd: dir, session: "m-1", paths: ["src/util.ts", "web/Button.vue"] })).toContain("DESIGN_SYSTEM.md");
    expect(logLines(dir)).toHaveLength(1);
    expect(logLines(dir)[0]).toMatch(/^\S+ m-1 none -$/);
    expect(noteOnce({ cwd: dir, session: "m-1", paths: ["web/Button.vue"] })).toBeNull();
    expect(logLines(dir)).toHaveLength(1);
  });

  // 041 review round 1: 2 of 5 live runs edited UI files with `sed -i` / a python heredoc.
  it("T3.10 extracts UI-file paths from a shell command", () => {
    expect(commandPaths("sed -i '' 's/a/b/' index.html")).toEqual(["index.html"]);
    expect(commandPaths(`python3 - <<'EOF'\nopen("src/styles.css").read()\nEOF`)).toEqual(["src/styles.css"]);
    expect(commandPaths("cat web/App.TSX docs/notes.md > out.txt")).toEqual(["web/App.TSX"]);
    expect(commandPaths("cat notes.md && ls src")).toEqual([]);
    expect(commandPaths("cat theme.cssx data.json")).toEqual([]);
    // Bare extensions in prose (a doc edit listing `.html .css`) are not files.
    expect(commandPaths("python3 - <<EOF\nrow = 'UI file (`.html .css .scss .tsx`)'\nEOF")).toEqual([]);
    // A URL is not a project file; a glob is kept, because `sed -i … src/*.css` edits real files.
    expect(commandPaths("curl -s https://cdn.example.com/a.css -o vendor.js")).toEqual([]);
    expect(commandPaths("sed -i '' 's/a/b/' src/*.css")).toEqual(["src/*.css"]);
  });

  // Known limits of the token heuristic, asserted so a change to them is deliberate.
  it("T3.12 documents the tokenizer's known misses", () => {
    expect(commandPaths('cat "my dir/a.css"')).toEqual(["dir/a.css"]); // spaces split the path; still a UI hit
    expect(commandPaths("sed -i s/a/b/ [a.css]")).toEqual([]); // brackets are not separators
  });
});

describe("design-file-hint — hook process", () => {
  it("T3.5 notes the first UI edit, stays silent on the repeat and on non-UI", () => {
    const dir = project([]);
    const edit = (session: string, tool: string, file: string) =>
      JSON.stringify({ session_id: session, cwd: dir, tool_name: tool, tool_input: { file_path: join(dir, file) } });

    const first = run(edit("s-1", "Edit", "index.html"));
    expect(first.code).toBe(0);
    const out = JSON.parse(first.out);
    expect(out.hookSpecificOutput.hookEventName).toBe("PreToolUse");
    expect(out.hookSpecificOutput.additionalContext).toContain("DESIGN_SYSTEM.md");
    expect(out.hookSpecificOutput).not.toHaveProperty("permissionDecision");
    expect(logLines(dir)).toHaveLength(1);
    expect(logLines(dir)[0]).toMatch(/^\S+ s-1 none -$/);

    expect(run(edit("s-1", "Edit", "index.html"))).toEqual({ code: 0, out: "" });
    expect(run(edit("s-2", "Write", "notes.md"))).toEqual({ code: 0, out: "" });
    expect(logLines(dir)).toHaveLength(1);
  });

  it("T3.6 ignores non-edit tools and malformed payloads", () => {
    const dir = project([]);
    const read = JSON.stringify({ session_id: "s-1", cwd: dir, tool_name: "Read", tool_input: { file_path: join(dir, "index.html") } });
    expect(run(read)).toEqual({ code: 0, out: "" });
    expect(run("{broken")).toEqual({ code: 0, out: "" });
    expect(existsSync(logOf(dir))).toBe(false);
  });

  it("T3.11 notes the first Bash contact with a UI file, once per session", () => {
    const dir = project([]);
    const bash = (session: string, command: string) =>
      JSON.stringify({ session_id: session, cwd: dir, tool_name: "Bash", tool_input: { command } });

    expect(run(bash("b-1", "cat notes.md && git status"))).toEqual({ code: 0, out: "" });
    expect(existsSync(logOf(dir))).toBe(false);
    const first = run(bash("b-1", "sed -i '' 's/#fff/#fafafa/' styles.css"));
    expect(first.code).toBe(0);
    expect(JSON.parse(first.out).hookSpecificOutput.additionalContext).toContain("DESIGN_SYSTEM.md");
    expect(run(bash("b-1", "sed -i '' 's/a/b/' index.html"))).toEqual({ code: 0, out: "" });
    expect(run(JSON.stringify({ session_id: "b-2", cwd: dir, tool_name: "Bash", tool_input: { command: 42 } }))).toEqual({ code: 0, out: "" });
    expect(logLines(dir)).toHaveLength(1);
    expect(logLines(dir)[0]).toMatch(/^\S+ b-1 none -$/);
  });

  it("T3.13 looks up and marks the project root, not the shell's cd target", () => {
    const root = project(["docs/DESIGN_SYSTEM.md"]);
    mkdirSync(join(root, "web"), { recursive: true });
    const payload = (session: string) =>
      JSON.stringify({ session_id: session, cwd: join(root, "web"), tool_name: "Bash", tool_input: { command: "cat a.css" } });

    const res = run(payload("r-1"), root);
    expect(JSON.parse(res.out).hookSpecificOutput.additionalContext).toContain("docs/DESIGN_SYSTEM.md is the one in use");
    expect(logLines(root)[0]).toMatch(/ r-1 found docs\/DESIGN_SYSTEM\.md$/);
    expect(existsSync(logOf(join(root, "web")))).toBe(false);
    expect(run(payload("r-1"), root)).toEqual({ code: 0, out: "" });
  });

  it("T3.7 names the design file it found", () => {
    const dir = project(["docs/DESIGN_SYSTEM.md"]);
    const payload = JSON.stringify({ session_id: "s-7", cwd: dir, tool_name: "MultiEdit", tool_input: { file_path: join(dir, "src/App.tsx") } });
    const res = run(payload);
    expect(res.code).toBe(0);
    expect(JSON.parse(res.out).hookSpecificOutput.additionalContext).toContain("docs/DESIGN_SYSTEM.md");
    expect(logLines(dir)[0]).toMatch(/ found docs\/DESIGN_SYSTEM\.md$/);
  });

  it("T3.8 still returns the note when the log cannot be written", () => {
    const dir = project([]);
    mkdirSync(join(dir, ".claude"), { recursive: true });
    writeFileSync(join(dir, ".claude", "learned"), "not a directory");
    const payload = JSON.stringify({ session_id: "s-9", cwd: dir, tool_name: "Edit", tool_input: { file_path: join(dir, "index.html") } });
    const res = run(payload);
    expect(res.code).toBe(0);
    expect(res.out).toContain("DESIGN_SYSTEM.md");
    expect(JSON.parse(res.out).hookSpecificOutput.additionalContext).toContain("DESIGN_SYSTEM.md");
  });
});
