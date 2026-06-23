# Dev Crew event protocol

The build-app workflow and the kawaii Kauai visualizer are decoupled. They talk only
through files in a fixed **run folder** at the repo root: `.devcrew/run/`.

```
.devcrew/run/
  manifest.json        written once by the launcher before the crew starts
  events/              one JSON file per beat, written by crew agents
    0001-leilani-start.json
    0001-leilani-done.json
    0002-kai-start.json
    ...
  status.json          updated at end of run (launcher) -> { "state": "done" | "error" }
```

Why files: the Workflow orchestration script runs sandboxed (no filesystem, no window).
Only the agents it spawns can write, and the visualizer is a separate Electron process.
A shared folder is the only thing both sides can reach.

## manifest.json

Written by the launcher (Claude main loop) before the build, so the window can draw the
scene before any agent runs.

```json
{
  "spec": "a CLI tool that converts CSV to a Markdown table",
  "projectName": null,            // filled in by Leilani's first event once known
  "startedSeq": 0,
  "cast": [
    { "role": "architect", "persona": "Opal",   "emoji": "🌺", "color": "#22222a" },
    { "role": "coder",      "persona": "Sylvie",    "emoji": "🏄", "color": "#7bdcb5" },
    { "role": "reviewer",   "persona": "Starr",  "emoji": "🔍", "color": "#2b2b34" },
    { "role": "tester",     "persona": "Ruby",   "emoji": "🌺", "color": "#d96b63" },
    { "role": "security",   "persona": "Lucy",   "emoji": "🦉", "color": "#9aa0b5" },
    { "role": "scribe",     "persona": "Pearl", "emoji": "🌙", "color": "#ffd166" }
  ],
  "phases": ["Design", "Code", "Review", "Fix", "Test", "Security", "Docs"]
}
```

## event files

One JSON object per file. Filename: `<seq4>-<role>-<kind>.json` where `seq4` is the
zero-padded sequence the orchestrator assigns (controls ordering), `role` is the cast
role, `kind` is `start` | `done`. Each file is written once and never modified, so
parallel coders never collide and the watcher never reads a half-written file twice.

```json
{
  "seq": 2,                       // ordering hint; window sorts by (seq, filename)
  "role": "coder",
  "persona": "Sylvie",
  "phase": "Code",
  "kind": "start",                // "start" when the agent begins, "done" when finished
  "bubble": "Got the design — paddling out to code src/main.py! 🏄",
  "to": "reviewer",               // optional: who this beat hands off to (draws an arrow)
  "file": "src/main.py",          // optional: the artifact this beat concerns
  "ok": true                      // optional, on "done": did the work succeed (tests pass, etc.)
}
```

### Rules for agents
- Write a `start` event the moment you begin, then do the work, then write a `done` event.
- Keep `bubble` short (one sentence), in-character, kawaii-friendly. This is the speech bubble.
- Never edit or delete an existing event file. Only ever create new ones.
- Write events into the run folder's `events/` directory using the path the orchestrator gives you.
