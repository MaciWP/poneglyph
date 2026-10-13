// dock's own tool, which the generated MCP types only list once a saved session had it.
export {};
declare module "claude-code" {
  interface McpToolInputs {
    mcp__dock__actions: Record<string, unknown>;
  }
}
