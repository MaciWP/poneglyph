import { expect, test } from "bun:test";
import { runEvalProcess } from "../process";

test("drains stderr and preserves a nonzero exit after partial output", async () => {
  const result = await runEvalProcess([process.execPath, "-e", 'console.log("partial"); process.stderr.write("x".repeat(100000)); process.exitCode=7;']);
  expect(result.stdout).toContain("partial");
  expect(result.error).toContain("exited 7");
});
test("bounds a silent child and reports timeout", async () => {
  const start = Date.now();
  const result = await runEvalProcess([process.execPath, "-e", "setInterval(()=>{},1000)"], undefined, 100);
  expect(result.error).toContain("timed out");
  expect(Date.now() - start).toBeLessThan(2000);
});
test("reports spawn errors and successful completion separately", async () => {
  expect((await runEvalProcess(["poneglyph-missing-program-777"])).error).toBeDefined();
  expect(await runEvalProcess([process.execPath, "-e", 'console.log("ok")'])).toEqual({ stdout: "ok\n" });
});

test("returns within the deadline when a descendant inherits output", async () => {
  const script = 'console.log("parent"); require("node:child_process").spawn(process.execPath,["-e","setTimeout(()=>{},1500)"],{stdio:"inherit",windowsHide:true}).unref();';
  const start = Date.now();
  const result = await runEvalProcess([process.execPath, "-e", script], undefined, 150);
  // Some hosts close inherited pipes when the direct child exits. Others wait
  // for the descendant. Both paths must return within the deadline.
  if (result.error) expect(result.error).toContain("timed out");
  else expect(result.stdout).toContain("parent");
  expect(Date.now() - start).toBeLessThan(1200);
});
