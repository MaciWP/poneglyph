/**
 * Data contract for the html-report DYNAMIC mode (feature 010).
 * Claude (or any caller) produces a `ReportData` JSON; `render.ts` turns it
 * into ONE self-contained interactive HTML file. Emitting a report = filling
 * this shape — the design/CSS/JS lives once in the generator, not per report.
 *
 * All fields beyond `meta` are optional: omit a block and the generator skips it.
 */

export type Verdict = "ok" | "warn" | "blocker" | "neutral";
export type Severity = "blocker" | "major" | "minor" | "nit" | "ok";
export type ScoreHealth = "good" | "mid" | "warn" | "bad" | "neutral";
export type CalloutKind = "note" | "tip" | "warn" | "danger";
export type ChartKind = "bar" | "line" | "donut";

export interface Kpi {
  label: string;
  value: string;            // rendered verbatim (e.g. "100%", "9", "7/9")
  sub?: string;
  health?: ScoreHealth;     // colors the value; omit → neutral
  flag?: boolean;           // draws an attention pip
}

export interface Callout {
  kind: CalloutKind;
  title?: string;
  body: string;             // may contain inline HTML
}

export interface Comment {
  md: string;               // Markdown source — interpreted by comments.ts (mdToHtml); fenced code is copy-pasteable
  title?: string;           // optional header (e.g. a location like "process.py:131")
  copy?: boolean;           // add a button that copies the RAW md (e.g. paste a review comment into GitHub)
}

export interface TableColumn {
  key: string;
  label: string;
  numeric?: boolean;        // → tabular-nums + right align
}

export interface TableRow {
  /** cell values keyed by column.key */
  cells: Record<string, string>;
  severity?: Severity;      // optional left-rule tint
}

export interface Table {
  title?: string;
  columns: TableColumn[];
  rows: TableRow[];
  filterable?: boolean;     // adds live search/filter (JS) + static fallback
}

export interface ChartPoint {
  label: string;
  value: number;
  health?: ScoreHealth;     // per-segment color override
}

export interface Chart {
  kind: ChartKind;
  title?: string;
  series: ChartPoint[];
  max?: number;             // domain max; default = max(series.value)
  unit?: string;
}

export interface Sidenote {
  /** marker text shown inline; body shown in the margin (desktop) / inline (mobile) */
  marker: string;
  body: string;
}

export interface Section {
  id: string;               // anchor id — must be unique (used by nav/scrollspy)
  num?: string;             // "01", "02"… optional ordinal chip
  title: string;
  /** ordered content blocks; rendered in array order */
  blocks?: Array<
    | { type: "prose"; html?: string; md?: string }   // html = trusted HTML; md = Markdown (comments.ts)
    | { type: "comment"; data: Comment }              // Markdown block; fenced code copy-pasteable
    | { type: "callout"; data: Callout }
    | { type: "table"; data: Table }
    | { type: "chart"; data: Chart }
    | { type: "sidenote"; data: Sidenote }
    | { type: "kpis"; data: Kpi[] }
  >;
  collapsible?: boolean;    // section can fold (default true on mobile)
}

export interface ReportMeta {
  title: string;
  titleEm?: string;         // secondary phrase rendered in italic serif
  kicker?: string;
  brand?: string;           // default "PONEGLYPH"
  mode?: string;            // e.g. "meta-sistema"
  date: string;             // "2026-06-08"
  verdict?: { kind: Verdict; text: string };
  lede?: string;
  now?: { label: string; action: string };   // immediate-action bar (HTML ok)
  footLeft?: string;
  footRight?: string;
}

export interface ReportData {
  meta: ReportMeta;
  kpis?: Kpi[];             // top KPI row
  sections: Section[];
  /** default theme on first paint; user can toggle (persisted) */
  defaultTheme?: "light" | "dark";
}
