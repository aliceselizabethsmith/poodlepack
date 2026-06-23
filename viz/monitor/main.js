// Electron main for the background-activity dashboard ("the kennel").
// Polls the transcript scanner and streams the live agent roster to the renderer.
// Completely separate from the build-app window so neither destabilizes the other.

const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { pathToFileURL } = require('url')

// lockfile so the launcher's `ensure` never opens a second window
const LOCK = path.join(os.homedir(), '.devcrew', 'monitor.lock')
function writeLock() {
  try { fs.mkdirSync(path.dirname(LOCK), { recursive: true }); fs.writeFileSync(LOCK, String(process.pid)) } catch {}
}
function clearLock() { try { fs.unlinkSync(LOCK) } catch {} }

// active window: a transcript touched within this many ms = the agent is live.
// Override with DEVCREW_ACTIVE_MS (handy for testing against older transcripts).
const ACTIVE_MS = Number(process.env.DEVCREW_ACTIVE_MS) || 60_000
// how long a finished agent lingers (celebrating) before leaving the kennel
const LINGER_MS = Number(process.env.DEVCREW_LINGER_MS) || 12_000

let scan // loaded from the ESM scanner
let win = null

async function loadScanner() {
  // ESM dynamic import of an absolute Windows path needs a file:// URL
  const mod = await import(pathToFileURL(path.join(__dirname, 'scan.mjs')).href)
  scan = mod.scan
}

function createWindow() {
  win = new BrowserWindow({
    width: 1040, height: 620, minWidth: 720, minHeight: 460,
    title: 'PoodlePack 🐩',
    backgroundColor: '#ffd9a0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  })
  win.removeMenu()
  // capture renderer console to a file so we can diagnose audio
  win.webContents.on('console-message', (_e, _lvl, message) => {
    try { fs.appendFileSync(path.join(os.homedir(), '.devcrew', 'renderer.log'), message + '\n') } catch {}
  })
  win.loadFile(path.join(__dirname, 'index.html'))
  win.webContents.once('did-finish-load', () => {
    if (process.env.DEVCREW_DEMO) startDemo()
    else startPolling()
  })
}

// DEVCREW_DEMO=1 : a scripted loop so you can verify every state — agents start
// staggered, work (rotating actions), finish one by one (each a celebration),
// linger, then leave to an idle kennel, then repeat.
function startDemo() {
  const defs = [
    { id: 'demo-coder',    kind: 'coder',      task: 'Build a CSV-to-Markdown CLI',     actions: ['reading the spec', 'writing parser.py', 'running pytest -q'], done: 'Done — 14 tests pass.' },
    { id: 'demo-research', kind: 'researcher',  task: 'Research Hawaiian music licensing', actions: ['searching the web', 'reading archive.org', 'drafting findings'],  done: 'Found 3 public-domain options.' },
    { id: 'demo-security', kind: 'security',   task: 'Audit the auth module',           actions: ['running bandit', 'reading db.py', 'checking for injection'],   done: 'bandit: 0 findings — clean.' },
    { id: 'demo-tester',   kind: 'tester',     task: 'Write tests for the API',         actions: ['writing test_api.py', 'running the suite'],                   done: 'All 22 tests pass.' },
  ]
  let t = 0
  const tick = () => {
    if (!win || win.isDestroyed()) return
    const roster = []
    defs.forEach((d, i) => {
      const start = i * 2, doneAt = start + 9, gone = doneAt + 6
      if (t < start || t >= gone) return
      if (t < doneAt) {
        const ai = Math.floor((t - start) / 2.6) % d.actions.length
        roster.push({ agentId: d.id, kind: d.kind, task: d.task, action: d.actions[ai], state: 'working' })
      } else {
        roster.push({ agentId: d.id, kind: d.kind, task: d.task, action: d.done, state: 'done' })
      }
    })
    win.webContents.send('roster', roster)
    t = t >= 26 ? 0 : t + 1 // loop with a brief idle gap
  }
  setInterval(tick, 1000)
  tick()
}

function startPolling() {
  const seenDone = new Map() // agentId -> when it finished (for linger then drop)

  const tick = () => {
    if (!win || win.isDestroyed() || !scan) return
    let all = []
    try { all = scan({ activeMs: Infinity }) } catch { all = [] }

    const now = Date.now()
    const roster = []
    for (const a of all) {
      if (a.ageMs < ACTIVE_MS) {
        seenDone.delete(a.agentId)
        roster.push({ ...a, state: 'working' })
      } else if (seenDone.has(a.agentId)) {
        // recently went quiet → linger as 'done' for a bit, then drop
        const since = now - seenDone.get(a.agentId)
        if (since < LINGER_MS) roster.push({ ...a, state: 'done' })
      }
    }
    // mark newly-quiet agents (were active last tick, now stale) as just-finished
    for (const a of all) {
      if (a.ageMs >= ACTIVE_MS && a.ageMs < ACTIVE_MS + 4000 && !seenDone.has(a.agentId)) {
        seenDone.set(a.agentId, now)
        roster.push({ ...a, state: 'done' })
      }
    }

    // de-dupe (an agent could be added twice by the two loops), newest first
    const byId = new Map()
    for (const r of roster) if (!byId.has(r.agentId)) byId.set(r.agentId, r)
    // 16 = the realistic ceiling (a workflow fan-out caps at min(16, cores-2));
    // the renderer auto-fits them, and overflow beyond this scrolls.
    win.webContents.send('roster', [...byId.values()].slice(0, 16))
  }

  const timer = setInterval(tick, 1400)
  tick()
  win.on('closed', () => clearInterval(timer))
}

ipcMain.handle('active-ms', () => ACTIVE_MS)

// allow the gentle Hawaiian loop to start without a user gesture
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

app.whenReady().then(async () => { await loadScanner(); writeLock(); createWindow() })
app.on('window-all-closed', () => { clearLock(); app.quit() })
app.on('quit', clearLock)
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
