/** Shared lifecycle contracts. These validate recorded evidence, not the agent's honesty. */
export interface VerificationRecord {
  us: string;
  /** Commit + diff fingerprint, or another immutable identifier of the checked inputs. */
  revision: string;
  tests_passed: boolean | null;
  checks: Array<{
    name: string;
    status: "passed" | "failed" | "not_run" | "not_applicable";
    /** Observed result/log reference; reason when not applicable. */
    evidence: string;
  }>;
}

export interface ReviewAssessment {
  blockers: number;
  majors: number;
  minors: number;
  nits: number;
  checks: "passed" | "failed" | "not_run";
  coverageMet: boolean;
}

export function validateVerification(value: unknown, us: string): VerificationRecord {
  const v = value as VerificationRecord | undefined;
  if (!v || v.us !== us || typeof v.revision !== "string" || !v.revision.trim()) {
    throw new Error(`${us}: verification must identify the US and checked revision`);
  }
  if (v.tests_passed !== true && v.tests_passed !== null) {
    throw new Error(`${us}: failed or invalid tests_passed cannot close a US`);
  }
  if (!Array.isArray(v.checks) || v.checks.length === 0 || !v.checks.some(c => c?.status === "passed")) {
    throw new Error(`${us}: verification requires at least one observed passing check`);
  }
  for (const c of v.checks) {
    if (!c || typeof c.name !== "string" || !c.name.trim() ||
        typeof c.evidence !== "string" || !c.evidence.trim() ||
        (c.status !== "passed" && c.status !== "not_applicable")) {
      throw new Error(`${us}: verification has a failed, not_run or invalid check`);
    }
  }
  return v;
}

/** Ordered, disjoint decisions. Infrastructure/non-execution cannot become approval. */
export function classifyReview(a: ReviewAssessment): "APPROVED" | "APPROVED_WITH_WARNINGS" | "NEEDS_CHANGES" | "BLOCKED" {
  if (!a || [a.blockers, a.majors, a.minors, a.nits].some(n => !Number.isSafeInteger(n) || n < 0) ||
      !["passed", "failed", "not_run"].includes(a.checks) || typeof a.coverageMet !== "boolean") {
    throw new Error("invalid review assessment");
  }
  if (a.blockers > 0 || a.checks === "not_run") return "BLOCKED";
  if (a.majors > 0 || a.checks === "failed" || !a.coverageMet) return "NEEDS_CHANGES";
  return a.minors + a.nits > 0 ? "APPROVED_WITH_WARNINGS" : "APPROVED";
}
