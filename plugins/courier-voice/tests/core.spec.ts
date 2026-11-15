import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { namesOf, senderOf, voiceOf } from "../hooks/core.ts";

const courier = { kind: "plugin", name: "courier" };
const ID = "90da386d-37a8-4e7a-a4b8-d040a6dad21e";
const server = `[Agentic OS message ceabc9f7 from ${ID}]\nLead → Cabina. Informe 2 recibido.\nSigue con la fase 3.\n\nReply only if the message asks for one: /x/aos message reply ceabc9f7 --agent b --text-file <file>. Use /x/aos help for coordination and file reservations.`;
const local = `[Agentic OS message m1 from user]\nHola.\n\nReply with: aos message reply m1 --text-file <file>. Use aos help for coordination and file reservations.`;

test("the server's format: the sender by name, the body without header or reply line", () => {
  expect(voiceOf(courier, server, new Map([[ID, "Lead"]]))).toEqual({
    title: "Agentic OS · Lead",
    first: "Lead → Cabina. Informe 2 recibido.",
    body: "Lead → Cabina. Informe 2 recibido.\nSigue con la fase 3.",
  });
});

test("this mod's own format, the engine's frame, and a sender with no known name", () => {
  expect(voiceOf(courier, `The courier plugin sent a message: ${local}`)).toEqual({ title: "Agentic OS · tú", first: "Hola.", body: "Hola." });
  expect(voiceOf(courier, server).title).toBe("Agentic OS · 90da386d");
});

test("a header that does not match keeps the whole text under a plain title", () => {
  expect(voiceOf(courier, "Un mensaje sin cabecera.\nSegunda línea.")).toEqual({ title: "Agentic OS", first: "Un mensaje sin cabecera.", body: "Un mensaje sin cabecera.\nSegunda línea." });
});

test("any other origin is not courier's to draw", () => {
  for (const origin of [undefined, { kind: "composer" }, { kind: "plugin", name: "other" }, { kind: "task-notification" }, { kind: "unclassified" }, { kind: "peer" }])
    expect(voiceOf(origin, server)).toBeNull();
});

test("namesOf keeps agents with an id and a name", () => {
  expect([...namesOf({ agents: [{ id: "a", name: " Lead " }, { id: "b", name: "" }, { id: 3, name: "x" }] })]).toEqual([["a", "Lead"]]);
  expect(namesOf(null).size).toBe(0);
});

test("senderOf reads the header's agent id, framed or not", () => {
  expect(senderOf(server)).toBe(ID);
  expect(senderOf(`The courier plugin sent a message: ${local}`)).toBe("user");
  expect(senderOf("sin cabecera")).toBeUndefined();
});

// courier writes the message and this mod reads it; each installs alone, so the format is checked
// against courier's own fallback `prompt()`, read from its source.
test("courier's own fallback format loses its header and reply line", () => {
  const src = readFileSync(new URL("../../courier/hooks/register.ts", import.meta.url), "utf8");
  const template = /const prompt = \(m: Message\) =>\s*typeof m\.prompt === "string" \? m\.prompt : `([^`]+)`;/.exec(src)?.[1];
  expect(template).toBeDefined();
  const text = template!.replaceAll("\\n", "\n").replaceAll("${m.id}", "m9").replaceAll("${m.from}", ID).replaceAll("${m.text}", "Cuerpo.\nOtra línea.");
  expect(voiceOf(courier, text, new Map([[ID, "Lead"]]))).toEqual({ title: "Agentic OS · Lead", first: "Cuerpo.", body: "Cuerpo.\nOtra línea." });
});

test("a server name with control characters is cleaned", () => {
  expect(namesOf({ agents: [{ id: "a", name: "Le\u001b[31mad\u0007" }] }).get("a")).toBe("Le[31mad");
});
