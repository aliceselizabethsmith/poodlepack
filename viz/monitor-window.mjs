#!/usr/bin/env node
// Launcher for the background-activity dashboard ("the kennel").
//
//   node viz/monitor-window.mjs ensure   # open it only if it isn't already open
//   node viz/monitor-window.mjs start    # force-open a new one
//   node viz/monitor-window.mjs stop     # close it
//   node viz/monitor-window.mjs hook     # PostToolUse(Agent) hook entry — opens it for background agents
//
// `ensure` is idempotent via a lockfile the Electron main process maintains, so a
// hook can call it on every background-agent spawn without piling up windows.

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const VIZ_DIR = path.dirname(fileURLToPath(import.meta.url))
const MAIN = path.join(VIZ_DIR, 'monitor', 'main.js')
const LOCK = path.join(os.homedir(), '.devcrew', 'monitor.lock')

function alive(pid) {
  try { process.kill(pid, 0); return true } catch { return false }
}

function isRunning() {
  try {
    const pid = Number(fs.readFileSync(LOCK, 'utf8').trim())
    return pid > 0 && alive(pid)
  } catch { return false }
}

function launch() {
  // Strip ELECTRON_RUN_AS_NODE so a real window opens from inside an Electron host.
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const electron = require('electron') // resolves to the platform's Electron binary (Win/mac/Linux)
  const child = spawn(electron, [MAIN], { env, detached: true, stdio: 'ignore', shell: false })
  child.unref()
}

function ensure() {
  if (isRunning()) process.stdout.write('kennel already open\n')
  else { launch(); process.stdout.write('opening kennel\n') }
}

const cmd = process.argv[2]
if (cmd === 'ensure') {
  ensure()
} else if (cmd === 'start') {
  launch(); process.stdout.write('opening kennel\n')
} else if (cmd === 'stop') {
  try {
    const pid = Number(fs.readFileSync(LOCK, 'utf8').trim())
    if (alive(pid)) process.kill(pid)
    fs.unlinkSync(LOCK)
    process.stdout.write('kennel closed\n')
  } catch { process.stdout.write('kennel not running\n') }
} else if (cmd === 'hook') {
  // Cross-platform PostToolUse(Agent) hook entry point: read the tool payload from
  // stdin and open the kennel only for BACKGROUND agents. Identical command on every
  // OS — no PowerShell/bash wrapper. Always exits 0 so it can't block the host.
  let payload = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (d) => { payload += d })
  process.stdin.on('end', () => {
    if (/"(run_in_background|background)"\s*:\s*true/.test(payload)) ensure()
    process.exit(0)
  })
  setTimeout(() => process.exit(0), 2500) // never hang the host if stdin stays open
} else {
  process.stderr.write('usage: monitor-window.mjs <ensure|start|stop|hook>\n')
  process.exit(1)
}
