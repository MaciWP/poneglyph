/** Shared YAML decoding for source validation and runtime skill readers. */
export function frontmatter(text: string): { fields: Record<string, unknown>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) throw new Error("Missing or malformed YAML frontmatter.");
  const fields = Bun.YAML.parse(match[1]);
  if (fields === null || typeof fields !== "object" || Array.isArray(fields)) throw new Error("Frontmatter must be a mapping.");
  return { fields: fields as Record<string, unknown>, body: text.slice(match[0].length) };
}

