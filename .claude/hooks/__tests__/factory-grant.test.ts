import { describe, expect, it } from "bun:test";
import { factoryGrant } from "../lib/factory-grant";

const now = Date.parse("2026-10-26T10:00:00Z");
const valid = { ticket: "ABC-1", branch: "feature/ABC-1", repo: "o/r", expires: "2026-10-26T11:00:00Z" };
const grantEnv = (over: Record<string, unknown> = {}) => ({ PONEGLYPH_FACTORY: JSON.stringify({ ...valid, ...over }) });

describe("factory-grant", () => {
  it("parses a valid grant and ignores extra fields", () => {
    expect(factoryGrant(grantEnv(), now)).toEqual(valid);
    expect(factoryGrant(grantEnv({ note: "x" }), now)).toEqual(valid);
    expect(factoryGrant(grantEnv({ branch: "jrv/abc-1-fix" }), now)?.branch).toBe("jrv/abc-1-fix");
  });

  it("is null for every invalid shape", () => {
    const rows: Record<string, string | undefined>[] = [
      {},
      { PONEGLYPH_FACTORY: "" },
      { PONEGLYPH_FACTORY: "{" },
      { PONEGLYPH_FACTORY: "[]" },
      { PONEGLYPH_FACTORY: "null" },
      ...["main", "master", "dev", "develop", "HEAD", "feature/OTHER-2", "feature/ABC-12", "feature/ABC-1..x", "feature/ABC-1:main", "feature/*ABC-1", "feature/ABC 1", "-ABC-1", "ABC-1@{u}", "+ABC-1"].map((branch) => grantEnv({ branch })),
      ...["o", "o/r/x", "o/", "/r", "o r/x"].map((repo) => grantEnv({ repo })),
      ...["abc-1", "ABC", "ABC-", "1-ABC"].map((ticket) => grantEnv({ ticket })),
      ...["2026-10-26T09:59:59Z", "tomorrow", "2026-10-27T10:00:01Z"].map((expires) => grantEnv({ expires })),
      ...(["ticket", "branch", "repo", "expires"] as const).map((k) => ({ PONEGLYPH_FACTORY: JSON.stringify({ ...valid, [k]: undefined }) })),
      grantEnv({ ticket: 1 }),
    ];
    for (const env of rows) expect([env, factoryGrant(env, now)]).toEqual([env, null]);
  });

  it("reads only the env it is given, never the command text", () => {
    expect(factoryGrant({ OTHER: `PONEGLYPH_FACTORY=${JSON.stringify(valid)}` }, now)).toBeNull();
  });
});
