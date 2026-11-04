// The factory grant (plan 045): the launcher sets PONEGLYPH_FACTORY on the `claude` process it
// starts for one ticket, and remote-git-gate reads it from its own env, which a hook inherits from
// Claude Code. The session cannot change its parent's env, and the gate denies any command that
// sets the variable, so a grant cannot be minted from inside a session.
//
// Strict on purpose: any doubt about a field means no grant, and the attended rules apply.

export interface Grant {
  ticket: string;
  branch: string;
  repo: string;
  expires: string;
}

const MAX_LIFETIME_MS = 24 * 60 * 60 * 1000;
const TICKET = /^[A-Z][A-Z0-9]+-\d+$/;
const REPO = /^[\w.-]+\/[\w.-]+$/;
// git check-ref-format, narrowed: no `..`, no `@{`, no control, space or `~^:?*[\`, no leading `-`
// or `+`, no trailing `/`, `.` or `.lock`.
const BAD_REF = /\.\.|@\{|[\s~^:?*[\\\x00-\x1f\x7f]|^[-+/.]|[/.]$|\.lock$|\/\//;
const SHARED_BRANCHES = new Set(["main", "master", "dev", "develop", "head"]);

// The ticket key as a whole token of the branch, any case: `feature/ABC-1`, `abc-1-fix`, never
// `feature/ABC-12`.
function namesTicket(branch: string, ticket: string): boolean {
  return new RegExp(String.raw`(?:^|[/_-])${ticket}(?:$|[/_.-])`, "i").test(branch);
}

/** The validated grant in `env`, or null. `now` is milliseconds since the epoch. */
export function factoryGrant(env: Record<string, string | undefined>, now: number): Grant | null {
  let raw: unknown;
  try {
    raw = JSON.parse(env.PONEGLYPH_FACTORY ?? "");
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const { ticket, branch, repo, expires } = raw as Record<string, unknown>;
  if (typeof ticket !== "string" || typeof branch !== "string" || typeof repo !== "string" || typeof expires !== "string") return null;
  if (!TICKET.test(ticket) || !REPO.test(repo)) return null;
  if (BAD_REF.test(branch) || SHARED_BRANCHES.has(branch.toLowerCase()) || !namesTicket(branch, ticket)) return null;
  const end = Date.parse(expires);
  if (Number.isNaN(end) || end <= now || end - now > MAX_LIFETIME_MS) return null;
  return { ticket, branch, repo, expires };
}
