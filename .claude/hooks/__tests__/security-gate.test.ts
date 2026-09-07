import { afterAll, describe, test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  lineHasSecret,
  hasTextExtension,
  isOrchestrationPath,
  isApiSpecDocument,
  extractTurnFromTranscript,
  buildGitDisciplineWarning,
  shouldSkipStopHook,
  readTranscriptTail,
  GIT_MUTATION_RE,
  splitStatements,
  resolveInlineVars,
  resolveMutationLocation,
} from "../security-gate";

// Fake values built at runtime so no literal secret lives in this file.
const LONG = "x".repeat(20);

describe("hasTextExtension", () => {
  test("accepts scannable text extensions (where real secrets live)", () => {
    for (const f of ["a.ts", "a.js", "a.json", "a.env", "a.yaml", "a.yml"]) {
      expect(hasTextExtension(f)).toBe(true);
    }
  });
  test("does NOT scan .md — docs/examples/reports carry illustrative secrets, not real ones", () => {
    expect(hasTextExtension("README.md")).toBe(false);
    expect(hasTextExtension(".claude/skills/django-architecture/references/service-patterns.md")).toBe(false);
    expect(hasTextExtension("reports/review-pr-body.md")).toBe(false);
    expect(hasTextExtension("README.MD")).toBe(false); // case-insensitive too
  });
  test("rejects binary / non-text extensions", () => {
    for (const f of ["a.png", "a.exe", "a.lock", "a.zip"]) {
      expect(hasTextExtension(f)).toBe(false);
    }
  });
  test("rejects files with no extension", () => {
    expect(hasTextExtension("Makefile")).toBe(false);
    expect(hasTextExtension("LICENSE")).toBe(false);
  });
  test("is case-insensitive on the extension", () => {
    expect(hasTextExtension("config.JSON")).toBe(true);
    expect(hasTextExtension("App.TS")).toBe(true);
  });
});

describe("SECRET_PATTERN — uppercase KEY=value", () => {
  test("flags API_KEY with a 16+ char value", () => {
    expect(lineHasSecret(`API_KEY = "${LONG}"`)).toBe(true);
  });
  test("flags TOKEN with a colon separator", () => {
    expect(lineHasSecret(`TOKEN: "${LONG}"`)).toBe(true);
  });
  test("does NOT flag a short value", () => {
    expect(lineHasSecret("TOKEN=abc")).toBe(false);
  });
});

describe("SECRET_PATTERN_CI — lowercase credentials", () => {
  test("flags password with an 8+ char value", () => {
    expect(lineHasSecret(`password=${"y".repeat(12)}`)).toBe(true);
  });
  test("flags access_token", () => {
    expect(lineHasSecret(`access_token = ${"z".repeat(10)}`)).toBe(true);
  });
  test("does NOT flag a short password", () => {
    expect(lineHasSecret("password = short")).toBe(false);
  });
});

// Measured FP class (a frontend repo's generated types.gen.ts, 2026-08 and prior): SECRET_PATTERN_CI's
// `.{8,}` treats `password: string;` as a credential because ` string;` is ≥8 chars.
// Same shape appears in hand-written interfaces, Zod schemas, and Django field defs —
// not only generated clients. Fix filters type/schema RHS; values stay flagged.
describe("type/schema annotations are NOT secrets (types.gen.ts FP class)", () => {
  test("TS property: password: string;", () => {
    expect(lineHasSecret("    password: string;")).toBe(false);
  });
  test("TS property: old_password: string; (OpenAPI client shape)", () => {
    expect(lineHasSecret("    old_password: string;")).toBe(false);
  });
  test("TS union: password: string | null;", () => {
    expect(lineHasSecret("    password: string | null;")).toBe(false);
  });
  test("named type: access_token: AccessToken;", () => {
    expect(lineHasSecret("    access_token: AccessToken;")).toBe(false);
  });
  test("Zod builder: password: z.string().min(8),", () => {
    expect(lineHasSecret("    password: z.string().min(8),")).toBe(false);
  });
  test("Django field: password: models.CharField(max_length=128),", () => {
    expect(lineHasSecret("    password: models.CharField(max_length=128),")).toBe(false);
  });
  test("quoted literal still flags (value, not type)", () => {
    expect(lineHasSecret(`password = "${"y".repeat(12)}"`)).toBe(true);
  });
  test("bare long token still flags (compose / .env shape)", () => {
    expect(lineHasSecret(`password = ${"y".repeat(12)}`)).toBe(true);
  });
});

