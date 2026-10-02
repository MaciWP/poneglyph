/**
 * Design tokens for the html-report DYNAMIC mode.
 * The palette lives in templates/tokens.css (the single source of truth for
 * every Poneglyph HTML output); this reads it at render time so the page stays
 * self-contained (inlined into the one <style>, no <link>).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function themeCss(): string {
  return readFileSync(join(import.meta.dir, "..", "templates", "tokens.css"), "utf8");
}
