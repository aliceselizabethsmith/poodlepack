# devcrew — Claude Code guidance

This repo is a ChatDev-style multi-agent development pipeline that runs as a Claude Code Workflow,
with an optional kawaii Kauai "crew window" that animates the agents as poodles while they work.

## What it does

`/build-app "<spec>"` (or "run the build-app workflow to build ...") runs a crew of role-playing
agents through phases — Design → Code → Review → Fix → Test → Security → Docs — turning a one-line
spec into a working project under `projects/<name>/`.

## The cast (poodles)

Each role is a distinctly colored/sized poodle with a persona name and accessory:

| Role | Persona | Poodle |
|------|---------|--------|
| Architect (lead) | **Opal** 🌺 | large **black** standard poodle |
| Programmer | **Sylvie** 🏄 | mint surfer |
| Reviewer | **Starr** 🔍 | **black** standard poodle |
| Tester | **Ruby** 🌺 | reddish |
| Security | **Lucy** 🦉 | grey night-owl |
| Scribe | **Pearl** 🌙 | cream |

## The pipeline

The orchestration lives in `.claude/workflows/build-app.js`. It uses:

- A deliberate **barrier chain**, not a fan-out — phases are sequential and each depends on the full
  prior artifact. (The Code phase fans out one `agent()` per file in parallel.)
- Each `agent()` call is one poodle playing one role.
- Structured `schema` outputs pass clean data (file lists, review findings, test results, security
  findings) between phases.
- **Test phase**: Ruby writes tests, runs them (pytest / `npm test` via Bash), and a bounded fix loop
  (max 2 rounds) sends failures back to Sylvie until green.
- **Security phase**: Lucy runs real scanners when they fit (`bandit -r` for Python, `npm audit` for
  Node) plus an AI review, then high/critical findings go to Sylvie for a fix.

## The crew window (kawaii Kauai visualizer)

An Electron app in `viz/` that animates the build live. It is fully decoupled from the workflow —
they communicate only through files in `.devcrew/run/` (see `.devcrew/PROTOCOL.md`):

- The launcher writes `.devcrew/run/manifest.json` and opens the window **before** the crew starts.
- Each agent writes tiny `start`/`done` event JSON files into `.devcrew/run/events/` (the orchestration
  script is sandboxed and cannot write files itself — only its agents can).
- The window polls that folder and animates: the active poodle wiggles, a speech bubble pops, and a
  handoff token flies to the next poodle. A `status.json` of `done` triggers the confetti finale.

### Running a build WITH the window (the auto-launch ritual)

From the repo root, before invoking the workflow:

```bash
node viz/run-window.mjs start --spec "<the spec>"     # preps .devcrew/run, opens the window
# -> prints RUN_DIR=<abs path>
```

Then invoke the workflow passing BOTH the spec and the run dir so agents emit events:

```
Workflow build-app  with args { "spec": "<the spec>", "runDir": ".devcrew/run" }
```

When the workflow returns, close the loop so the window celebrates:

```bash
node viz/run-window.mjs status --state done --ok true
```

- **Headless (no window):** just run the workflow with a plain string spec — the event-emission
  blocks are skipped automatically when no `runDir` is passed.
- **Preview without spending a build:** `node viz/demo.mjs` opens the window and streams a scripted
  poodle build. Great for tweaking the art/animation.

### Calling it from any workspace

A global skill `poodlepack` (`~/.claude/skills/poodlepack/SKILL.md`) makes the crew callable from any
workspace, not just this repo. It runs the same ritual using absolute paths back here, so the window
launches from this install while the built project + run folder land in **whatever workspace the build
was invoked from** (`<cwd>/projects/<name>` and `<cwd>/.devcrew/run`). A global rule
(`~/.claude/rules/poodlepack.md`) tells Claude to suggest the crew for new multi-file scaffolding tasks.
When iterating on the workflow, still invoke it by `scriptPath` (not `name`) to avoid the cached copy.

### Gotcha: ELECTRON_RUN_AS_NODE

Claude Code (and other Electron hosts) set `ELECTRON_RUN_AS_NODE=1`, which makes any spawned Electron
run headless as plain Node — no window. The launch scripts strip it from the child env and spawn the
real `electron.exe` (resolved via `require('electron')`) directly, because spawning the `.cmd` shim
without a shell throws `EINVAL` on Windows. Keep both of those when editing the launchers.

## Working in this repo

- Built apps go in `projects/` (git-ignored by default — see `.gitignore`).
- To change the crew's behavior, edit the agent prompts in `build-app.js`.
- To add a phase, add an `agent()` call + a `meta.phases` entry with a matching title; if it's a new
  poodle, add it to `CAST` in `build-app.js` and to `CAST_STYLE` in `viz/renderer/app.js`.
- To restyle a poodle, edit `CAST_STYLE` (color/size/accessory) and `poodleSVG()` in
  `viz/renderer/app.js`.
- This is a personal hobby project — keep any work/employer data, internal project files, or
  cloud-synced work output out of it.

## Conventions

- Keep agent prompts explicit about the artifact they must return.
- Prefer one file per agent in the code phase so failures isolate cleanly.
- Keep the workflow runnable headless — never make a phase depend on the window being open.
