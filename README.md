# PoodlePack 🐩🌺

**Watch your [Claude Code](https://docs.claude.com/en/docs/claude-code) agents work as a pack of poodles. Pass complex dev tasks through the Poodle Pipeline.**

PoodlePack is a pair of little Electron windows that make Claude Code's multi-agent work *visible* and *fun*. It has two modes:

- **🐾 Watch (the Kennel)** — a live dashboard that auto-opens whenever you fire **background agents**, drawing one poodle per agent with what it's doing right now, a scrolling activity log, and a confetti celebration when each finishes. It reads Claude Code's own transcripts — nothing is sent anywhere.
- **🏗️ Build (the Crew)** — a ChatDev-style pipeline where a crew of six named poodles take a one-line spec through **design → code → review → fix → test → security → docs**, animated live.

<!-- TODO before publishing: add a looping GIF here (Watch mode in demo, ≤15s). -->
<!-- ![PoodlePack](docs/poodlepack.gif) -->

---

## Quickstart

```bash
git clone https://github.com/aliceselizabethsmith/poodlepack.git
cd poodlepack/viz
npm install          # pulls Electron (git-ignored, so this is required once)
```

Then try the **demo** — no Claude Code needed, it plays a scripted build/watch loop:

```bash
node demo.mjs                              # the Build crew, scripted end-to-end
DEVCREW_DEMO=1 node monitor-window.mjs start   # the Watch kennel, scripted agents
```

---

## 🐾 Watch mode (the Kennel)

Point it at your real Claude Code session and it shows every **background** agent as a poodle:

```bash
node viz/monitor-window.mjs start    # from the repo root
```

It scans `~/.claude/projects/**/subagents/agent-*.jsonl` (Claude Code's own transcripts) and renders a live poodle per active agent — current action in a speech bubble, a scrolling chat log, dust kicked up while working, a confetti burst on finish, and a sleepy beach when the kennel's idle. It auto-fits up to 16 agents.

### Auto-launch on background agents

The whole point of the Kennel is that you don't open it — it appears when agents start. That's a Claude Code **`PostToolUse` hook** on the `Agent` tool. On Windows, add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      { "matcher": "Agent", "hooks": [
        { "type": "command", "command": "node \"<path-to>/poodlepack/viz/monitor-window.mjs\" ensure" }
      ] }
    ]
  }
}
```

`ensure` is idempotent (a lockfile prevents a second window). On macOS/Linux, point the command at `node` the same way.

---

## 🏗️ Build mode (the Crew)

The Build pipeline runs **inside Claude Code** as a [Workflow](https://docs.claude.com/en/docs/claude-code). Open this repo in Claude Code and ask:

```
Run the build-app workflow to build: "a CLI that converts CSV to a Markdown table"
```

A crew of poodles hands the work down the line, each phase producing a concrete artifact for the next:

| Role | Poodle | Phase |
|------|--------|-------|
| Architect | **Opal** 🌺 (black standard) | Design → `architecture.md` |
| Programmer | **Sylvie** 🏄 (mint) | Code → `src/*` (one file per poodle, in parallel) |
| Reviewer | **Starr** 🔍 (black, haloed) | Review → findings |
| Tester | **Ruby** 🌺 (red) | Test → writes + runs tests, bounded fix loop |
| Security | **Lucy** 🦉 (grey) | Security → `bandit` / `npm audit` + AI review |
| Scribe | **Pearl** 🌙 (cream) | Docs → `README.md` |

Built apps land in `projects/<name>/`. To launch it **with the live window** from any workspace, install the global `/poodlepack` skill (see `~/.claude/skills/poodlepack/`).

---

## Requirements

- **Node 18+** and **Electron** (installed by `npm install` in `viz/`).
- **ffmpeg** (optional) — the gentle Hawaiian music + completion chime play through `ffplay`. No ffmpeg? It stays silent and everything else works.
- **Claude Code** — for real (non-demo) use: Watch reads its transcripts, Build runs as one of its Workflows.

## Platform support

Developed on Windows. Audio and the launch scripts are cross-platform (`viz/audio.js` routes through `ffplay` and no-ops without it), but the auto-launch hook example and a couple of helper paths are Windows-first — macOS/Linux users may need to adapt the `taskkill`/PowerShell bits. PRs welcome. 🐩

## How it works

Both windows are **fully decoupled** from the work — they communicate only through files:

- **Watch** tails Claude Code's subagent transcript `.jsonl` files and derives each agent's task/action/state.
- **Build** agents write tiny `start`/`done` event JSON files into `.devcrew/run/events/`; the window polls and animates them (see [`.devcrew/PROTOCOL.md`](.devcrew/PROTOCOL.md)).

### Note: `ELECTRON_RUN_AS_NODE`
Claude Code (and other Electron hosts) set `ELECTRON_RUN_AS_NODE=1`, which makes a spawned Electron run headless as plain Node — no window. The launch scripts strip it from the child env and spawn the real `electron` binary directly. Keep that if you edit them.

## Credits & license

Art is original (inline SVG + CSS). Music is the public-domain "Aloha ʻOe" — see [CREDITS.md](CREDITS.md). Code is [MIT](LICENSE).

🤖 Built with [Claude Code](https://claude.com/claude-code).