describe("isOrchestrationPath — exclude the .claude/ orchestration tree", () => {
  test("excludes hooks (the self-matching false-positive case)", () => {
    expect(isOrchestrationPath(".claude/hooks/security-gate.ts")).toBe(true);
    expect(isOrchestrationPath(".claude/hooks/__tests__/security-gate.test.ts")).toBe(true);
  });
  test("excludes skills, references, examples, templates (any extension)", () => {
    expect(isOrchestrationPath(".claude/skills/django-architecture/references/service-patterns.md")).toBe(true);
    expect(isOrchestrationPath(".claude/skills/multi-tenant-guardian/examples/auth_token_mixin_pattern.md")).toBe(true);
    expect(isOrchestrationPath(".claude/skills/foo/templates/config.yaml")).toBe(true);
  });
  test("excludes settings (documented tradeoff — tool config, not business code)", () => {
    expect(isOrchestrationPath(".claude/settings.json")).toBe(true);
  });
  test("does NOT exclude business code — detection there is untouched", () => {
    expect(isOrchestrationPath("src/auth/middleware.ts")).toBe(false);
    expect(isOrchestrationPath("acme/settings.py")).toBe(false);
    expect(isOrchestrationPath(".env")).toBe(false);
    expect(isOrchestrationPath("config.yaml")).toBe(false);
  });
  test("does NOT exclude a 'claude' dir that isn't .claude", () => {
    expect(isOrchestrationPath("src/claude/client.ts")).toBe(false);
    expect(isOrchestrationPath("claude.ts")).toBe(false);
  });
});

describe("isApiSpecDocument — API contracts are examples by nature", () => {
  test("recognises an OpenAPI document (unquoted key and version)", () => {
    expect(isApiSpecDocument("openapi: 3.0.3\ninfo:\n  title: Acme API\n")).toBe(true);
  });
  test("recognises a Swagger 2 document (quoted version)", () => {
    expect(isApiSpecDocument('swagger: "2.0"\ninfo:\n  title: legacy\n')).toBe(true);
  });
  test("recognises a JSON-style quoted root key", () => {
    expect(isApiSpecDocument('"openapi": "3.0.3"\n')).toBe(true);
  });

  test("does NOT recognise docker-compose — where a real secret lives", () => {
    const compose = "services:\n  db:\n    environment:\n      POSTGRES_PASSWORD: hunter2verylongvalue\n";
    expect(isApiSpecDocument(compose)).toBe(false);
  });
  test("does NOT recognise a Helm values.yaml", () => {
    expect(isApiSpecDocument("replicaCount: 1\nimage:\n  tag: latest\n")).toBe(false);
  });
  test("does NOT recognise a tooling config pointing AT a spec (path, not version)", () => {
    expect(isApiSpecDocument("openapi: ./contract/spec.yaml\n")).toBe(false);
  });
  test("does NOT recognise an indented key — the spec version is a root key", () => {
    expect(isApiSpecDocument("apis:\n  main:\n    openapi: 3.0.3\n")).toBe(false);
  });

  test("scope changed, detector did NOT: the placeholder line still reads as a secret", () => {
    // Guards the fix from degrading into "we weakened SECRET_PATTERN".
    expect(lineHasSecret("                  token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")).toBe(true);
  });
});

describe("clean code", () => {
  test("no detection for env-var indirection", () => {
    expect(lineHasSecret("const key = process.env.API_KEY")).toBe(false);
  });
  test("stateful /g regex resets between calls", () => {
    const line = `SECRET = "${LONG}"`;
    expect(lineHasSecret(line)).toBe(true);
    // Would be false on the 2nd call if lastIndex were not reset — guards the gotcha.
    expect(lineHasSecret(line)).toBe(true);
  });
});

