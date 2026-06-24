#!/usr/bin/env node
// Launcher glue for the PoodlePack build window. Run from the repo root.
//
//   node viz/run-window.mjs start --spec "a CLI that ..."   prep the run folder + open the window
//   node viz/run-window.mjs status --state done             mark the run finished (triggers the finale)
//   node viz/run-window.mjs status --state error --message "..."
//
// "start" clears .devcrew/run/, writes manifest.json (so the window can draw the pack before any
// agent runs), sets status=running, then spawns Electron detached so it keeps animating while the
// build-app workflow runs. It prints RUN_DIR=<abs path> so the caller can pass it to the workflow.

import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import { spawnWindow, seedRunDir } from './launch.mjs'

const VIZ_DIR = path.dirname(fileURLToPath(import.meta.url))
const RUN_DIR = path.join(process.cwd(), '.devcrew', 'run')

// The crew, in pipeline order. Presentation (color/size/accessory) is owned by the renderer.
const CAST = [
  { role: 'architect', persona: 'Opal' },
  { role: 'coder',     persona: 'Sylvie' },
  { role: 'reviewer',  persona: 'Starr' },
  { role: 'tester',    persona: 'Ruby' },
  { role: 'security',  persona: 'Lucy' },
  { role: 'scribe',    persona: 'Pearl' },
]
const PHASES = ['Design', 'Code', 'Review', 'Fix', 'Test', 'Security', 'Docs']

function getArg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function cmdStart() {
  const spec = getArg('spec') || 'a small app'
  seedRunDir(RUN_DIR, { spec, projectName: null, startedSeq: 0, cast: CAST, phases: PHASES })
  spawnWindow(['.'], { cwd: VIZ_DIR, env: { DEVCREW_RUN_DIR: RUN_DIR } })
  process.stdout.write(`RUN_DIR=${RUN_DIR}\n`)
}

function cmdStatus() {
  const state = getArg('state') || 'done'
  const message = getArg('message')
  const ok = getArg('ok')
  if (!fs.existsSync(RUN_DIR)) fs.mkdirSync(RUN_DIR, { recursive: true })
  fs.writeFileSync(path.join(RUN_DIR, 'status.json'), JSON.stringify({
    state, ...(message ? { message } : {}), ...(ok ? { ok: ok === 'true' } : {}),
  }))
  process.stdout.write(`status=${state}\n`)
}

const sub = process.argv[2]
if (sub === 'start') cmdStart()
else if (sub === 'status') cmdStatus()
else {
  process.stderr.write('usage: run-window.mjs <start|status> [--spec ..] [--state ..] [--message ..] [--ok true|false]\n')
  process.exit(1)
}
