// Shared launch helpers for the PoodlePack window launchers (run-window / demo /
// monitor-window). The ELECTRON_RUN_AS_NODE strip is load-bearing (see CLAUDE.md) — so
// the spawn ritual lives in one place and the three launchers can't drift.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)

// Spawn the Electron window detached so it outlives the launcher. Strips
// ELECTRON_RUN_AS_NODE (set by Electron hosts like an IDE / Claude Code), which would
// otherwise force Electron to run headless as plain Node — no window.
export function spawnWindow(args, { cwd, env } = {}) {
  const childEnv = { ...process.env, ...env }
  delete childEnv.ELECTRON_RUN_AS_NODE
  const electron = require('electron') // resolves to the platform's Electron binary (Win/mac/Linux)
  const child = spawn(electron, args, { cwd, env: childEnv, detached: true, stdio: 'ignore', shell: false })
  child.unref()
  return child
}

// (Re)create a clean run folder with a fresh manifest + 'running' status, so the build
// window can draw the pack before any agent runs.
export function seedRunDir(runDir, manifest) {
  fs.rmSync(runDir, { recursive: true, force: true })
  for (const sub of ['events', 'questions', 'answers']) fs.mkdirSync(path.join(runDir, sub), { recursive: true })
  fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  fs.writeFileSync(path.join(runDir, 'status.json'), JSON.stringify({ state: 'running' }))
}
