// What the model may send to show, as the JSON Schema the tool advertises and a validator
// that checks the same rules by hand. The model reads every error, so each one names the
// field and how to fix it.

export type Row = { label: string; values: string[]; best?: number };
export type Topic = { name: string; rows: Row[] };
export type Card = { name: string; metric?: string; badge?: string; detail?: string; image?: string };
export type Compare = { kind: "compare"; title: string; options: string[]; topics: Topic[]; verdict?: string };
export type Cards = { kind: "cards"; title: string; items: Card[] };
export type Draft = { kind: "draft"; title: string; label?: string; subject?: string; body: string };
export type View = Compare | Cards | Draft;

export const CAPS = { options: 4, topics: 6, rows: 8, items: 5 } as const;
const LEN = { title: 80, option: 24, topic: 20, label: 28, value: 60, verdict: 200, name: 60, metric: 30, badge: 20, detail: 200, subject: 120, body: 4000 };

const str = (maxLength: number) => ({ type: "string", minLength: 1, maxLength });

// Flat on purpose: one object whose fields depend on kind, so no oneOf at the top level.
export const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: { enum: ["compare", "cards", "draft"] },
    title: str(LEN.title),
    options: { type: "array", minItems: 2, maxItems: CAPS.options, items: str(LEN.option), description: "compare: the options, one column each" },
    topics: {
      type: "array",
      minItems: 1,
      maxItems: CAPS.topics,
      description: "compare: one tab per topic",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "rows"],
        properties: {
          name: str(LEN.topic),
          rows: {
            type: "array",
            minItems: 1,
            maxItems: CAPS.rows,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "values"],
              properties: {
                label: str(LEN.label),
                values: { type: "array", items: str(LEN.value), description: "one per option, in order" },
                best: { type: "integer", minimum: 0, description: "index of the winning option" },
              },
            },
          },
        },
      },
    },
    verdict: str(LEN.verdict),
    items: {
      type: "array",
      minItems: 1,
      maxItems: CAPS.items,
      description: "cards: best first",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name"],
        properties: {
          name: str(LEN.name),
          metric: str(LEN.metric),
          badge: str(LEN.badge),
          detail: str(LEN.detail),
          image: { type: "string", description: "absolute path of a local image" },
        },
      },
    },
    label: { ...str(LEN.badge), description: "draft: PR, Commit, Correo…" },
    subject: str(LEN.subject),
    body: { ...str(LEN.body), description: "draft: the exact text to copy" },
  },
  required: ["kind", "title"],
} as const;

const FIELDS: Record<View["kind"], string[]> = {
  compare: ["kind", "title", "options", "topics", "verdict"],
  cards: ["kind", "title", "items"],
  draft: ["kind", "title", "label", "subject", "body"],
};

type Result = { ok: true; view: View } | { ok: false; error: string };

class Invalid extends Error {}
const fail = (msg: string): never => {
  throw new Invalid(msg);
};
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function text(v: unknown, at: string, max: number, optional = false): string | undefined {
  if (v === undefined && optional) return undefined;
  if (typeof v !== "string" || !v.trim()) return fail(`${at} must be a non-empty string`);
  if (v.length > max) return fail(`${at} has ${v.length} characters; keep it to ${max}`);
  return v;
}

function list(v: unknown, at: string, min: number, max: number): unknown[] {
  if (!Array.isArray(v)) return fail(`${at} must be an array`);
  if (v.length < min || v.length > max) return fail(`${at} has ${v.length} entries; send ${min} to ${max}`);
  return v;
}

function only(o: Record<string, unknown>, at: string, keys: string[]) {
  const extra = Object.keys(o).find((k) => !keys.includes(k));
  if (extra) fail(`${at}${extra} is not a field here; allowed: ${keys.join(", ")}`);
}

function compare(o: Record<string, unknown>): Compare {
  const options = list(o.options, "options", 2, CAPS.options).map((x, i) => text(x, `options[${i}]`, LEN.option) as string);
  const topics = list(o.topics, "topics", 1, CAPS.topics).map((t, i): Topic => {
    const at = `topics[${i}]`;
    if (!isObject(t)) return fail(`${at} must be an object with name and rows`);
    only(t, `${at}.`, ["name", "rows"]);
    const rows = list(t.rows, `${at}.rows`, 1, CAPS.rows).map((r, j): Row => {
      const rat = `${at}.rows[${j}]`;
      if (!isObject(r)) return fail(`${rat} must be an object with label and values`);
      only(r, `${rat}.`, ["label", "values", "best"]);
      const values = list(r.values, `${rat}.values`, options.length, options.length).map((x, k) => text(x, `${rat}.values[${k}]`, LEN.value) as string);
      const best = r.best;
      if (best !== undefined && (!Number.isInteger(best) || (best as number) < 0 || (best as number) >= options.length))
        fail(`${rat}.best must be an option index from 0 to ${options.length - 1}`);
      return { label: text(r.label, `${rat}.label`, LEN.label) as string, values, ...(best === undefined ? {} : { best: best as number }) };
    });
    return { name: text(t.name, `${at}.name`, LEN.topic) as string, rows };
  });
  const verdict = text(o.verdict, "verdict", LEN.verdict, true);
  return { kind: "compare", title: o.title as string, options, topics, ...(verdict ? { verdict } : {}) };
}

function cards(o: Record<string, unknown>): Cards {
  const items = list(o.items, "items", 1, CAPS.items).map((c, i): Card => {
    const at = `items[${i}]`;
    if (!isObject(c)) return fail(`${at} must be an object with at least name`);
    only(c, `${at}.`, ["name", "metric", "badge", "detail", "image"]);
    const image = c.image;
    if (image !== undefined && (typeof image !== "string" || !image.startsWith("/"))) fail(`${at}.image must be an absolute local path; leave it out otherwise`);
    const card: Card = { name: text(c.name, `${at}.name`, LEN.name) as string };
    for (const [k, max] of [["metric", LEN.metric], ["badge", LEN.badge], ["detail", LEN.detail]] as const) {
      const v = text(c[k], `${at}.${k}`, max, true);
      if (v) card[k] = v;
    }
    if (image) card.image = image as string;
    return card;
  });
  return { kind: "cards", title: o.title as string, items };
}

function draft(o: Record<string, unknown>): Draft {
  const label = text(o.label, "label", LEN.badge, true);
  const subject = text(o.subject, "subject", LEN.subject, true);
  return { kind: "draft", title: o.title as string, ...(label ? { label } : {}), ...(subject ? { subject } : {}), body: text(o.body, "body", LEN.body) as string };
}

export function validate(input: unknown): Result {
  try {
    if (!isObject(input)) return fail("send an object with kind and title");
    const kind = input.kind;
    if (kind !== "compare" && kind !== "cards" && kind !== "draft") return fail("kind must be compare, cards or draft");
    only(input, "", FIELDS[kind]);
    text(input.title, "title", LEN.title);
    return { ok: true, view: kind === "compare" ? compare(input) : kind === "cards" ? cards(input) : draft(input) };
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, error: err.message };
    throw err;
  }
}

// What a copy of the draft holds: the subject on its own line above the body.
export const draftText = (d: Draft) => (d.subject ? `${d.subject}\n\n${d.body}` : d.body);
