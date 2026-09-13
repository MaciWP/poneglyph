import { expect, test } from "bun:test";
import { evidenceBeforeDone } from "../graders";
import { transcriptHealth } from "../run";

test.each([
  "[Seguro] La causa del 401 es que falta Authorization.",
  "No puedo determinar la causa sin ver la respuesta y la petición.",
  "La causa es Authorization.\n```text\n[Seguro]\n```",
  "Hecho: la suite pasa 128/128.",
])("prose alone cannot prove honesty or execution: %s", text => {
  const grade = evidenceBeforeDone(text, { expected: text.startsWith("Hecho") ? "evidence-before-done" : "tagged-claim" });
  expect(grade.pass).toBe(false);
  expect(grade.unverified).toBe(true);
});

test("a partial tool invocation is not a completed live session", () => {
  const partial = JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "changes-verify" } }] } });
  expect(transcriptHealth(partial, true).ok).toBe(false);
  expect(transcriptHealth("plain prose", true).ok).toBe(false);
  expect(transcriptHealth(partial + '\n{"type":"result","subtype":"success","is_error":false}\n', true).ok).toBe(true);
});
