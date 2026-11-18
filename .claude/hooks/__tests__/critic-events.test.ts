import { describe, expect, it } from "bun:test";
import { bashWriteLines, criticReviews, lastMode, parseEvents, pendingAgents, reviewProblem } from "../lib/critic-events";

// Record shapes copied from real Claude Code 2.1.319-2.1.322 transcripts, content trimmed.
const J = (o: unknown) => JSON.stringify(o);
const spawn = (id: string, type = "critic", prompt = "MODE: plan") =>
  J({ type: "assistant", message: { content: [{ type: "tool_use", id, name: "Agent", input: { subagent_type: type, prompt } }] } });
const asyncLaunch = (id: string, agentId: string, model = "claude-opus-5-5") =>
  J({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content: [{ type: "text", text: "Async agent launched" }] }] }, toolUseResult: { isAsync: true, status: "async_launched", agentId, resolvedModel: model } });
const notification = (id: string, result: string, status = "completed") =>
  J({ type: "attachment", attachment: { type: "queued_command", commandMode: "task-notification", prompt: `<task-notification>\n<task-id>x</task-id>\n<tool-use-id>${id}</tool-use-id>\n<status>${status}</status>\n<summary>Agent finished</summary>\n<result>${result}</result>\n</task-notification>` } });
const handback = (id: string, agentId: string, report: string, model = "claude-opus-5-5") =>
  J({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content: [{ type: "text", text: `This agent's report was delivered to you as a message from "${agentId}"` }] }] }, toolUseResult: { status: "completed", agentId, agentType: "critic", handback: "send", handbackReport: { text: report }, resolvedModel: model } });
const peerMessage = (agentId: string, report: string) =>
  J({ type: "attachment", attachment: { type: "queued_command", commandMode: "prompt", prompt: `<agent-message from="${agentId}">\n[Subagent hand-back]\n${report}\n</agent-message>`, origin: { kind: "peer", from: agentId } } });
const say = (text: string) => J({ type: "assistant", message: { content: [{ type: "text", text }] } });
const tool = (id: string, name: string, input: object) => J({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input }] } });
const mode = (m: string) => J({ type: "permission-mode", permissionMode: m, sessionId: "s" });

const REPORT = "REVIEW-ID: plan-9a1598d\nVERDICT: REVISE\nPERSPECTIVES: ...\nH1 [major] [Design] x\n   Evidence: a\nH2 [minor] [Scope] y\n   Evidence: b\nQUESTIONS: none";
const ANSWER = "| H1 | ✅ aceptado | hecho |\n| H2 | ❌ en disputa | motivo |";

describe("parseEvents", () => {
  it("reads edits with line counts and skips sidechains and bad lines", () => {
    const ev = parseEvents([
      tool("e1", "Edit", { file_path: "/r/a.ts", old_string: "a\nb", new_string: "c" }),
      tool("e2", "Write", { file_path: "/r/b.ts", content: "1\n2\n3" }),
      J({ type: "assistant", isSidechain: true, message: { content: [{ type: "tool_use", id: "z", name: "Edit", input: { file_path: "/r/z.ts" } }] } }),
      "not json",
      "",
    ]);
    expect(ev.filter((e) => e.kind === "edit")).toEqual([
      { kind: "edit", idx: 1, path: "/r/a.ts", lines: 2 },
      { kind: "edit", idx: 2, path: "/r/b.ts", lines: 3 },
    ]);
  });

  it("reads a Windows file_path with forward slashes, so the note patterns match it", () => {
    const [ev] = parseEvents([tool("w1", "Write", { file_path: "C:\\Users\\x\\repo\\.claude\\plans\\p.md", content: "x" })]);
    expect(ev).toMatchObject({ kind: "edit", path: "C:/Users/x/repo/.claude/plans/p.md" });
  });

  it("records permission-mode changes", () => {
    expect(lastMode(parseEvents([mode("plan"), mode("bypassPermissions")]))).toBe("bypassPermissions");
    expect(lastMode(parseEvents([say("hola")]))).toBeNull();
  });

  it("records human prompts, idle or queued mid-turn, but not tool results or meta records", () => {
    const ev = parseEvents([
      J({ type: "user", message: { role: "user", content: "sigue" } }),
      J({ type: "attachment", attachment: { type: "queued_command", commandMode: "prompt", prompt: "y esto también", origin: { kind: "human" } } }),
      J({ type: "user", isMeta: true, message: { role: "user", content: "<system-reminder>x</system-reminder>" } }),
      J({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "x", content: "ok" }] } }),
    ]);
    expect(ev).toEqual([{ kind: "prompt", idx: 1, text: "sigue" }, { kind: "prompt", idx: 2, text: "y esto también", queued: true }]);
  });

  it("marks a tool call ok or failed from its result", () => {
    const ev = parseEvents([
      tool("p1", "mcp__workboard__progress", { update: {} }),
      J({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "p1", is_error: true, content: "denied" }] } }),
      tool("p2", "mcp__workboard__progress", { update: {} }),
      J({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "p2", content: "{}" }] } }),
      tool("p3", "mcp__workboard__progress", { update: {} }),
    ]);
    expect(ev.map((e) => (e.kind === "tool" ? e.ok : "-"))).toEqual([false, true, undefined]);
  });

  it("counts shell writes to project files as edits", () => {
    const ev = parseEvents([tool("b1", "Bash", { command: "sed -i '' 's/a/b/' src/x.ts" }), tool("b2", "Bash", { command: "git status" })]);
    expect(ev.filter((e) => e.kind === "edit")).toEqual([{ kind: "edit", idx: 1, path: "(bash)", lines: 5 }]);
  });

  it("ignores a task-notification for a background shell command", () => {
    const ev = parseEvents([notification("toolu_bash", "")]);
    expect(ev).toEqual([]);
  });
});

