# dock

Buttons in the transcript that act on this machine. The model calls `mcp__dock__actions` with
1-6 items; each press runs one action of a fixed kind, through Agentic OS when it answers and a
macOS app otherwise.

| kind | Agentic OS running, path inside one of its places | Otherwise |
|---|---|---|
| `file {path, line?}` | `POST /api/code/reveal`: its code tile opens the file | `open -na $DOCK_EDITOR --args [--line N] path` |
| `folder {path}` | — | `open -na $DOCK_EDITOR --args path` |
| `terminal {cwd, harness?, prompt?}` | `POST /api/terminals {harness, location}` | shell: `open -a $DOCK_TERMINAL cwd`; agent: a Terminal.app window via `osascript` |
| `url {href}` | — | `open href` (http and https only) |
| `finder {path}` | — | `open -R path` |

## How a press decides

Under the buttons, one line per item shows whole where it goes (`Shell → shell en /repo`,
`Claude → claude en /repo · «prompt»`) before any press: the label is the model's, the target is
what runs. Agent prompts are capped at 500 characters so they show whole.

1. The path must exist and be the right kind (`$.fs.stat`): a folder for `terminal` and
   `folder`, a file for `file`. Terminal.app runs a file it is handed, so a terminal on a file is
   refused.
2. `GET $AOS_URL/api/terminals` (default `http://localhost:4317`, loopback only, 800 ms) on every
   press: Agentic OS is started and stopped during a session, so nothing is cached.
3. The path maps to the place with the longest folder that holds it. No place: the local app.
   A refused write or an Agentic OS without the reveal route: the local app too, with the reason
   on the button's line (`✓ PyCharm (AOS 404)`).
4. A reveal no dashboard received (`delivered: false`) opens `$AOS_URL` so the page picks it up.

Every argument reaches `argv`; nothing goes through a shell. The agent window's AppleScript
quotes the folder and the prompt itself (`quoted form of`), and the harness is one of four names.

## Configuration

| Variable | Default |
|---|---|
| `AOS_URL` | `http://localhost:4317` |
| `DOCK_EDITOR` | `PyCharm` (an app name for `open -a`; `--line` only for JetBrains IDEs) |
| `DOCK_TERMINAL` | `Terminal` (shells only; agent sessions use Terminal.app) |

## Where it runs

Interactive terminal sessions only: the actions run from the CLI's process (`$.process.run` is
CLI-only). Desktop, `-p` and the SDK get no tool and no context line.

## Load

Poneglyph's root `.claude-plugin/marketplace.json` lists the mod: enable `dock@poneglyph` in the
machine overlay and run `sync-poneglyph`.

## Verification

```sh
claude plugin validate plugins/dock
claude plugin test plugins/dock
bun test plugins/dock/tests/*.spec.ts
```

The tests prove the validation, the routing between Agentic OS and the local apps, the argv of
every action and the drawn buttons; they do not prove that a real app opens.
