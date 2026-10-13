import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { CAPS, draftText, INPUT_SCHEMA, validate } from "../hooks/schema.ts";

const compare = {
  kind: "compare",
  title: "Bases de datos",
  options: ["SQLite", "Postgres"],
  topics: [{ name: "Precio", rows: [{ label: "Licencia", values: ["gratis", "gratis"], best: 0 }] }],
};
const error = (input: unknown) => {
  const r = validate(input);
  return r.ok ? "ok" : r.error;
};

test("the three kinds come through as sent", () => {
  expect(validate(compare)).toEqual({ ok: true, view: compare as never });
  const cards = { kind: "cards", title: "Vinos", items: [{ name: "Rioja", metric: "92 pts", image: "/tmp/a.png" }] };
  expect(validate(cards)).toEqual({ ok: true, view: cards as never });
  const draft = { kind: "draft", title: "PR", label: "PR", subject: "fix: x", body: "Cuerpo" };
  expect(validate(draft)).toEqual({ ok: true, view: draft as never });
  expect(draftText(draft as never)).toBe("fix: x\n\nCuerpo");
  expect(draftText({ ...draft, subject: undefined } as never)).toBe("Cuerpo");
});

test("each error names the field and how to fix it", () => {
  expect(error(null)).toBe("send an object with kind and title");
  expect(error({ kind: "table", title: "x" })).toBe("kind must be compare, cards or draft");
  expect(error({ ...compare, data: {} })).toBe("data is not a field here; allowed: kind, title, options, topics, verdict");
  expect(error({ ...compare, title: "" })).toBe("title must be a non-empty string");
  expect(error({ ...compare, options: ["a"] })).toBe("options has 1 entries; send 2 to 4");
  const rows = (r: object) => ({ ...compare, topics: [{ name: "P", rows: [r] }] });
  expect(error(rows({ label: "L", values: ["a"] }))).toBe("topics[0].rows[0].values has 1 entries; send 2 to 2");
  expect(error(rows({ label: "L", values: ["a", "b"], best: 2 }))).toBe("topics[0].rows[0].best must be an option index from 0 to 1");
  expect(error(rows({ label: "L", values: ["a", "b"], note: "x" }))).toBe("topics[0].rows[0].note is not a field here; allowed: label, values, best");
  expect(error({ kind: "cards", title: "x", items: [{ name: "a", image: "a.png" }] })).toBe("items[0].image must be an absolute local path; leave it out otherwise");
  expect(error({ kind: "draft", title: "x", body: "a".repeat(4001) })).toBe("body has 4001 characters; keep it to 4000");
  expect(error({ kind: "draft", title: "x" })).toBe("body must be a non-empty string");
});

test("the caps hold in the validator and in the schema the model reads", () => {
  const topics = Array.from({ length: CAPS.topics + 1 }, (_, i) => ({ name: `t${i}`, rows: compare.topics[0]?.rows }));
  expect(error({ ...compare, topics })).toBe("topics has 7 entries; send 1 to 6");
  const items = Array.from({ length: CAPS.items + 1 }, (_, i) => ({ name: `c${i}` }));
  expect(error({ kind: "cards", title: "x", items })).toBe("items has 6 entries; send 1 to 5");
  expect(INPUT_SCHEMA.properties.topics.maxItems).toBe(CAPS.topics);
  expect(INPUT_SCHEMA.properties.topics.items.properties.rows.maxItems).toBe(CAPS.rows);
  expect(INPUT_SCHEMA.properties.options.maxItems).toBe(CAPS.options);
  expect(INPUT_SCHEMA.properties.items.maxItems).toBe(CAPS.items);
});

// A plugin installs alone, so vista carries a copy of hud's thumbnail code.
test("the raster copy matches hud's", () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  expect(read("../hooks/raster.ts")).toBe(read("../../hud/hooks/raster.ts"));
});
