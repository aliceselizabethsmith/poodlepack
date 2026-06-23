#!/usr/bin/env node
// Launcher glue for the kawaii Kauai crew window. Run from the devcrew repo root.
//
//   node viz/run-window.mjs start --spec "a CLI that ..."   prep the run folder + open the window
//   node viz/run-window.mjs status --state done             mark the run finished (triggers the finale)
//   node viz/run-window.mjs status --state error --message "..."
//
// "start" clears .devcrew/run/, writes manifest.json (so the window can draw the pack before any
// agent runs), sets status=running, then spawns Electron detached so it keeps animating while the
// build-app workflow runs. It prints RUN_DIR=<abs path> so the caller can pass it to the workflow.

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)

const VIZ_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = process.cwd()
const RUN_DIR = path.join(REPO_ROOT, '.devcrew', 'run')
const EVENTS_DIR = path.join(RUN_DIR, 'events')

// The cast, with the poodle colors the window expects. Opal & Starr are the black standard poodles.
const CAST = [
  { role: 'architect', persona: 'Opal',   emoji: '🌺', color: '#22222a' },
  { role: 'coder',     persona: 'Sylvie',    emoji: '🏄', color: '#7bdcb5' },
  { role: 'reviewer',  persona: 'Starr',  emoji: '🔍', color: '#2b2b34' },
  { role: 'tester',    persona: 'Ruby',   emoji: '🌺', color: '#d96b63' },
  { role: 'security',  persona: 'Lucy',   emoji: '🦉', color: '#9aa0b5' },
  { role: 'scribe',    persona: 'Pearl', emoji: '🌙', color: '#ffd166' },
]
const PHASES = ['Design', 'Code', 'Review', 'Fix', 'Test', 'Security', 'Docs']

function getArg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function cmdStart() {
  const spec = getArg('spec') || 'a small app'

  // Fresh run folder: wipe any previous events so the window starts clean.
  fs.rmSync(RUN_DIR, { recursive: true, force: true })
  fs.mkdirSync(EVENTS_DIR, { recursive: true })
  fs.mkdirSync(path.join(RUN_DIR, 'questions'), { recursive: true })
  fs.mkdirSync(path.join(RUN_DIR, 'answers'), { recursive: true })

  fs.writeFileSync(path.join(RUN_DIR, 'manifest.json'), JSON.stringify({
    spec, projectName: null, startedSeq: 0, cast: CAST, phases: PHASES,
  }, null, 2))
  fs.writeFileSync(path.join(RUN_DIR, 'status.json'), JSON.stringify({ state: 'running' }))

  // Open the window, detached, watching this run folder. Survives this process exiting.
  // Strip ELECTRON_RUN_AS_NODE — if set (e.g. when launched from inside another Electron
  // app like an IDE or Claude Code) it forces Electron to run headless as plain Node.
  const childEnv = { ...process.env, DEVCREW_RUN_DIR: RUN_DIR }
  delete childEnv.ELECTRON_RUN_AS_NODE
  const electronExe = require('electron') // returns the .exe path when required from Node
  const child = spawn(electronExe, ['.'], {
    cwd: VIZ_DIR,
    env: childEnv,
    detached: true,
    stdio: 'ignore',
    shell: false,
  })
  child.unref()

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
