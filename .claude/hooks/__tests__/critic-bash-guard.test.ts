import { describe, expect, it } from "bun:test";
import { buildDenial, judgeCriticCommand, splitWords } from "../critic-bash-guard";

describe("critic-bash-guard: judgeCriticCommand", () => {
  const allowed = [
    "git diff",
    "git diff main...HEAD -- .claude/hooks",
    "git --no-pager diff --stat HEAD~3",
    "git -C /Users/x/repo log --oneline -n 20",
    'git log --format="%h %s" -n 5',
    "git show HEAD:CLAUDE.md",
    "git blame -L 10,40 .claude/hooks/turn-nudges.ts",
    "git --no-optional-locks status --short",
    "git -C /Users/x/repo --no-optional-locks status",
    "git merge-base main HEAD",
    "git rev-parse HEAD",
    "git grep -n learnedLog -- .claude/hooks",
    "git log --grep='feat(gate)' --oneline",
    "git log -G'foo$' -n 3",
    "git ls-files .claude/agents",
    "git ls-files -o --exclude-standard",
    "git diff --name-only --diff-filter=d HEAD",
    "git log -p -- .claude/hooks/turn-nudges.ts",
    "git log -c -n 3",
  ];
  for (const cmd of allowed) {
    it(`allows: ${cmd}`, () => expect(judgeCriticCommand(cmd)).toEqual({ allow: true }));
  }

  const denied: Array<[string, RegExp]> = [
    ["cat a.txt > b.txt", /shell syntax/],
    ["git diff > out.patch", /shell syntax/],
    ["git log | head", /shell syntax/],
    ["git status; rm -rf x", /shell syntax/],
    ["git status && touch x", /shell syntax/],
    ["git show $(echo HEAD)", /shell syntax/],
    ["git show `echo HEAD`", /shell syntax/],
    ["git diff --output=/tmp/x", /can write a file/],
    ["git diff --output /tmp/x", /can write a file/],
    ["git diff --ext-diff", /can write a file/],
    ["git show --textconv HEAD:a.png", /can write a file/],
    ["git log --open-files-in-pager", /can write a file/],
    ["git status --short", /index lock/],
    ["git -p log", /global option/],
    ["git --paginate log", /global option/],
    ["git -c core.pager=touch status", /global option/],
    ["git --git-dir=/tmp/x log", /global option/],
    ["git --exec-path=/tmp log", /global option/],
    ["git commit -m x", /not a read-only subcommand/],
    ["git checkout main", /not a read-only subcommand/],
    ["git stash", /not a read-only subcommand/],
    ["git config alias.x '!touch y'", /not a read-only subcommand/],
    ["bun test foo.test.ts", /is not git/],
    ["GIT_PAGER=touch git log", /is not git/],
    ["ls -la", /is not git/],
    ['git log "unclosed', /could not be parsed/],
    ["", /could not be parsed/],
    ["git", /not a read-only subcommand/],
  ];
  for (const [cmd, why] of denied) {
    it(`denies: ${cmd || "(empty)"}`, () => {
      const v = judgeCriticCommand(cmd);
      expect(v.allow).toBe(false);
      if (!v.allow) expect(v.reason).toMatch(why);
    });
  }
});

describe("critic-bash-guard: splitWords", () => {
  it("keeps quoted spaces", () => expect(splitWords('git log --format="%h %s"')).toEqual(["git", "log", "--format=%h %s"]));
  it("returns null on an unclosed quote", () => expect(splitWords("git log 'x")).toBeNull());
});

describe("critic-bash-guard: buildDenial", () => {
  it("emits a PreToolUse deny", () => {
    const out = JSON.parse(buildDenial("nope"));
    expect(out.hookSpecificOutput).toEqual({ hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "nope" });
  });
});

describe("critic-bash-guard: stdin contract", () => {
  const run = async (stdin: string) => {
    const p = Bun.spawn(["bun", `${import.meta.dir}/../critic-bash-guard.ts`], { stdin: new Blob([stdin]), stdout: "pipe" });
    const out = await new Response(p.stdout).text();
    await p.exited;
    return out.trim();
  };
  it("is silent for an allowed command", async () => {
    expect(await run(JSON.stringify({ tool_name: "Bash", tool_input: { command: "git rev-parse HEAD" } }))).toBe("");
  });
  it("denies a write", async () => {
    const out = JSON.parse(await run(JSON.stringify({ tool_name: "Bash", tool_input: { command: "git diff --output=x" } })));
    expect(out.hookSpecificOutput.permissionDecision).toBe("deny");
  });
  it("fails closed on a broken payload", async () => {
    const out = JSON.parse(await run("not json"));
    expect(out.hookSpecificOutput.permissionDecision).toBe("deny");
  });
});

describe("critic-bash-guard: git grep and quotes", () => {
  it("denies grep's pager options in every spelling and syntax hidden in double quotes", () => {
    for (const c of ["git grep -Ovim x", "git grep -O x", "git grep --open-files-in-pager=vim x", 'git log --grep="$(id)"', "git log --grep='a' ; id"]) {
      expect(judgeCriticCommand(c).allow).toBe(false);
    }
  });
});
