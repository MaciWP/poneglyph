import { expect, test } from "bun:test";
import { cells, hasBlocks, parse, plain } from "../hooks/markdown.ts";

test("a reply without tables, callouts or task lists is left alone", () => {
  const md = "Hola.\n\n- uno\n- dos\n\n> una cita\n\n| no es tabla |";
  expect(hasBlocks(parse(md))).toBe(false);
  expect(parse(md)).toEqual([{ kind: "text", text: md }]);
});

test("a GFM table becomes rows of plain cells, with the text around it kept", () => {
  const md = "Antes:\n\n| Base | **Precio** |\n|:---|---:|\n| SQLite | `gratis` |\n| Postgres | a \\| b |\n\nDespués.";
  expect(parse(md)).toEqual([
    { kind: "text", text: "Antes:" },
    { kind: "table", head: ["Base", "Precio"], rows: [["SQLite", "gratis"], ["Postgres", "a | b"]] },
    { kind: "text", text: "Después." },
  ]);
  // A short row is padded; a header without a matching delimiter is not a table.
  expect(parse("| a | b |\n|---|---|\n| 1 |")[0]).toEqual({ kind: "table", head: ["a", "b"], rows: [["1", ""]] });
  expect(hasBlocks(parse("| a | b |\n|---|\n| 1 | 2 |"))).toBe(false);
  // A table still missing its first row (mid-stream) stays text.
  expect(hasBlocks(parse("| a | b |\n|---|---|"))).toBe(false);
});

test("callouts keep their body as markdown and need one", () => {
  expect(parse("> [!WARNING]\n> Haz copia de `data/`.\n> Luego arranca.")).toEqual([
    { kind: "callout", type: "warning", text: "Haz copia de `data/`.\nLuego arranca." },
  ]);
  expect(hasBlocks(parse("> [!NOTE]\n\nnada"))).toBe(false);
});

test("a flat task list becomes a checklist; a nested one stays text", () => {
  expect(parse("- [x] **Tests**\n- [ ] Docs")).toEqual([
    { kind: "tasks", items: [{ done: true, text: "Tests" }, { done: false, text: "Docs" }] },
  ]);
  expect(hasBlocks(parse("- [x] Tests\n  - detalle\n- [ ] Docs"))).toBe(false);
});

test("nothing inside a code fence is touched", () => {
  const md = "```md\n| a | b |\n|---|---|\n| 1 | 2 |\n> [!NOTE]\n> x\n- [ ] t\n```";
  expect(parse(md)).toEqual([{ kind: "text", text: md }]);
  // An unclosed fence keeps everything after it as text.
  expect(hasBlocks(parse("~~~\n| a | b |\n|---|---|\n| 1 | 2 |"))).toBe(false);
});

test("cells and inline marks", () => {
  expect(cells("| a | b |")).toEqual(["a", "b"]);
  expect(cells("a|b")).toEqual(["a", "b"]);
  expect(plain("**negrita**, *cursiva*, `code` y 2 * 3 * 4")).toBe("negrita, cursiva, code y 2 * 3 * 4");
});

test("a table inside a list item or indented as a code block stays text", () => {
  for (const md of ["- | a | b |\n  |---|---|\n  | 1 | 2 |", "1. | a | b |\n|---|---|\n| 1 | 2 |", "    | a | b |\n    |---|---|\n    | 1 | 2 |"]) {
    expect(hasBlocks(parse(md))).toBe(false);
  }
});
