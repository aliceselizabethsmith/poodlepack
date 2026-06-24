# PoodlePack event protocol

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
  "bubble": "Implementing generator.py using the secrets module for secure RNG.",
  "to": "reviewer",               // optional: who this beat hands off to (draws an arrow)
  "file": "src/main.py",          // optional: the artifact this beat concerns
  "ok": true                      // optional, on "done": did the work succeed (tests pass, etc.)
}
```

### Rules for agents
- Write a `start` event the moment you begin, then do the work, then write a `done` event.
- Keep `bubble` to one short, factual status line (file, approach, counts, result). Not cute — a
  developer should be able to read it and know exactly what happened.
- Never edit or delete an existing event file. Only ever create new ones.
- Write events into the run folder's `events/` directory using the path the orchestrator gives you.

## questions & answers (interactive pop-out)

A poodle (currently only Opal, during Design) may pause to ask the user a question. This is the one
place data flows back from the window to an agent.

1. The agent writes a question file `questions/<id>.json`:
   ```json
   { "id": "q1", "persona": "Opal", "role": "architect",
     "text": "Should this be a CLI or a web app?", "options": ["CLI", "Web app"] }
   ```
2. The window pops a modal with the options as buttons plus a free-text box. When the user answers,
   the Electron main process writes `answers/<id>.json`:
   ```json
   { "id": "q1", "answer": "CLI" }
   ```
3. The agent polls for `answers/<id>.json` (Bash loop, ~3-minute timeout) and incorporates the answer.
   On timeout it proceeds with a sensible default. So a missed question never hangs the build.
