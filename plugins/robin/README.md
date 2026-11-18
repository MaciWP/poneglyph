# Robin

Native Claude Code mod for the closing `ROBIN:` line every answer must end with (the output
style's canary: a missing line means the context degraded). It draws the line as a box in the
chat, checks each answer for the line and for its language, logs every turn and tells Claude
after a failed one. It owns the line on Claude: workboard no longer moves it, and the Stop hook
`security-gate.ts` stands down while this mod is enabled, installed and has written its log in
the last 7 days (`modWatchesCanary`), so a mod that never loads leaves the hook's canary on.

## Load

Poneglyph's root `.claude-plugin/marketplace.json` lists the mod. Enable `robin@poneglyph` in
the machine overlay, run `sync-poneglyph`, then `claude plugin install robin@poneglyph`. The
installed copy runs from `~/.claude/plugins/cache/poneglyph/robin/<version>`: a source change
needs a version bump, `claude plugin marketplace update poneglyph`, `claude plugin update
robin@poneglyph` and a new session.

## What it decides

At the end of each main-loop turn (`turn.complete`; subagents and interrupted turns are
ignored) it reads the final visible answer:

| Verdict | When | Box | Streak |
|---|---|---|---|
| `ok` | the last line, outside code and quotes and indented 3 spaces at most, is `ROBIN:` or `**ROBIN:**` (the hook took only the plain form) | green, the line moves into it | back to 0 |
| `miss` | no such line | red, «falta» | +1 |
| `wait` | no line, and the turn called Agent, Task, Monitor, ScheduleWakeup, Workflow or a background command that was not denied, or a task notification opened it | grey, «esperando» | unchanged |
| `skip` | empty answer, «No response requested.», or the turn ended in an error or refusal | none | unchanged |

An answer of 8+ words whose English stopwords outnumber the Spanish ones (code removed; the
rule of `turn-nudges.ts`, with `stopwordCounts` copied from `.claude/hooks/lib/language.ts` and
kept equal by `.claude/hooks/__tests__/robin-parity.test.ts`) fails as well, ROBIN line or not:
red box, «idioma». That hook warns mid-turn; this is the end-of-turn check, and both stay.

Two misses in a row (`LOST_AFTER`) mark the canary lost: the box adds «conviene /compact».

After a failed turn the next prompt carries one context line for Claude naming each cause (no
line, English, lost canary with the advice to propose `/compact`). Any other prompt gets nothing.

## Drawing

The box goes under the reply's last piece. A reply is found by its text, not by position: each
turn's answer is kept (the last 200) and a drawn message matches when the answer ends with it on
a line of its own. So interim messages get no box, a reply vista split around a table gets one
box on its last piece, and every turn keeps its own box through the redraw at each turn's end,
whatever the order of the mods. A reply is drawn with its box only after its turn ends.

The ROBIN line is drawn with the engine's `Markdown`, as a reply draws its text: its links open on
a click where the terminal takes hyperlinks, and its code spans lose their backticks. The box's
own lines («falta», «idioma», «conviene /compact») stay plain `Text`.

The box draws where `ui.render` reaches `AssistantMessage` with a viewport: the terminal, and
the desktop if it renders mod elements there (unverified). `-p` gets the log and the context
line only.

## Log

`~/.cache/poneglyph/robin/<session>.jsonl`, one row per checked turn:
`{ at, session, turnId, verdict, lang, es, en, words, streak, lost, fail }`. After `/clear` or a
resume the session id changes with no `session.start`: the next turn switches file and takes the
streak from that file's last row, as does a restarted process.

## Tests

```sh
bun test ./plugins/robin/tests/core.spec.ts ./.claude/hooks/__tests__/robin-parity.test.ts
claude plugin test plugins/robin   # native.test.ts: bun cannot load claude-code/testing
```
