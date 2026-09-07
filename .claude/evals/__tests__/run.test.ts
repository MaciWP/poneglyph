import { describe, expect, it } from "bun:test";
import { transcriptHealth } from "../run";

// 032 (2026-09-03): the claude.ai usage limit hit mid-run and every skill case "failed"
// twice — the sessions never produced an assistant turn. ERROR must not read as FAIL.
describe("transcriptHealth", () => {
  const assistant = JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "hola" }] } });
  const okResult = JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "hola" });

  it("is ok when at least one assistant turn exists", () => {
    expect(transcriptHealth(`${assistant}\n${okResult}\n`)).toEqual({ ok: true });
  });

  it("flags a transcript with no assistant turn (quota, auth, API outage)", () => {
    const h = transcriptHealth(`${okResult}\n`);
    expect(h.ok).toBe(false);
    expect((h as { reason: string }).reason).toContain("no assistant turn");
  });

  it("flags a result event that reports an error, even after an assistant turn", () => {
    const err = JSON.stringify({ type: "result", subtype: "error_during_execution", is_error: true, result: "Rate limit exceeded" });
    const h = transcriptHealth(`${assistant}\n${err}\n`);
    expect(h.ok).toBe(false);
    expect((h as { reason: string }).reason).toContain("Rate limit exceeded");
  });

  it("treats a plain-text transcript (offline .txt fixture) as gradable and an empty one as an error", () => {
    expect(transcriptHealth("La respuesta en prosa, sin eventos stream-json.\n{broken").ok).toBe(true);
    expect(transcriptHealth("").ok).toBe(false);
    expect(transcriptHealth("   \n").ok).toBe(false);
  });
});
