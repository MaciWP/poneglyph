import { expect, test } from "bun:test";
import { classifySettingsValidation, statusExitCode } from "../sync-claude";
import { statusFromSyncOutput } from "../doctor";

test("an unexplained doctor failure cannot prove acceptance", () => {
  const verdict = classifySettingsValidation("unexpected CLI failure", 7, "/tmp/settings.json");
  expect(verdict.skipped).toContain("exited 7");
  expect(statusExitCode(verdict)).toBe(2);
});
test("uncertainty reaches the shared summary without masking broken links", () => {
  const warning = "🟢 linked\n🟡 settings.json: not validated — timeout";
  expect(statusFromSyncOutput(warning, 2)).toBe("🟡");
  expect(statusFromSyncOutput(warning + "\n🔴 missing link", 2)).toBe("🔴");
  expect(statusFromSyncOutput("unrelated error", 2)).toBe("🔴");
  expect(statusFromSyncOutput("🟢 linked", 0)).toBe("🟢");
});
