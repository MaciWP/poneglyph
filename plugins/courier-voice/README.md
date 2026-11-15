# courier-voice

Draws the Agentic OS messages that [courier](../courier) delivers as a violet box in the chat.

## Install

Poneglyph lists it in `.claude-plugin/marketplace.json` and enables it with
`"courier-voice@poneglyph": true` under `enabledPlugins` in `.claude/settings.machine.json`; after
the sync, `claude plugin install courier-voice@poneglyph`. A session loads it at start.

## Why a mod of its own

Claude Code raises a row's `UserMessage` render site beneath the frame of the plugin that submitted
the row, and runs none of that plugin's hooks there (`re-entry`; the `.catch` handler is not asked
either). Courier submits its messages with `$.prompt.submit`, so it can never draw them. This mod
draws only rows stamped `origin {kind: "plugin", name: "courier"}` (the engine's stamp, never a text
prefix); every other row keeps Claude Code's drawing.

## In the chat

- Folded: one violet (`permission`) box, `Agentic OS · <sender> · <first line>`, without the header
  or the reply line. The sender is the agent's name, `tú` for the user, or the id's first 8
  characters while no name is known.
- Expanded (`isExpanded`: ctrl+o, and also a short body under the engine's «Prompt from the courier
  plugin» label): the box holds the whole message.
- The engine's dim «Prompt from the courier plugin» label stays above the box; it is drawn outside
  the render site.
- Names come from `GET /api/coordination` (Agentic OS, loopback `AOS_URL` only): read at the start
  of an interactive session and when a row names a sender not looked up yet; a failed read waits 30 s.

## Tests

From the repo root:

    bun test ./plugins/courier-voice/tests/core.spec.ts
    claude plugin test plugins/courier-voice
