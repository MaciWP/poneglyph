// Headless runs (`claude -p`, SDK, Agentic OS consultations) have nobody watching.
// Both variables are undocumented; a hook that depends on them must fail safe if they change.
export function isHeadlessSession(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CLAUDE_CODE_SESSION_ATTENDED === "0" || (env.CLAUDE_CODE_ENTRYPOINT?.startsWith("sdk") ?? false);
}
