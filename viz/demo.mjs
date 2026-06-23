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
  { role: 'coder',     persona: 'Kai',    emoji: '🏄', color: '#7bdcb5' },
  { role: 'reviewer',  persona: 'Starr',  emoji: '🔍', color: '#2b2b34' },
  { role: 'tester',    persona: 'Nalu',   emoji: '🌊', color: '#6ec6ff' },
  { role: 'security',  persona: 'Pueo',   emoji: '🦉', color: '#9aa0b5' },
  { role: 'scribe',    persona: 'Mahina', emoji: '🌙', color: '#ffd166' },
]
const PHASES = ['Design', 'Code', 'Review', 'Fix', 'Test', 'Security', 'Docs']
const SPEC = 'a CLI tool that converts a CSV file into a Markdown table'

// The scripted show. Each entry becomes one event file.
const SCRIPT = [
  { role: 'architect', phase: 'Design', kind: 'start', bubble: 'Aloha crew! Let me sketch the blueprint 🌺' },
  { role: 'architect', phase: 'Design', kind: 'done',  to: 'coder', projectName: 'csv-to-markdown', bubble: "Design's pau — Kai, start paddling on the code! 🛠️" },
  { role: 'coder', phase: 'Code', kind: 'start', file: 'src/main.py', bubble: 'Hanging ten on main.py 🏄' },
  { role: 'coder', phase: 'Code', kind: 'done',  to: 'reviewer', file: 'src/main.py', bubble: "main.py's on the beach — Starr, take a look! ✨" },
  { role: 'reviewer', phase: 'Review', kind: 'start', bubble: 'Sniffing around for bugs 🔍' },
  { role: 'reviewer', phase: 'Review', kind: 'done',  to: 'coder', bubble: 'Tiny leak in the parser — patch it, Kai! 🐾' },
  { role: 'coder', phase: 'Fix', kind: 'start', bubble: 'On it — patching now 🏄' },
  { role: 'coder', phase: 'Fix', kind: 'done',  to: 'tester', bubble: 'Fixed up! Nalu, make some waves 🌊' },
  { role: 'tester', phase: 'Test', kind: 'start', bubble: 'Splashing in a test suite 🌊' },
  { role: 'tester', phase: 'Test', kind: 'done',  to: 'security', ok: true, bubble: 'All green — 9/9 passed! Pueo, your watch 🦉' },
  { role: 'security', phase: 'Security', kind: 'start', bubble: 'Hooting through the code for trouble 🦉' },
  { role: 'security', phase: 'Security', kind: 'done',  to: 'scribe', bubble: 'No prowlers tonight — Mahina, write it up 🌙' },
  { role: 'scribe', phase: 'Docs', kind: 'start', bubble: 'Inking the README by moonlight 🌙' },
  { role: 'scribe', phase: 'Docs', kind: 'done',  bubble: "README's ready — ship it! 📜" },
]

const personaOf = role => CAST.find(c => c.role === role)?.persona || role
const pad4 = n => String(n).padStart(4, '0')

// fresh folder
fs.rmSync(RUN_DIR, { recursive: true, force: true })
fs.mkdirSync(EVENTS_DIR, { recursive: true })
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

// finale
setTimeout(() => {
  fs.writeFileSync(path.join(RUN_DIR, 'status.json'), JSON.stringify({ state: 'done', ok: true }))
  process.stdout.write('✓ demo complete — the pack is celebrating 🎉\n')
}, 2500 + SCRIPT.length * 1300 + 800)
