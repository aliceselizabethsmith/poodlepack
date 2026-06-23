#!/usr/bin/env node
// Standalone demo / smoke test: opens the kawaii window and streams a scripted poodle
// build so you can preview the pack without spending a real workflow run.
//
//   node viz/demo.mjs        (run from the devcrew repo root)

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)

const VIZ_DIR = path.dirname(fileURLToPath(import.meta.url))
const RUN_DIR = path.join(process.cwd(), '.devcrew', 'run')
const EVENTS_DIR = path.join(RUN_DIR, 'events')

const CAST = [
  { role: 'architect', persona: 'Opal',   emoji: '🌺', color: '#22222a' },
  { role: 'coder',     persona: 'Sylvie',    emoji: '🏄', color: '#7bdcb5' },
  { role: 'reviewer',  persona: 'Starr',  emoji: '🔍', color: '#2b2b34' },
  { role: 'tester',    persona: 'Ruby',   emoji: '🌺', color: '#d96b63' },
  { role: 'security',  persona: 'Lucy',   emoji: '🦉', color: '#9aa0b5' },
  { role: 'scribe',    persona: 'Pearl', emoji: '🌙', color: '#ffd166' },
]
const PHASES = ['Design', 'Code', 'Review', 'Fix', 'Test', 'Security', 'Docs']
const SPEC = 'a command-line password generator with flags for length and character toggles'

// The scripted show. Each entry becomes one event file. Bubbles are factual status lines.
const SCRIPT = [
  { role: 'architect', phase: 'Design', kind: 'start', bubble: 'Designing the project structure and selecting the language.' },
  { role: 'architect', phase: 'Design', kind: 'done',  to: 'coder', projectName: 'passgen-cli', bubble: 'Design complete: Python, modules cli.py / generator.py / __main__.py plus a test suite.' },
  { role: 'coder', phase: 'Code', kind: 'start', file: 'passgen/generator.py', bubble: 'Implementing generator.py using the secrets module for cryptographically secure RNG.' },
  { role: 'coder', phase: 'Code', kind: 'done',  to: 'reviewer', file: 'passgen/generator.py', bubble: 'generator.py done: length control, symbol/number toggles, ambiguous-char exclusion.' },
  { role: 'reviewer', phase: 'Review', kind: 'start', bubble: 'Reviewing all modules for bugs and interface mismatches.' },
  { role: 'reviewer', phase: 'Review', kind: 'done',  to: 'coder', bubble: 'Found 1 issue: cli.py does not validate that --length is positive.' },
  { role: 'coder', phase: 'Fix', kind: 'start', bubble: 'Adding validation for the --length flag in cli.py.' },
  { role: 'coder', phase: 'Fix', kind: 'done',  to: 'tester', bubble: 'Fixed: cli.py now rejects non-positive lengths with a clear error.' },
  { role: 'tester', phase: 'Test', kind: 'start', bubble: 'Writing pytest cases for generator rules and CLI argument parsing.' },
  { role: 'tester', phase: 'Test', kind: 'done',  to: 'security', ok: true, bubble: 'Ran pytest: 40 passed, 0 failed.' },
  { role: 'security', phase: 'Security', kind: 'start', bubble: 'Running bandit and checking for weak RNG and unvalidated input.' },
  { role: 'security', phase: 'Security', kind: 'done',  to: 'scribe', bubble: 'bandit: 0 findings. Uses secrets (not random) — no issues.' },
  { role: 'scribe', phase: 'Docs', kind: 'start', bubble: 'Writing README: usage, flags, examples, and how to run the tests.' },
  { role: 'scribe', phase: 'Docs', kind: 'done',  bubble: 'README.md complete. Project ready to ship.' },
]

const personaOf = role => CAST.find(c => c.role === role)?.persona || role
const pad4 = n => String(n).padStart(4, '0')

// fresh folder
fs.rmSync(RUN_DIR, { recursive: true, force: true })
fs.mkdirSync(EVENTS_DIR, { recursive: true })
fs.mkdirSync(path.join(RUN_DIR, 'questions'), { recursive: true })
fs.mkdirSync(path.join(RUN_DIR, 'answers'), { recursive: true })
fs.writeFileSync(path.join(RUN_DIR, 'manifest.json'),
  JSON.stringify({ spec: SPEC, projectName: null, startedSeq: 0, cast: CAST, phases: PHASES }, null, 2))
fs.writeFileSync(path.join(RUN_DIR, 'status.json'), JSON.stringify({ state: 'running' }))

// open the window. Strip ELECTRON_RUN_AS_NODE — if it's set (e.g. when launched from
// inside another Electron app) it forces Electron to run as plain Node and no window opens.
const childEnv = { ...process.env, DEVCREW_RUN_DIR: RUN_DIR }
delete childEnv.ELECTRON_RUN_AS_NODE
const electronExe = require('electron') // the electron package returns the .exe path when required from Node
const child = spawn(electronExe, ['.'], {
  cwd: VIZ_DIR, env: childEnv,
  detached: true, stdio: 'ignore', shell: false,
})
child.unref()

// stream the script, one beat every 1.3s (start a little after the window opens)
let seq = 0
SCRIPT.forEach((beat, i) => {
  if (beat.kind === 'start') seq += 1
  const mySeq = seq
  setTimeout(() => {
    const evt = { seq: mySeq, role: beat.role, persona: personaOf(beat.role), phase: beat.phase, kind: beat.kind, bubble: beat.bubble }
    if (beat.to) evt.to = beat.to
    if (beat.file) evt.file = beat.file
    if (beat.projectName) evt.projectName = beat.projectName
    if (beat.ok !== undefined) evt.ok = beat.ok
    fs.writeFileSync(path.join(EVENTS_DIR, `${pad4(mySeq)}-${beat.role}-${beat.kind}.json`), JSON.stringify(evt))
    process.stdout.write(`▶ ${personaOf(beat.role)} ${beat.kind}: ${beat.bubble}\n`)
  }, 2500 + i * 1300)
})

// demonstrate the question pop-out shortly after Opal starts
setTimeout(() => {
  fs.writeFileSync(path.join(RUN_DIR, 'questions', 'q1.json'), JSON.stringify({
    id: 'q1', persona: 'Opal', role: 'architect',
    text: 'Should the password generator be a CLI or a web app?',
    options: ['CLI', 'Web app'],
  }))
  process.stdout.write('❓ Opal asks: CLI or Web app? (answer it in the window)\n')
}, 3400)

// finale
setTimeout(() => {
  fs.writeFileSync(path.join(RUN_DIR, 'status.json'), JSON.stringify({ state: 'done', ok: true }))
  process.stdout.write('✓ demo complete — the pack is celebrating 🎉\n')
}, 2500 + SCRIPT.length * 1300 + 800)
