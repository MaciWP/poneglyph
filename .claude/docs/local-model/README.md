# Local model — Qwen3.8-27B on an RTX 5090

Measured evidence for the free local co-worker. The **live launchers stay outside this
repo** (`D:\llama.cpp\serve-qwen.cmd`, `D:\llama.cpp\claude-local.cmd`) because they are
Windows batch files with absolute `D:\` paths and this tree is multi-OS. The `.snapshot`
files here are a dated copy for disaster recovery. `sync-claude` links the whole `docs/`
tree, so they do travel to `~/.claude/docs/` on every machine — but they are a snapshot,
never the live launcher: if `D:\llama.cpp\serve-qwen.cmd` changes, this copy goes stale
silently.

| | Value |
|---|---|
| Hardware | RTX 5090, 32 GB VRAM (`sm_120`) |
| Runtime | llama.cpp b10588, `llama-server.exe` |
| Endpoint | `http://127.0.0.1:8080` — OpenAI **and** native Anthropic (`/v1/messages`) |
| Safe VRAM ceiling | **≤30,5 GB**. Overflow is SILENT: it spills to RAM and drops to 6-25 tok/s with no error |
| Snapshot date | 2026-08-23 (initial setup; sections below carry their own later measurement date where it differs) |

## Quality — measured with KL-divergence, not vibes

Base = `Qwen3.8-27B-Q8_0` (same BF16 lineage, ~99,8% of the original). 32K tokens per
corpus, `llama-perplexity --kl-divergence`, two corpora: wikitext-2 (comparable with the
community) and a Python-stdlib corpus (the real use case).

