# courier

Delivers Agentic OS (AOS) messages to the Claude session it runs in, as prompts of their own, without typing into the terminal.

## Install

The mod runs only where it is enabled. Poneglyph lists it in `.claude-plugin/marketplace.json`
and enables it with `"courier@poneglyph": true` under `enabledPlugins` in
`.claude/settings.machine.json`; after the sync, `claude plugin install courier@poneglyph`.
A session loads it at start, so sessions already open keep the held paste.

## How it works

- Starts one background loop per process on `session.start` (interactive sessions) and `session.attach` (desktop).
- Needs `AOS_URL` (loopback http only) and `AOS_AGENT_ID`. Without them it does nothing.
- The loop long-polls `/api/coordination/wait` (raced against 28 s), then reads `/api/coordination/inbox`. Every inbox read is a heartbeat: the server stops pasting into the session for 60 s.
- Delivery is one message at a time, oldest first:
  1. `claim` (a 409 means another taker, so it is skipped);
  2. `$.prompt.submit` with the sender, the text and the reply command;
  3. if the submit resolves, `ack`; on a `drop` or an error, `release` with the reason, then wait for the next `turn.complete` and retry.
- The heartbeat keeps running while a submit waits.
- Failures back off 30 s. The loop never throws.

## Tests

From this folder:

    claude plugin test

Native tests (`tests/native.test.ts`) run on the mods test kit and do not start a session.
