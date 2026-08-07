---
name: poodlepack
description: Summon the PoodlePack crew to build a small standalone app/tool/script from a one-line spec — a multi-agent pipeline (design → code → review → fix → test → security → docs) with a live animated window. Triggered by "poodlepack", "poodle pack", "build-app", "build an app", "scaffold a tool/script", "use the crew", or "summon the poodles". Works from ANY workspace; output lands in the current workspace.
---

# PoodlePack — global build-pipeline launcher

Runs the poodle crew that turns a one-line spec into a working project under `projects/<name>/`.
This is the **Build** half of PoodlePack. The **Watch** kennel (the window that shows live
background agents as poodles) auto-launches on its own via a `PostToolUse` hook whenever a
background agent starts, so it is not invoked here.

## Install

Copy this folder to `~/.claude/skills/poodlepack/` so `/poodlepack` works from any workspace:

```bash
# macOS / Linux
mkdir -p ~/.claude/skills && cp -r skills/poodlepack ~/.claude/skills/

# Windows PowerShell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills" | Out-Null
Copy-Item -Recurse -Force skills\poodlepack "$env:USERPROFILE\.claude\skills\"
```

Then set `POODLEPACK_HOME` below to your clone path.

## POODLEPACK_HOME

**Replace this with the absolute path to your PoodlePack clone**, then use it everywhere below:

```
POODLEPACK_HOME = /absolute/path/to/poodlepack
```

Quote it in every command — the path may contain spaces (a cloud-synced folder often does).
Verify before running:

```bash
ls "$POODLEPACK_HOME/viz/run-window.mjs" && echo "found PoodlePack" || echo "clone it first"
```

If Electron is missing, install it once (it is git-ignored, so a fresh clone always needs this):

```bash
npm --prefix "$POODLEPACK_HOME/viz" install
```

## The cast (for the window and when narrating)

Opal (architect, black poodle, leads and asks clarifying questions), Sylvie (programmer),
Starr (reviewer, black poodle with a halo), Ruby (tester, red), Lucy (security), Pearl (scribe, cream).

## How to run it, with the live window

Run every shell command from the user's CURRENT workspace. Do not `cd` — the output and the run
folder should land in the workspace they are actually working in.

1. **Open the window and prepare the run folder:**
   ```bash
   node "$POODLEPACK_HOME/viz/run-window.mjs" start --spec "<the one-line spec>"
   ```
   Prints `RUN_DIR=<abs path>` (it is `<current workspace>/.devcrew/run`) and opens the window.

2. **Run the crew** through the **Workflow tool**, not bash. Use `scriptPath`, never `name` — the
   named form can run a stale cached copy:
   ```
   Workflow({ scriptPath: "<POODLEPACK_HOME>/.claude/workflows/build-app.js",
              args: { spec: "<the one-line spec>", runDir: ".devcrew/run" } })
   ```
   The crew animates live. Opal may open a modal asking a clarifying question (CLI or web, for
   instance) and the answer genuinely drives the design. The console closes itself a few seconds
   after the finale.

3. **When the workflow returns, fire the finale:**
   ```bash
   node "$POODLEPACK_HOME/viz/run-window.mjs" status --state done --ok true
   ```

**Headless (no window):** skip steps 1 and 3 and pass a plain spec string (`args: "<spec>"`).
Event emission auto-skips when no `runDir` is given.

**Preview without spending a build:** `node "$POODLEPACK_HOME/viz/demo.mjs"`.

## Where things land

- Built app: `<current workspace>/projects/<name>/`
- Run artifacts: `<current workspace>/.devcrew/run/`, regenerated each build

If the current workspace is a git repo and these should not be committed, add `projects/` and
`.devcrew/run/` to its `.gitignore`. Offer that before the first run in a new workspace.

## Gotchas

- The window needs Electron installed once: `npm --prefix "$POODLEPACK_HOME/viz" install`.
- The launch scripts strip `ELECTRON_RUN_AS_NODE` and spawn the `electron` binary directly, so a
  real window opens even from inside an Electron host. Keep that if you edit them.
- On Windows, audio uses the built-in .NET MediaPlayer. On macOS and Linux the music and chime play
  through `ffplay` (ffmpeg); without it audio is a silent no-op and everything else still works.
- See `.devcrew/PROTOCOL.md` for the event and question file contract.