describe("git discipline warn (029/US4)", () => {
  const turn = (prompt: string, commands: string[]) => {
    const lines = [
      JSON.stringify({ type: "user", message: { content: prompt } }),
      ...commands.map((c) =>
        JSON.stringify({
          type: "assistant",
          message: { content: [{ type: "tool_use", name: "Bash", input: { command: c } }] },
        }),
      ),
    ];
    return lines.join("\n");
  };

  test("warns when git commit ran and the user prompt did not ask for it", () => {
    const t = extractTurnFromTranscript(turn("arregla el bug del parser", ["git add -A && git commit -m 'fix'"]));
    const w = buildGitDisciplineWarning(t.userPrompt, t.bashCommands);
    expect(w).not.toBeNull();
    expect(w!.systemMessage).toContain("git");
  });

  test("stays silent when the user asked for the commit", () => {
    const t = extractTurnFromTranscript(turn("haz commit de estos cambios", ["git commit -m 'ABC-1 fix'"]));
    expect(buildGitDisciplineWarning(t.userPrompt, t.bashCommands)).toBeNull();
  });

  test("stays silent when no git mutation ran", () => {
    const t = extractTurnFromTranscript(turn("arregla el bug", ["bun test ./x", "git status"]));
    expect(buildGitDisciplineWarning(t.userPrompt, t.bashCommands)).toBeNull();
  });

  test("push without ask also warns", () => {
    const t = extractTurnFromTranscript(turn("refactoriza el helper", ["git push origin dev"]));
    expect(buildGitDisciplineWarning(t.userPrompt, t.bashCommands)).not.toBeNull();
  });

  test("malformed transcript lines are tolerated (best-effort)", () => {
    const raw = "{not json\n" + turn("sube esto a la rama", ["git push origin feature/x"]);
    expect(() => extractTurnFromTranscript(raw)).not.toThrow();
    const t = extractTurnFromTranscript(raw);
    expect(buildGitDisciplineWarning(t.userPrompt, t.bashCommands)).toBeNull(); // "sube" = intent
  });
});

describe("git discipline — shell data is not a command (false-positive class, run-don't-predict corollary)", () => {
  test("heredoc body containing 'git commit' literals does not warn (the gate's own fixtures tripped it in production)", () => {
    const cmd = [
      "cat >> some.test.ts << 'EOF'",
      'const c = "git add -A && git commit -m \'fix\'";',
      'const d = "git push origin dev";',
      "EOF",
    ].join("\n");
    expect(buildGitDisciplineWarning("arregla el bug", [cmd])).toBeNull();
  });

  test("quoted git text in echo/printf does not warn", () => {
    expect(buildGitDisciplineWarning("documenta esto", ['echo "usa git push con cuidado"'])).toBeNull();
  });

  test("ESCAPED quotes inside a double-quoted JSON payload do not break span parity (live FP 2026-08-07)", () => {
    // The gate's own smoke test tripped it: printf writing a JSONL fixture whose
    // escaped-quote content mentions git commit. Data, not an invocation.
    const cmd =
      'printf \'%s\\n\' "{\\"type\\":\\"assistant\\",\\"input\\":{\\"command\\":\\"cd $SCRATCH/fake-repo; git commit -qm init\\"}}" > /tmp/fixture.jsonl';
    expect(buildGitDisciplineWarning("revisa los tests", [cmd], "/Users/oriol/proyectos/mi-repo")).toBeNull();
    expect(buildGitDisciplineWarning("revisa los tests", [cmd])).toBeNull(); // legacy path too
  });

  test("a real mutation with escaped quotes in its message still warns", () => {
    expect(
      buildGitDisciplineWarning("arregla el bug", ['git commit -m "fix \\"quoted\\" thing"']),
    ).not.toBeNull();
  });

  test("a real git commit still warns after stripping", () => {
    expect(buildGitDisciplineWarning("arregla el bug", ["git commit -m 'fix parser'"])).not.toBeNull();
  });

  test("a real chained mutation still warns", () => {
    expect(buildGitDisciplineWarning("refactoriza", ["bun test && git push origin dev"])).not.toBeNull();
  });
});

describe("git discipline — full mutating class (critic MAJOR 3, 029)", () => {
  test("reset --hard, branch -D, merge and gh pr create warn when unasked", () => {
    for (const cmd of ["git reset --hard HEAD~1", "git branch -D feature/x", "git merge dev", "gh pr create --fill"]) {
      expect(buildGitDisciplineWarning("arregla el parser", [cmd])).not.toBeNull();
    }
  });

  test("asked-for merge/rebase/pr stay silent", () => {
    expect(buildGitDisciplineWarning("mergea dev en mi rama", ["git merge dev"])).toBeNull();
    expect(buildGitDisciplineWarning("crea la pr de este ticket", ["gh pr create --fill"])).toBeNull();
    expect(buildGitDisciplineWarning("rebasea sobre dev", ["git rebase dev"])).toBeNull();
  });

  test("read-only git stays silent", () => {
    expect(buildGitDisciplineWarning("investiga", ["git log --oneline", "git branch --list", "git diff"])).toBeNull();
  });
});