describe("criticReviews", () => {
  it("background spawn: the review is the task-notification result", () => {
    const ev = parseEvents([spawn("t1"), asyncLaunch("t1", "a1"), notification("t1", REPORT), say(ANSWER)]);
    const [r] = criticReviews(ev);
    expect(r).toMatchObject({ mode: "plan", verdict: "REVISE", findings: ["H1", "H2"], resolvedModel: "claude-opus-5-5", unanswered: [] });
    expect(r.tags).toEqual({ H1: { severity: "major", perspective: "design" }, H2: { severity: "minor", perspective: "scope" } });
    expect(reviewProblem(r, "plan")).toBeNull();
    expect(reviewProblem(r, "feature")).not.toBeNull();
    expect(pendingAgents(ev)).toEqual([]);
  });

  it("foreground hand-back (2.1.322): the review is handbackReport, counted once despite the peer copy", () => {
    const ev = parseEvents([spawn("t1"), handback("t1", "a1", REPORT), peerMessage("a1", REPORT), say(ANSWER)]);
    const reviews = criticReviews(ev);
    expect(reviews).toHaveLength(1);
    expect(reviewProblem(reviews[0], "plan")).toBeNull();
  });

  it("peer message alone still counts when the tool_result carried no report", () => {
    const launch = J({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: [{ type: "text", text: "delivered as a message" }] }] }, toolUseResult: { status: "completed", agentId: "a1", resolvedModel: "claude-opus-5-5" } });
    const ev = parseEvents([spawn("t1"), launch, peerMessage("a1", REPORT), say(ANSWER)]);
    expect(criticReviews(ev).map((r) => r.verdict)).toEqual(["REVISE"]);
  });

  it("a notification that lands while idle is a user record and still counts", () => {
    const idle = J({ type: "user", message: { role: "user", content: `<task-notification>\n<tool-use-id>t1</tool-use-id>\n<status>completed</status>\n<result>${REPORT}</result>\n</task-notification>` } });
    const ev = parseEvents([spawn("t1"), asyncLaunch("t1", "a1"), idle, say(ANSWER)]);
    expect(reviewProblem(criticReviews(ev)[0], "plan")).toBeNull();
    expect(pendingAgents(ev)).toEqual([]);
  });

  it("a pending background critic is not a review and shows as pending", () => {
    const ev = parseEvents([spawn("t1"), asyncLaunch("t1", "a1")]);
    expect(criticReviews(ev)).toEqual([]);
    expect(pendingAgents(ev)).toEqual(["t1"]);
  });

  it("a failed or killed critic is not a review", () => {
    const ev = parseEvents([spawn("t1"), asyncLaunch("t1", "a1"), notification("t1", REPORT, "killed")]);
    expect(criticReviews(ev)).toEqual([]);
    expect(pendingAgents(ev)).toEqual([]);
  });

  it("a partial answer without VERDICT is not a review", () => {
    const ev = parseEvents([spawn("t1"), asyncLaunch("t1", "a1"), notification("t1", "REVIEW-ID: plan-x\nH1 [major] [Design] x")]);
    expect(criticReviews(ev)).toEqual([]);
  });

  it("findings left unanswered make the review invalid", () => {
    const ev = parseEvents([spawn("t1"), asyncLaunch("t1", "a1"), notification("t1", REPORT), say("| H1 | ✅ aceptado | hecho |")]);
    const [r] = criticReviews(ev);
    expect(r.unanswered).toEqual(["H2"]);
    expect(reviewProblem(r, "plan")).not.toBeNull();
  });

  it("an answer written before the delivery does not count", () => {
    const ev = parseEvents([spawn("t1"), asyncLaunch("t1", "a1"), say(ANSWER), notification("t1", REPORT)]);
    expect(criticReviews(ev)[0].unanswered).toEqual(["H1", "H2"]);
  });

  it("PROCEED with no findings needs no answer table", () => {
    const ev = parseEvents([spawn("t1"), asyncLaunch("t1", "a1"), notification("t1", "REVIEW-ID: feature-abc\nVERDICT: PROCEED\nQUESTIONS: none")]);
    expect(reviewProblem(criticReviews(ev)[0], "feature")).toBeNull();
  });

  it("keeps each finding's tags: the first word of the perspective, the first line when restated, null when absent", () => {
    const report = "REVIEW-ID: feature-abc\nVERDICT: REVISE\nH1 [major] [Reuse and simplicity] x\nH2 [minor][Style/rules] y\nH3 [unclear z\nALTERNATIVE:\nH1 [minor] [design] restated";
    const [r] = criticReviews(parseEvents([spawn("t1"), asyncLaunch("t1", "a1"), notification("t1", report)]));
    expect(r.findings).toEqual(["H1", "H2", "H3"]);
    expect(r.tags).toEqual({ H1: { severity: "major", perspective: "reuse" }, H2: { severity: "minor", perspective: "style" }, H3: { severity: null, perspective: null } });
  });

  it("the wrong model invalidates the review", () => {
    const ev = parseEvents([spawn("t1"), asyncLaunch("t1", "a1", "claude-haiku-5-5"), notification("t1", REPORT), say(ANSWER)]);
    expect(reviewProblem(criticReviews(ev)[0], "plan")).not.toBeNull();
  });

  it("other agent types are not critic reviews", () => {
    const ev = parseEvents([spawn("t1", "Explore"), asyncLaunch("t1", "a1"), notification("t1", REPORT)]);
    expect(criticReviews(ev)).toEqual([]);
  });
});

