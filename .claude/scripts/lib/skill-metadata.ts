/** Shared YAML decoding for source validation and runtime skill readers. */
export function frontmatter(text: string): { fields: Record<string, unknown>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) throw new Error("Missing or malformed YAML frontmatter.");
  const fields = Bun.YAML.parse(match[1]);
  if (fields === null || typeof fields !== "object" || Array.isArray(fields)) throw new Error("Frontmatter must be a mapping.");
  return { fields: fields as Record<string, unknown>, body: text.slice(match[0].length) };
}

/** Optional routing metadata; the description marker is a legacy fallback only. */
export function skillKeywords(fields: Record<string, unknown>): string[] {
  const metadata = fields.metadata;
  let block: string;
  if (metadata !== null && typeof metadata === "object" && !Array.isArray(metadata) && Object.hasOwn(metadata, "keywords")) {
    const value = (metadata as Record<string, unknown>).keywords;
    if (typeof value !== "string") return [];
    block = value.replace(/^\s*Keywords\s*-\s*/i, "");
  } else {
    block = typeof fields.description === "string"
      ? fields.description.match(/Keywords\s*-\s*([\s\S]*)/i)?.[1] ?? ""
      : "";
  }
  // Preserve wrapped phrases and the existing inline example convention.
  return block.replace(/\s*\n\s*/g, " ")
    .split(/\s*,\s*/)
    .flatMap(k => k.split(/\s-\s/))
    .map(k => k.trim().toLowerCase().replace(/['"]/g, ""))
    .filter(k => k.length >= 3);
}
