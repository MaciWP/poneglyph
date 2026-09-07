/**
 * Design tokens for the html-report DYNAMIC mode (feature 010).
 * v2 palette (2026-06-08, per user feedback "colores apagados, poco elegantes,
 * contraste bajo"): cool-neutral elegant base + vivid teal accent + cleaner,
 * more saturated data colors. Higher surface contrast. Still: one accent, no
 * purple, serif display + sans body + mono data. Own palette — does NOT touch
 * the report/glance templates (each mode owns its palette, like dashboard).
 * All text colors measured ≥ WCAG AA 4.5:1 in both schemes.
 */

export function themeCss(): string {
  return `
  /* ---- LIGHT: clean cool-neutral, vivid teal ---- */
  :root {
    --bg:#f3f5f9; --surface:#ffffff; --surface-2:#e9eef5;
    --line:#d9e0ea; --line-strong:#bcc6d4;
    --ink:#0f1620; --ink-2:#404a59; --ink-3:#5d6776; /* measured AA on white + surface-2 */
    --accent:#0d9488; --accent-2:#0f766e; --accent-bg:#dcf5f0; --link:#0e7490;
    --good:#16a34a; --mid:#ca8a04; --warn:#ea580c; --bad:#dc2626;
    --blocker:#dc2626; --major:#ea580c; --minor:#ca8a04; --nit:#64748b; --ok:#16a34a;
    --track:rgba(15,22,32,.08);
    --serif:"Newsreader","Iowan Old Style",Palatino,Georgia,serif;
    --sans:"Geist",ui-sans-serif,-apple-system,"Segoe UI",sans-serif;
    --mono:"Geist Mono",ui-monospace,"SF Mono",Consolas,monospace;
    --shadow:0 1px 2px rgba(17,22,29,.08),0 8px 24px rgba(17,22,29,.10);
    --maxw:1180px;
  }
  /* ---- DARK: deep blue-black, vivid teal, lively data ---- */
  html[data-theme="dark"] {
    --bg:#0a0e1a; --surface:#1a2236; --surface-2:#232e48;
    --line:#33415f; --line-strong:#475a7e;
    --ink:#eef1f6; --ink-2:#c4ccda; --ink-3:#959fb1; /* higher-contrast dark per user feedback */
    --accent:#2dd4bf; --accent-2:#5eead4; --accent-bg:#0e3330; --link:#38bdf8;
    --good:#34d399; --mid:#fbbf24; --warn:#fb923c; --bad:#f87171;
    --blocker:#f87171; --major:#fb923c; --minor:#fbbf24; --nit:#94a3b8; --ok:#34d399;
    --track:rgba(255,255,255,.06);
    --shadow:0 1px 2px rgba(0,0,0,.55),0 12px 32px rgba(0,0,0,.5);
  }
  /* ---- No-JS fallback: honor OS preference ---- */
  @media (prefers-color-scheme: dark) {
    html:not([data-theme]) {
      --bg:#0a0e1a; --surface:#1a2236; --surface-2:#232e48;
      --line:#33415f; --line-strong:#475a7e;
      --ink:#eef1f6; --ink-2:#c4ccda; --ink-3:#959fb1;
      --accent:#2dd4bf; --accent-2:#5eead4; --accent-bg:#0e3330; --link:#38bdf8;
      --good:#34d399; --mid:#fbbf24; --warn:#fb923c; --bad:#f87171;
      --blocker:#f87171; --major:#fb923c; --minor:#fbbf24; --nit:#94a3b8; --ok:#34d399;
      --track:rgba(255,255,255,.06);
      --shadow:0 1px 2px rgba(0,0,0,.55),0 12px 32px rgba(0,0,0,.5);
    }
  }
  /* ---- Type scale (one ratio ~1.25) ---- */
  :root {
    --t-xs:.75rem; --t-sm:.8125rem; --t-base:.9375rem; --t-md:1.0625rem;
    --t-lg:1.375rem; --t-xl:1.75rem; --t-2xl:2.25rem; --t-3xl:clamp(2.1rem,5vw,3.2rem);
  }`;
}
