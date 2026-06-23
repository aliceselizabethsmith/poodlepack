# devcrew — Claude Code guidance

This repo is a ChatDev-style multi-agent development pipeline that runs as a Claude Code Workflow.

## What it does

`/build-app "<spec>"` (or "run the build-app workflow to build ...") runs a crew of role-playing
agents through phases — Design → Code → Review → Fix → Docs — turning a one-line spec into a working
project under `projects/<name>/`.

## The pipeline

The orchestration lives in `.claude/workflows/build-app.js`. It uses:

- **pipeline()** is not used here because phases are sequential and each depends on the full prior
  artifact — this is a deliberate barrier chain, not a fan-out.
- Each `agent()` call is one role (CTO designer, programmer, reviewer, doc writer).
- Structured `schema` outputs pass clean data (file lists, findings) between phases.

## Working in this repo

- Built apps go in `projects/` (git-ignored by default — see `.gitignore`).
- To change the crew's behavior, edit the agent prompts in `build-app.js`.
- To add a phase (e.g. a real test-and-fix loop or a security review), add an `agent()` call and a
  `meta.phases` entry with a matching title.
- This is a personal tool, not Magline work — no Magline customer data, initiative STATE files, or
  OneDrive output belong here.

## Conventions

- Keep agent prompts explicit about the artifact they must return.
- Prefer one file per agent in the code phase so failures isolate cleanly.