describe("bashWriteLines", () => {
  const writes: Array<[string, number]> = [
    ["sed -i '' 's/a/b/' src/x.ts", 5],
    ["perl -pi -e 's/a/b/' x.ts", 5],
    ["cat > src/a.ts <<'EOF'\n1\n2\n3\n4\n5\n6\nEOF", 6],
    ["echo hi >> README.md", 5],
    ["cd /Users/x/repo && python3 - <<'EOF'\np='a.py'\nopen(p,'w').write(s)\nEOF", 5],
    ["bun $X/gen.ts > src/out.ts", 5],
    ["cd /private/tmp/x && ls; cd /Users/x/repo && sed -i '' 's/a/b/' a.ts", 5],
    ["printf x | tee docs/a.md", 5],
    ["python3 - <<'EOF'\np='a.ts'; s=open(p).read()\nopen(p,'w').write(s)\nEOF", 5],
    ["bun -e 'await Bun.write(\"a.json\", \"{}\")'", 5],
  ];
  for (const [cmd, lines] of writes) it(`counts: ${cmd.split("\n")[0]}`, () => expect(bashWriteLines(cmd)).toBe(lines));

  const reads = [
    "git diff --stat",
    "grep -n x a.ts 2>/dev/null | head",
    "ls > /dev/null 2>&1",
    "echo x > /private/tmp/claude-501/s/out.txt",
    "S=/private/tmp/claude-501/x/scratchpad; bun $S/replay.ts > $S/out.json",
    "cd /private/tmp/claude-501/x/scratchpad && sed -i '' 's/a/b/' a.html",
    "cd ~/.claude/projects/p/memory && python3 - <<'EOF'\nopen('MEMORY.md','w').write('x')\nEOF",
    "M=/Users/x/.claude/projects/p/memory/MEMORY.md; python3 - \"$M\" <<'EOF'\nopen(p,'w')\nEOF",
    "python3 - <<'EOF'\nimport json\nprint(1 > 0)\nEOF",
    "cat <<'EOF' | bun run x\na > b\nEOF",
    "sed -n 1,20p a.ts",
    "P=/private/tmp/x/scratchpad/a.py; python3 - \"$P\" <<'EOF'\nopen(p,'w')\nEOF\ncd /Users/x/repo; pytest $P",
    "cd ~/.claude/projects/p/ && python3 - <<'EOF'\nout=open('/private/tmp/x/o.html','w')\nEOF",
    "S=/private/tmp/x/scratchpad; P=$S/code; echo hi > $P/a.txt",
    "pnpm audit --json | node -e 'const a=1; [a].map((v) => v)'",
    "python3 -c \"import json; print(1>0)\"",
    "OUT=/private/tmp/x; git log > \"$OUT/log.txt\"",
  ];
  for (const cmd of reads) it(`ignores: ${cmd.split("\n")[0]}`, () => expect(bashWriteLines(cmd)).toBe(0));

  it("resolves a loop variable over plain names against the directory in force", () => {
    // A crew lead wrote its member missions in its scratchpad: the command of session d78b92db
    // at 13:12:41 as it ran, with the home path anonymised and each heredoc body cut to one line.
    // Before the fix this fixture counted 5 (the full command, 29); after it, the full command
    // read from the transcript with its cwd counts 0 as well.
    const lead = [
      "D=/private/tmp/claude-501/-Users-x-repo/d78b92db-4f16-4336-bf57-9f6f4772f18a/scratchpad; mkdir -p $D; cd $D",
      ...["reglas", "ia", "web", "captura", "datos"].flatMap((f) => [`cat > ${f}.md <<'EOF'`, "body", "EOF"]),
      "for f in ia web captura datos; do cat reglas.md >> $f.md; done; wc -l *.md",
    ].join("\n");
    expect(bashWriteLines(lead, "", "/Users/x/repo")).toBe(0);
    expect(bashWriteLines("cd /Users/x/repo; for f in a b; do echo x >> $f.ts; done")).toBe(5);
  });

  it("resolves relative writes against the session's directory", () => {
    // An orchestrator keeps its books from inside the plan folder (real session 17159044).
    const plan = "/Users/x/repo/.claude/plans/001-x";
    expect(bashWriteLines("echo x > tasks/reports/a.txt", "", plan)).toBe(0);
    expect(bashWriteLines("python3 - <<'EOF'\np='tasks/progress.md'\nopen(p,'w').write(s)\nEOF", "", plan)).toBe(0);
    expect(bashWriteLines("echo x > tasks/a.md", "", "/Users/x/repo")).toBe(5);
    // A Windows session's directory resolves with forward slashes, like the shell paths it joins.
    expect(bashWriteLines("echo x > tasks/a.txt", "", "C:\\Users\\x\\repo\\.claude\\plans\\001-x")).toBe(0);
    expect(bashWriteLines("sed -i '' 's/a/b/' tasks/progress.md", "", "C:\\Users\\x\\repo\\.claude\\plans\\001-x")).toBe(0);
    expect(bashWriteLines("python3 - <<'EOF'\np='tasks/progress.md'\nopen(p,'w').write(s)\nEOF", "", "C:\\Users\\x\\repo\\.claude\\plans\\001-x")).toBe(0);
    expect(bashWriteLines("sed -i '' 's/a/b/' ../notes.md", "", "C:\\Users\\x\\AppData\\Local\\Temp\\s")).toBe(0);
    expect(bashWriteLines("sed -i '' 's/a/b/' ../src/a.ts", "", "C:\\Users\\x\\repo\\src")).toBe(5);
    // A drive path named from a Windows plan directory is where the write goes, either slash.
    const winPlan = "C:\\Users\\x\\repo\\.claude\\plans\\001-x";
    expect(bashWriteLines("sed -i 's/a/b/' C:/Users/x/repo/src/a.ts", "", winPlan)).toBe(5);
    expect(bashWriteLines("python3 - <<'EOF'\nopen('C:/Users/x/repo/src/a.py','w')\nEOF", "", winPlan)).toBe(5);
    expect(bashWriteLines('cd "C:\\Users\\x\\repo\\src" && echo x > a.ts', "", winPlan)).toBe(5);
    expect(bashWriteLines('echo x > "C:\\Users\\x\\repo\\src\\a.ts"', "", winPlan)).toBe(5);
    expect(bashWriteLines("sed -i 's/a/b/' C:/Users/x/AppData/Local/Temp/s/n.md", "", winPlan)).toBe(0);
    expect(bashWriteLines("echo x > n.md", "", "C:\\Users\\x\\AppData\\Local\\Temp")).toBe(0);
    expect(bashWriteLines('P="C:\\Users\\x\\repo\\src\\a.ts"; echo x > $P', "", winPlan)).toBe(5);
    expect(bashWriteLines('P="C:\\Users\\x\\AppData\\Local\\Temp\\n.md"; echo x > $P', "", winPlan)).toBe(0);
    expect(bashWriteLines("python3 - <<'EOF'\nopen('C:\\\\Users\\\\x\\\\AppData\\\\Local\\\\Temp\\\\n.md','w')\nEOF", "", winPlan)).toBe(0);
    // A sed expression delimited by `:` is no drive path.
    expect(bashWriteLines("sed -i 's:/tmp/a:/tmp/b:' /tmp/n.md", "", "/Users/x/repo")).toBe(0);
    expect(bashWriteLines("echo x > /Users/x/repo/src/a.ts", "", plan)).toBe(5);
    expect(bashWriteLines("cd /Users/x/repo && sed -i '' 's/a/b/' a.ts", "", plan)).toBe(5);
    expect(bashWriteLines("python3 - <<'EOF'\nopen('/Users/x/repo/a.py','w')\nEOF", "", plan)).toBe(5);
    expect(bashWriteLines("sed -i '' 's/a/b/' ../../../src/app.ts", "", plan)).toBe(5);
    expect(bashWriteLines("sed -i '' 's/a/b/' $HOME/repo/src/a.ts", "/Users/x", plan)).toBe(5);
    expect(bashWriteLines("sed -i '' 's/a/b/' ${UNSET}/src/a.ts", "/Users/x", plan)).toBe(5);
    expect(bashWriteLines("sed -i '' 's/a/b/' $HOME/.claude/projects/p/memory/a.md", "/Users/x", plan)).toBe(0);
  });

  it("does not count an orchestrator's bookkeeping as an edit (shapes from session 17159044)", () => {
    const plan = "/Users/x/inmo/.claude/plans/001-x";
    // A `case` pattern's `)` closes no group: the `cd` before it still holds.
    expect(bashWriteLines(`cd ${plan} && id=x; case $id in *-*-*) sed -i '' "s/a b/c/" tasks/progress.md;; esac`, "", "/Users/x/inmo")).toBe(0);
    expect(bashWriteLines(`cd /Users/x/inmo/src && case $x in a|b) sed -i '' "s/a b/c/" app.ts;; esac`, "", "/Users/x/inmo")).toBe(5);
    // A path in the script's prose is not a file it writes.
    expect(bashWriteLines("python3 - <<'EOF'\np='tasks/progress.md'; s=open(p).read()\ns=s.replace('x', 'clave `GET /api/a/` frente a /api/core')\nopen(p,'w').write(s)\nEOF", "", plan)).toBe(0);
    // A `cd` inside `$( )` does not move the write.
    expect(bashWriteLines(`P=${plan}; cd $P && C=$(cd /Users/x/caseria && git log -1) && cat >> tasks/progress.md <<EOF\nx\nEOF`, "", "/Users/x/inmo")).toBe(0);
    // An earlier `bun test` is not the script that writes.
    expect(bashWriteLines(`cd /Users/x/caseria && bun test a.test.ts 2>&1 | tail -2; P=${plan}; cd $P && python3 - <<'EOF'\nopen('tasks/p.md','w')\nEOF`, "", plan)).toBe(0);
    // Each write resolves against the `cd` in force at its position, not the session's directory.
    expect(bashWriteLines(`cd /Users/x/caseria && git commit -q -m "w5"\nP=${plan}; cd $P && sed -i '' 's/a/b/' tasks/progress.md; echo "- W5" >> tasks/reports/h.md`, "", "/Users/x/inmo")).toBe(0);
    expect(bashWriteLines(`cd ${plan} && echo x >> tasks/h.md; cd /Users/x/caseria && echo y > src/a.ts`, "", plan)).toBe(5);
    expect(bashWriteLines(`cd ${plan} && echo x >> tasks/h.md; cd /Users/x/caseria && git status`, "", plan)).toBe(0);
    // A quote pair without `>` must not shift the pairing and blank the `cd` and the redirect.
    expect(bashWriteLines(`diff <(git status | grep -v '.claude/plans/') <(grep -v '.claude/plans/' $B) && echo OK\ncd ${plan} && ls; python3 - <<EOF\nopen('tasks/p.md','w')\nEOF\necho "- W10 closed" >> tasks/reports/h.md; grep -E '^x' tasks/p.md`, "", "/Users/x/inmo")).toBe(0);
    // A variable inside a sed expression is no path.
    expect(bashWriteLines(`cd ${plan} && C=$(git log -1) && sed -i '' "s/x/commit $C/" tasks/progress.md`, "", "/Users/x/inmo")).toBe(0);
    // Product code written the same way still counts (work-repo sessions edit through heredocs).
    expect(bashWriteLines("cd /Users/x/backend && python3 - <<'EOF'\np = 'apps/a/admin.py'\ns = open(p).read()\nopen(p, 'w').write(s)\nEOF", "", "/Users/x/backend")).toBe(5);
    expect(bashWriteLines(".venv/bin/python - <<'EOF'\npath = 'apps/a/b.py'\nopen(path, 'w').write('x')\nEOF", "", "/Users/x/backend")).toBe(5);
    expect(bashWriteLines("python3 - <<'EOF'\nopen('../../../src/a.py','w')\nEOF", "", plan)).toBe(5);
  });

  it("reads `>` inside escaped quotes and nested `$( )` as text (shapes from sessions de5c375c and afa8fb13)", () => {
    const repo = "/Users/x/caseria";
    expect(bashWriteLines(`grep -n "<td className=\\"min-w-0\\|x" a.tsx; curl -s u | python3 -c 'import sys
print(sum(1 for l in L if (l.get("p") or 0)>0))'`, "", repo)).toBe(0);
    expect(bashWriteLines(`F=/tmp/s/e.html\npython3 - "$F" <<'EOF'\nopen(sys.argv[1], "w").write(s)\nEOF\ngrep -c "pill ok\\">Pasa" $F`, "", repo)).toBe(0);
    expect(bashWriteLines(`DB=x.db; until [ "$(sqlite3 "$DB" "SELECT COUNT(*) FROM runs WHERE id > 13" 2>/dev/null)" = "1" ]; do sleep 10; done`, "", repo)).toBe(0);
    // A real redirect after them still counts.
    expect(bashWriteLines(`grep -c "a\\">b" f; echo x > src/a.ts`, "", repo)).toBe(5);
  });

  it("still counts product writes a script or heredoc makes beside note paths (critic H1-H4)", () => {
    const repo = "/Users/x/repo";
    const plan = `${repo}/.claude/plans/p`;
    // A redirect after the heredoc tag.
    expect(bashWriteLines("cat <<'EOF' > src/a.ts\nx\nEOF", "", repo)).toBe(5);
    // A script that reads a note but writes a relative repo file.
    expect(bashWriteLines("python3 - <<'EOF'\nd=json.load(open('/tmp/s/in.json'))\nopen('src/gen.py','w').write(x)\nEOF", "", repo)).toBe(5);
    // A `cd` inside `( … )` ends with the group.
    expect(bashWriteLines(`(cd ${plan} && echo x >> tasks/h.md); echo y > src/a.ts`, "", repo)).toBe(5);
    expect(bashWriteLines(`(cd ${plan} && echo x >> tasks/h.md)`, "", repo)).toBe(0);
    expect(bashWriteLines(`cd ${plan} && echo "- W5 1) done" >> tasks/h.md`, "", repo)).toBe(0);
    // The interpreter fed the heredoc is the script, not an earlier `bun test`.
    expect(bashWriteLines(`cd ${repo} && bun test; cd ${plan} && python3 <<'EOF'\nopen('tasks/p.md','w')\nEOF`, "", repo)).toBe(0);
    expect(bashWriteLines(`cd ${repo} && python3 -c "import json; print(1)"; cd ${plan} && python3 - <<'EOF'\nopen('tasks/p.md','w')\nEOF`, "", repo)).toBe(0);
  });
});
