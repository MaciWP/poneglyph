// Tests that spawn git or bun take 1-2 s alone and passed 5 s (bun's default) when other sessions loaded the
// machine. Each such file calls setDefaultTimeout with this. bunfig.toml [test] timeout is ignored by bun 1.4.
export const SPAWN_TEST_TIMEOUT_MS = 15_000;