describe("stop_hook_active re-entry guard (030)", () => {
  test("active stop-hook continuation is skipped", () => {
    expect(shouldSkipStopHook({ stop_hook_active: true })).toBe(true);
  });

  test("normal Stop payloads are processed", () => {
    expect(shouldSkipStopHook({ stop_hook_active: false })).toBe(false);
    expect(shouldSkipStopHook({})).toBe(false);
    expect(shouldSkipStopHook(null)).toBe(false);
    expect(shouldSkipStopHook("not-an-object")).toBe(false);
  });
});

describe("readTranscriptTail — bounded read, never the whole file (030)", () => {
  const dir = mkdtempSync(join(tmpdir(), "poneglyph-transcript-test-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test("large file: returns at most maxBytes, keeping the end", async () => {
    const path = `${dir}/sg-tail-large.jsonl`;
    const filler = `${"x".repeat(99)}\n`.repeat(3000); // ~300KB
    await Bun.write(path, filler + "LAST_LINE_MARKER\n");
    const tail = await readTranscriptTail(path, 64 * 1024);
    expect(tail.length).toBeLessThanOrEqual(64 * 1024);
    expect(tail).toContain("LAST_LINE_MARKER");
    expect(tail.length).toBeGreaterThan(63 * 1024); // actually read the window, not a sliver
  });

  test("small file: returns the whole content", async () => {
    const path = `${dir}/sg-tail-small.jsonl`;
    await Bun.write(path, "only line\n");
    expect(await readTranscriptTail(path, 64 * 1024)).toBe("only line\n");
  });
});

// --- Cross-repo exclusion (audit 2026-08-07) ----------------------------------

const SESSION_CWD = "/Users/oriol/proyectos/mi-repo";

describe("splitStatements", () => {
  test("splits on &&, ||, ;, | and newlines", () => {
    expect(splitStatements("a && b || c; d | e\nf")).toEqual(["a", "b", "c", "d", "e", "f"]);
  });
  test("trims and drops empty segments", () => {
    expect(splitStatements("  a  ;;  b  ")).toEqual(["a", "b"]);
  });
});

describe("resolveInlineVars", () => {
  test("resolves a variable assigned earlier in the same command", () => {
    const out = resolveInlineVars(["SCRATCH=/tmp/x", "cd $SCRATCH/repo"]);
    expect(out[1]).toBe("cd /tmp/x/repo");
  });
  test("supports the export prefix and ${VAR} syntax", () => {
    const out = resolveInlineVars(["export DIR=/tmp/y", "cd ${DIR}/sub"]);
    expect(out[1]).toBe("cd /tmp/y/sub");
  });
  test("leaves external (unassigned) variables untouched", () => {
    const out = resolveInlineVars(["cd $CI_WORKDIR/build"]);
    expect(out[0]).toBe("cd $CI_WORKDIR/build");
  });
});

