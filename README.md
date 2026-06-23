# devcrew

A ChatDev-style multi-agent development pipeline that runs **natively inside Claude Code** — no servers, no extra API keys, runs on Opus.

Inspired by [OpenBMB/ChatDev](https://github.com/OpenBMB/ChatDev): you give it a one-line description of what you want built, and a crew of role-playing agents hand the work down a pipeline:

```
/build-app "a CLI tool that converts CSV to a formatted Markdown table"

  Phase 1  Design    → architecture.md   (CTO: language, structure, files)
  Phase 2  Code      → src/*             (Programmer: writes each file)
  Phase 3  Review    → findings          (Reviewer: bugs, quality, gaps)
  Phase 4  Fix       → src/* (revised)   (Programmer: applies fixes)
  Phase 5  Docs      → README.md         (Doc writer: usage + manual)
```

Each phase ends with a concrete artifact that becomes the input to the next phase — the same "specialized seminar" idea ChatDev uses, expressed as a Claude Code [Workflow](https://docs.claude.com/en/docs/claude-code).

## How to run it

> **Run it with the devcrew folder open as your workspace.** The crew writes output to
> `projects/` *relative to the current working directory*, so if you launch Claude Code from some
> other folder the generated project lands there instead. Open this repo first, then run.

From inside this repo in Claude Code:

```
Run the build-app workflow to build: "<your one-line spec>"
```

Built projects land in `projects/<name>/`. The workflow logs its output target at the start of the
run — glance at it to confirm the files are going where you expect.

## Layout

| Path | What |
|------|------|
| `.claude/workflows/build-app.js` | The multi-agent pipeline script |
| `projects/` | Output — one folder per built app |
| `CLAUDE.md` | Guidance for Claude Code in this repo |

## Status

Early scaffold. The pipeline is a starting point — tune the agent prompts, add phases (e.g. a test-and-fix loop, a security pass), or branch the topology as you go.