| Quant | PPL wiki | PPL code | top-1 agreement (code) | Status |
|---|---|---|---|---|
| `Q6_K_XL` | +0,004% | +0,13% | 98,2% | deleted — Q5 covers it. Re-downloadable, but it does **not** fit with 128K ctx: serve it at 64K and without vision (30,3 GB) |
| `Q5_K_XL` | +0,08% | +0,65% | 96,6% | **default per this table** — quality + 128K ctx + vision. ⚠️ the setup commit says Q4 is the default (26,8 GB vs Q5's 31,8 GB, over the 30,5 GB ceiling above) — reconcile against what `serve-qwen.cmd` actually loads before trusting either |
| `Q4_K_XL` | +0,08% | +2,1% | 94,9% | balance |
| `NVFP4-HIGHEST` | +1,4% | +9,5% | 90,6% | deleted — dominated by Q4 on every axis |
| `NVFP4-HIGH` | +4,8% | **+16,7%** | 87,8% | speed only — differs on 1 token in 8 |

A pass/fail mini-eval of 8 executable code tasks scored **8/8 on every quant** and has no
resolution for this. KL-divergence is what exposed the loss. Do not re-run pass/fail
evals to answer a quantization question.

## Speed — greedy decoding, GPU otherwise idle, mean of 2-3

| Config | Short output | Long output (~2K tok) |
|---|---|---|
| Q5, no speculative | 59,2 | — |
| Q4, no speculative | 70,7 | — |
| NVFP4, no speculative | 72,7 | — |
| Q5 + MTP drafter n8 | 190,6 | ~177 |
| Q4 + MTP drafter n8 | 210,2 | ~200 |
| NVFP4 + MTP drafter n6 | 251,9 | 216,0 |
| **NVFP4 + MTP drafter n10** | **251,8** | **256,6** |

Non-obvious findings:

- **`--temp 0` is the dominant factor**, not the quant: drafter acceptance goes from 24%
  to 81%, i.e. 90,8 → 216,0 tok/s. For greedy code generation it is also the *better*
  quality choice, not a concession.
- **Optimal `--spec-draft-n-max` depends on output length and on the format**: K-quants
  (Q4/Q5/Q6) → **n8**; NVFP4 → **n10**. On long output, acceptance drops (68% at n10) but
  drafter parallelism more than compensates. n12 is already a plateau (252,7).
- Reserving 128K of context costs no throughput — hybrid attention, only 16 of 64 layers
  carry a KV cache.
- With `reasoning_effort: low` and a small `max_tokens`, the model can spend the whole
  budget thinking and return **empty content**. Always send ≥1200.
- Measure with the GPU idle. An open game invalidated an entire measurement round.

## Claude Code against the local model (verified 2026-08-23)

`llama-server` b10588 serves the **native Anthropic API**, so no proxy is needed. Claude
Code inherits the full Poneglyph layer for free — it reads `~/.claude/`, which is already
a symlink into this repo, so there is **no new sync to maintain**.

Verified: two tool-calling tasks answered correctly in 31 s with Q5, and with the full
doctrine loaded (~16,2K tok: 32 skill frontmatters + CLAUDE.md + output style + rules) the
model still obeyed the house style — Spanish, conclusion first, and a markdown table with
`R1…` refs where the style mandates one.

What it costs:

| Trade-off | Detail |
|---|---|
| `CLAUDE_CODE_MAX_CONTEXT_TOKENS=131072` is **mandatory** | Claude Code does not recognize `qwen3.8-27b`, assumes a 200K window, and would not auto-compact before overflowing the server's real 128K |
| claude.ai connectors are disabled | Setting `ANTHROPIC_BASE_URL` takes precedence over the claude.ai login: no Jira/Atlassian, Figma, Notion, Microsoft 365 in that session |
| The advisor is disabled | The model has no rank in the model catalog |
| Whole-session switch | It is one model or the other; you cannot mix a frontier model for thinking and the local one for execution in a single conversation |
| ~25-30K of system prompt | Leaves ~100K of working context out of 128K |
| Unrecognized model ID (CC ≥2.1.233/2.1.251) | `claude -p` prints `[claude-code:unrecognized_model]` to stderr (informational); and the default commit trailer becomes `Co-Authored-By: Claude Code` — neutralized by `attribution.commit/pr = ""` in `settings.global.json` (audit 010) |

## Dead ends — do not repeat

| Attempt | Why it failed |
|---|---|
| The NVFP4 GGUF's **embedded MTP** | Worse than the separate drafter: 194 vs 252 tok/s. Ignore it and load Unsloth's separate drafter |
| **DFlash2** as drafter | The `incoai` and `z-lab` GGUFs are the same conversion (byte-identical) and b10588 rejects both: `wrong number of tensors; expected 81, got 58` |
| **EAGLE-3** | A drafter exists for Qwen3.6, not for 3.8 |
| **ik_llama.cpp** | Wins on multi-GPU; on single-GPU with UD quants the official build is faster |
| `--spec-draft-p-min 0.10` | Sinks throughput 36% |
| `GGML_CUDA_GRAPH_OPT=1` | +0,8% here. The published +27% was measured on a **MoE** (gpt-oss-20b) and comes from TopK-MoE fusion; this model is dense |
| `--spec-draft-n-max 12` with Q5 | Collapses to 93 tok/s |
| vLLM / SGLang | `sm_120` does not inherit datacenter Blackwell's FP4/FP8 kernels |
| LM Studio | Its bundled runtime lags llama.cpp by hundreds of builds and broke this model silently |

## Reproducing a measurement

The measurement scripts live in `D:\llama.cpp\_medir-*.py` and `_eval-codigo.py` (not
versioned). The KL logits are ~16 GB in `D:\llama.cpp\_kl\`; keeping them turns a re-run
from ~12 min into ~2 min.

## Pi as the harness (set up and verified 2026-08-23)

[Pi](https://pi.dev) 0.84.2 is the better harness for this model: its system prompt is
under 1K tokens against Claude Code's ~25-30K, which leaves the whole context window for
work and gives a 27B far less stratified instruction to ignore. Measured on a comparable
task: **Pi 17 s vs Claude Code 31 s**.

Install (Windows, no Node needed — it runs on bun despite declaring `node>=22.19.0`):

```bash
bun add -g --ignore-scripts @earendil-works/pi-coding-agent
```

Do **not** use the `curl … | sh` / `irm … | iex` installers the site offers — remote
script execution is the risk class this repo blocks in `permissions.deny`.

### Why a custom provider and not Pi's native `llama.cpp` one

Pi's `docs/llama-cpp.md` assumes **router mode** (`llama-server` started *without* `-m`,
with `--models-dir`). `serve-qwen.cmd` is single-model on purpose — router mode would
sacrifice the MTP drafter, `--temp 0` and the `q8_0` KV cache, i.e. everything the speed
table above was won with. So the endpoint is registered as a **custom provider** in
`~/.pi/agent/models.json`:

```json
{
  "providers": {
    "qwen-local": {
      "name": "Qwen3.8-27B local (RTX 5090)",
      "baseUrl": "http://127.0.0.1:8080/v1",
      "api": "openai-completions",
      "apiKey": "local",
      "authHeader": true,
      "compat": { "supportsDeveloperRole": false, "supportsReasoningEffort": false },
      "models": [{
        "id": "qwen3.8-27b", "name": "Qwen3.8-27B (local, gratis)",
        "reasoning": true, "input": ["text", "image"],
        "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
        "contextWindow": 131072, "maxTokens": 8192,
        "samplingParams": { "temperature": 0 }
      }]
    }
  }
}
```

`api` **must** be `openai-completions`: only the OpenAI-shaped APIs apply
`samplingParams`, and `temperature: 0` is the single most important setting for this
model's throughput. The Anthropic-shaped `/v1/messages` endpoint works (tool calling
verified) but would silently drop it.

### Doctrine, with zero maintenance

`~/.pi/agent/APPEND_SYSTEM.md` is a **symlink** to `.claude/system-prompts/poneglyph-sp.md`
in this repo, so editing the output style and re-running `sync-claude` updates Pi with no
extra step. Use `APPEND_SYSTEM.md`, never `SYSTEM.md` — the latter *replaces* the default
prompt and loses the dynamic tool list and tool guidelines.

Pi also reads `AGENTS.md` and `CLAUDE.md` natively, so working inside a repo picks up the
project doctrine for free. Verified: asked for three risks in Spanish, it answered with a
markdown table carrying `R1…R3` refs, exactly as the house style mandates.

The 32 Poneglyph skills are deliberately **not** linked into `~/.pi/agent/skills/` — their
frontmatter alone is ~8K tokens, which would undo the reason for choosing Pi. Load one
on demand with `--skill <path>` instead.

### Two servers on the same port silently cost you 3x throughput

Measured 2026-08-24. Two `llama-server` processes were left running, **both bound to
:8080** (14,2 GB and 18,8 GB of working set). Windows does not refuse the second bind, so
there is no error anywhere — requests get split between them and they fight over VRAM:

| | Throughput (long output) | VRAM |
|---|---|---|
| Two instances on :8080 | **74,8 tok/s** | 31,338 MiB — above the 30,5 GB ceiling |
| One instance | **236,5 tok/s** | 26.665 MiB |

Before trusting any measurement, check the instance count:

```powershell
Get-Process llama-server | Select-Object Id, StartTime
netstat -ano | Select-String ":8080.*LISTENING"
```

This is the same failure class as measuring with a game open, and it is *harder* to spot:
nothing warns you, and the model answers correctly the whole time — just slowly.

### Reasoning effort: only four of the six levels work

Measured 2026-08-24 against the running server (`temperature: 0`, `seed: 42`, so a changed
output hash proves the parameter actually reached the model):

| `reasoning_effort` | completion tokens | thinking chars | output hash |
|---|---|---|---|
| not sent | 190 | 425 | `84a4c0967e` |
| `minimal` | **HTTP 500** | — | — |
| `low` | 190 | 425 | `84a4c0967e` — identical to "not sent" |
| `medium` | 201 | 445 | `2d18bfe607` |
| `high` | 131 | 384 | `fa5c54e902` |
| `xhigh` | 249 | — | works |
| `max` | **HTTP 500** | — | — |

Three non-obvious results:

- **`minimal` and `max` return HTTP 500** with Qwen3.8's chat template. They are mapped to
  `null` in pi's `thinkingLevelMap` so pi never offers them; sending either crashes the
  request.
- **`low` is byte-identical to sending nothing** — it is exactly the server's own
  `--reasoning-effort low` default.
- **More effort does not mean more tokens**: `high` produced *fewer* completion tokens (131)
  than `medium` (201). Do not assume a monotonic cost curve for this model.

pi's config: `compat.supportsReasoningEffort: true`, `defaultThinkingLevel: "medium"` in
`~/.pi/agent/settings.json`, and `thinkingLevelMap` mapping `low/medium/high/xhigh` to
themselves with `minimal`/`max` as `null`.

### Skill descriptions: keywords live in `metadata`, not `description`

Done separately, in `cdcb1fb` (not part of this Pi setup commit — cross-referenced here
because it's what makes the 1024-char skill limit tolerable on Pi). The `Keywords -` blocks
used to sit inside `description: |`, which pushed three skills past pi's 1024-character
limit and injected ~1,5K tokens of keyword soup into the system prompt of **both**
harnesses. They now live in `metadata.keywords`.

Nothing was lost: `skill-activation.ts` matches `/Keywords\s*-\s*([\s\S]*?)(?=\n\S|$)/i`
against the whole header, not against `description`, so it still reads them. Longest
description is now 814 chars (`ui-design`), down from 1110.

One skill (since moved to the private company plugin) needed hand-holding: it had **no key after `description`**, so a
naive insert appended `metadata:` onto the last line of the prose instead of a new line.

### Orca

Orca already manages Pi: it installs three `@orca-managed-pi-extension` files
(`orca-agent-status.ts`, `orca-prefill.ts`, `orca-titlebar-spinner.ts`) and three skills
(`computer-use`, `orca-cli`, `orchestration`) under `~/.pi/agent/`. **Do not edit those —
Orca regenerates them.** Pi's `settings.json` pins `defaultProvider: qwen-local`, so a
bare `pi` — which is how Orca launches it — already goes to the local model.

### Internet (Pi) — DuckDuckGo, no keys

Qwen has no hosted search. Pi gets two tools from a local install of
[pi-mini-web-research](https://github.com/pablomarti/pi-mini-web-research) (MIT),
plus a thin skill at `~/.pi/agent/skills/web-research/SKILL.md`.

| Tool | Backend |
|---|---|
| `web_search` | DuckDuckGo Lite first; if DDG is empty/blocked, Brave Search HTML (still no API key) |
| `web_fetch` | Python 3 stdlib; HTML→text; 12k chunks; 24h cache |
| `github` | `gh` CLI |

The live copy is `~/.pi/vendor/pi-mini-web-research` (not this git tree). Windows
patches vs upstream: (1) call `python`, not the Store stub `python3`; (2) HTTP via
`curl.exe`/Schannel so AV MITM certs match Chrome; (3) drop DDG ads; (4) empty DDG
HTML is an error (`ddg_empty`), not `{results:[]}` — otherwise the model retries
forever. Do not `pi install git:…` over that path without re-applying the patches.

SSRF: `web_fetch` denies localhost / RFC1918 / cloud metadata unless
`PI_WEB_RESEARCH_ALLOWLIST` says otherwise. curl follows redirects only after each
`Location` is re-validated.

Honest limit: DDG Lite scraping breaks when their markup changes; JS-heavy shop pages
and bot walls (TechPowerUp) often come back empty. Depth is Qwen looping search→fetch,
not a crawler.
`ponytail: DDG only, upgrade trigger = a free Tavily account to swap search only.`
