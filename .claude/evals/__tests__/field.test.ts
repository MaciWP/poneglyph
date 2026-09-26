import { describe, expect, it } from "bun:test";
import { LONG_TURN_TOOLS, extractTurns, renderField, summarize } from "../field";

const MODEL = "claude-test-model";
const user = (promptId: string, extra: object = {}) =>
  JSON.stringify({ type: "user", promptId, timestamp: "2026-09-20T10:00:00Z", isSidechain: false, entrypoint: "cli", message: { role: "user", content: "PRIVATE-PROMPT-TEXT" }, ...extra });
const toolResult = (promptId: string) =>
  JSON.stringify({ type: "user", promptId, isSidechain: false, entrypoint: "cli", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t", content: "PRIVATE-TOOL-OUTPUT" }] } });
const assistant = (content: object[], extra: object = {}) =>
  JSON.stringify({ type: "assistant", isSidechain: false, entrypoint: "cli", message: { model: MODEL, content }, ...extra });
const text = (t: string) => ({ type: "text", text: t });
const tool = { type: "tool_use", id: "t", name: "Bash", input: { command: "PRIVATE-COMMAND" } };

describe("extractTurns", () => {
  it("splits turns on a new promptId and keeps tool results inside their turn", () => {
    const turns = extractTurns([
      user("p1"), assistant([tool]), toolResult("p1"), assistant([text("Respuesta uno")]),
      user("p2"), assistant([text("Respuesta dos")]),
    ]);
    expect(turns.map((t) => [t.tools, t.final])).toEqual([[1, "Respuesta uno"], [0, "Respuesta dos"]]);
    expect(turns[0].model).toBe(MODEL);
  });

  it("counts interim text before the last tool call and takes only what follows it as final", () => {
    const [t] = extractTurns([
      user("p1"), assistant([text("Paso 1 de 2: leo."), tool]), toolResult("p1"),
      assistant([text("Paso 2 de 2: pruebo."), tool]), toolResult("p1"), assistant([text("**Hecho.**")]),
    ]);
    expect(t.interim).toBe(2);
    expect(t.final).toBe("**Hecho.**");
  });

  it("leaves out subagent lines and whole headless sessions", () => {
    const side = assistant([text("subagent says"), tool], { isSidechain: true });
    expect(extractTurns([user("p1"), side, assistant([text("Lead")])])).toEqual([{ at: "2026-09-20T10:00:00Z", model: MODEL, tools: 0, interim: 0, final: "Lead" }]);
    expect(extractTurns([user("p1", { entrypoint: "sdk-cli" }), assistant([text("headless")])])).toEqual([]);
  });

  it("keeps a turn that ends on a tool call, with no final text to grade", () => {
    const [t] = extractTurns([user("p1"), assistant([text("Te pregunto."), tool])]);
    expect(t.final).toBe("");
    expect(t.interim).toBe(1);
  });
});

describe("summarize and renderField", () => {
  const longTurn = (interim: number) => [
    user(`long-${interim}`),
    ...Array.from({ length: LONG_TURN_TOOLS }, (_, i) => assistant(i < interim ? [text(`PRIVATE-INTERIM-${i}`), tool] : [tool])),
    assistant([text("**Hecho.** PRIVATE-FINAL-TEXT")]),
  ];
  const lines = [
    ...longTurn(0),
    ...longTurn(3),
    user("opener"), assistant([text("Buena pregunta, PRIVATE-FINAL-TEXT")]),
    user("silent-end"), assistant([tool]),
  ];
  const rows = summarize(extractTurns(lines), (t) => t.model);

  it("reports grader pass rates over turns with final text, and the silent share of long turns", () => {
    expect(rows).toHaveLength(1);
    const [r] = rows;
    expect(r.turns).toBe(4);
    expect(r.noFinal).toBe(1);
    expect(r.pass.openers).toBeCloseTo(2 / 3);
    expect(r.long).toBe(2);
    expect(r.longSilent).toBe(0.5);
  });

  it("prints aggregates only — no text, command or tool output from the transcripts", () => {
    const out = renderField(rows, 14);
    expect(out).toContain(MODEL);
    expect(out).not.toMatch(/PRIVATE|Buena pregunta|Hecho/);
  });
});
