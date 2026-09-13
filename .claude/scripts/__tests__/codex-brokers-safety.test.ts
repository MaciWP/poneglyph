import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as brokers from "../codex-brokers";

describe("broker shutdown boundary", () => {
  it("rejects invalid PIDs and non-local endpoints before probing processes", () => {
    const root = mkdtempSync(join(tmpdir(), "broker-invalid-"));
    for (const [index, state] of [
      { pid: 0, endpoint: "pipe:test" },
      { pid: -1, endpoint: "pipe:test" },
      { pid: "12", endpoint: "pipe:test" },
      { pid: process.pid, endpoint: "tcp:example.com:80" },
      { pid: process.pid, endpoint: "pipe:relative" },
    ].entries()) {
      mkdirSync(join(root, String(index)));
      writeFileSync(join(root, String(index), "broker.json"), JSON.stringify(state));
    }
    expect(brokers.readBrokers(root)).toEqual([]);
  });

  for (const response of ["ack", "error", "wrong-id", "close", "silent"]) {
    it(`handles ${response} without signalling the PID`, async () => {
      const path = process.platform === "win32"
        ? `\\\\.\\pipe\\poneglyph-test-${process.pid}-${crypto.randomUUID()}`
        : join(tmpdir(), `broker-${crypto.randomUUID()}.sock`);
      const server = createServer(socket => {
        socket.on("error", () => {});
        socket.once("data", data => {
          expect(JSON.parse(data.toString()).method).toBe("broker/shutdown");
          if (response === "ack") socket.end('{"id":1,"result":{}}\n');
          if (response === "error") socket.end('{"id":1,"error":{"message":"no"}}\n');
          if (response === "wrong-id") socket.end('{"id":2,"result":{}}\n');
          if (response === "close") socket.end();
        });
      });
      await new Promise<void>(resolve => server.listen(path, resolve));
      try {
        const start = Date.now();
        const result = await brokers.requestShutdown(`${process.platform === "win32" ? "pipe" : "unix"}:${path}`, 100);
        expect(result).toBe(response === "ack");
        expect(Date.now() - start).toBeLessThan(1500);
      } finally {
        await new Promise<void>(resolve => server.close(() => resolve()));
      }
    });
  }
});