describe("resolveMutationLocation — pure directory resolution", () => {
  test("cd to /tmp before the mutation → external", () => {
    expect(resolveMutationLocation("cd /tmp/x && git commit -m x", SESSION_CWD)).toBe("external");
  });
  test("mutation BEFORE the cd → session (order matters)", () => {
    expect(resolveMutationLocation("git commit -m x && cd /tmp", SESSION_CWD)).toBe("session");
  });
  test("inline variable resolved through cd → external", () => {
    expect(
      resolveMutationLocation("SCRATCH=/private/tmp/b; cd $SCRATCH/fake-repo; git commit -m x", SESSION_CWD),
    ).toBe("external");
  });
  test("unresolvable external variable → unknown", () => {
    expect(resolveMutationLocation("cd $CI_WORKDIR && git commit -m x", SESSION_CWD)).toBe("unknown");
  });
  test("relative cd inside the session tree → session", () => {
    expect(resolveMutationLocation("cd src && git commit -m x", SESSION_CWD)).toBe("session");
  });
  test("git -C to an external path → external", () => {
    expect(resolveMutationLocation("git -C /tmp/other commit -m x", SESSION_CWD)).toBe("external");
  });
  test("git -C pointing INTO the session repo → session (new alert class, deliberate)", () => {
    expect(resolveMutationLocation(`git -C ${SESSION_CWD} commit -m x`, SESSION_CWD)).toBe("session");
  });
  test("no cd at all → session (base case)", () => {
    expect(resolveMutationLocation("git commit -m x", SESSION_CWD)).toBe("session");
  });
  test("cd ~ is unresolvable → unknown (home is not under the session cwd)", () => {
    expect(resolveMutationLocation("cd ~ && git commit -m x", SESSION_CWD)).toBe("unknown");
  });
  // Audit 010: the comparison must be separator-agnostic — on Windows the
  // native resolver yields `\`, and the old `startsWith(base + "/")` never matched.
  test("native absolute cd INTO the session tree → session (separator-agnostic)", () => {
    const nativeCwd = resolve(SESSION_CWD);
    const inside = join(nativeCwd, "src", "deep");
    expect(resolveMutationLocation(`cd ${inside} && git commit -m x`, nativeCwd)).toBe("session");
  });
  test("sibling directory sharing the base prefix → external (no prefix false positive)", () => {
    const nativeCwd = resolve(SESSION_CWD);
    expect(resolveMutationLocation(`cd ${nativeCwd}-other && git commit -m x`, nativeCwd)).toBe("external");
  });
});

describe("GIT_MUTATION_RE — reconoce git -C (audit 2026-08-07)", () => {
  test("git -C <path> commit matches", () => {
    expect(GIT_MUTATION_RE.test("git -C /tmp/x commit -m y")).toBe(true);
  });
  test("git -C <path> status stays read-only (no match)", () => {
    expect(GIT_MUTATION_RE.test("git -C /tmp/x status")).toBe(false);
  });
});

describe("git discipline — cross-repo exclusion (audit 2026-08-07)", () => {
  test("fixture de regresión real: benchmark git en scratchpad NO avisa", () => {
    const cmd =
      "SCRATCH=/private/tmp/bench-xyz; mkdir -p $SCRATCH/fake-repo && cd $SCRATCH/fake-repo; git init -q; git commit --allow-empty -qm init";
    expect(buildGitDisciplineWarning("revisa los tests de la aplicacion", [cmd], SESSION_CWD)).toBeNull();
  });

  test("cd /tmp sin variable → no avisa", () => {
    expect(buildGitDisciplineWarning("arregla el bug", ["cd /tmp/x && git commit -m wip"], SESSION_CWD)).toBeNull();
  });

  test("git -C externo → no avisa", () => {
    expect(buildGitDisciplineWarning("arregla el bug", ["git -C /tmp/other commit -m wip"], SESSION_CWD)).toBeNull();
  });

  test("mutación antes del cd → avisa", () => {
    expect(
      buildGitDisciplineWarning("arregla el bug", ["git commit -m wip && cd /tmp"], SESSION_CWD),
    ).not.toBeNull();
  });

  test("cd relativo dentro del árbol → avisa", () => {
    expect(buildGitDisciplineWarning("arregla el bug", ["cd src && git commit -m wip"], SESSION_CWD)).not.toBeNull();
  });

  test("git -C al propio repo de sesión → avisa (clase de alerta nueva)", () => {
    expect(
      buildGitDisciplineWarning("arregla el bug", [`git -C ${SESSION_CWD} commit -m wip`], SESSION_CWD),
    ).not.toBeNull();
  });

  test("variable externa no resoluble → no avisa (fail-open, warn-not-gate)", () => {
    expect(
      buildGitDisciplineWarning("arregla el bug", ["cd $CI_WORKDIR && git commit -m wip"], SESSION_CWD),
    ).toBeNull();
  });

  test("sin cd → avisa (caso base sin cambios)", () => {
    expect(buildGitDisciplineWarning("arregla el bug", ["git commit -m wip"], SESSION_CWD)).not.toBeNull();
  });

  test("sin sessionCwd → comportamiento legacy (escape hatch de tests puros)", () => {
    expect(buildGitDisciplineWarning("arregla el bug", ["cd /tmp/x && git commit -m wip"])).not.toBeNull();
  });
});
