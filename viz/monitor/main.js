// Electron main for the background-activity dashboard ("the kennel").
// Polls the transcript scanner and streams the live agent roster to the renderer.
// Completely separate from the build-app window so neither destabilizes the other.

const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { pathToFileURL } = require('url')
const audio = require('../audio')

// Gentle music loop + a finale chime, both through the shared cross-platform helper
// (ffplay). Silent no-op if ffplay isn't installed, so the kennel still runs.
const MUSIC_FILE = path.join(__dirname, '..', 'assets', 'music', 'aloha-oe-loud.mp3')
const CHIME_FILE = path.join(__dirname, '..', 'assets', 'sounds', 'tada.wav')
ipcMain.handle('music', (_e, on) => { on ? audio.startMusic(MUSIC_FILE) : audio.stopMusic(); return audio.isMusicPlaying() })
ipcMain.on('chime', () => audio.playChime(CHIME_FILE))

// lockfile so the launcher's `ensure` never opens a second window
const LOCK = path.join(os.homedir(), '.devcrew', 'monitor.lock')
function writeLock() {
  try { fs.mkdirSync(path.dirname(LOCK), { recursive: true }); fs.writeFileSync(LOCK, String(process.pid)) } catch {}
}
function clearLock() { try { fs.unlinkSync(LOCK) } catch {} }

// active window: a transcript touched within this many ms = the agent is live.
// Override with DEVCREW_ACTIVE_MS (handy for testing against older transcripts).
const ACTIVE_MS = Number(process.env.DEVCREW_ACTIVE_MS) || 60_000
// how long a finished agent lingers before leaving — just long enough to play out
// the celebration burst, then it's gone (no hanging around the kennel afterward)
const LINGER_MS = Number(process.env.DEVCREW_LINGER_MS) || 4_000

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
    audio.startMusic(MUSIC_FILE)
    if (process.env.DEVCREW_DEMO) startDemo()
    else startPolling()
  })
  win.on('closed', audio.stopMusic)
}

// DEVCREW_DEMO=1 : a scripted loop so you can verify every state — agents start
// staggered, work (rotating actions), finish one by one (each a celebration),
// linger, then leave to an idle kennel, then repeat.
// short, snappy actions — good for a quick header GIF
const DEMO_DEFS_SHORT = [
  { id: 'demo-coder',    kind: 'coder',      task: 'Build a CSV-to-Markdown CLI',      actions: ['reading the spec', 'writing parser.py', 'running pytest -q'], done: 'Done — 14 tests pass.' },
  { id: 'demo-research', kind: 'researcher', task: 'Research Hawaiian music licensing', actions: ['searching the web', 'reading archive.org', 'drafting findings'],  done: 'Found 3 public-domain options.' },
  { id: 'demo-security', kind: 'security',   task: 'Audit the auth module',            actions: ['running bandit', 'reading db.py', 'checking for injection'],   done: 'bandit: 0 findings — clean.' },
  { id: 'demo-tester',   kind: 'tester',     task: 'Write tests for the API',          actions: ['writing test_api.py', 'running the suite'],                   done: 'All 22 tests pass.' },
]

// verbose, realistic actions — closer to real agent output, and it exercises the
// two-line bubbles + hover-for-full. Used by `monitor-window.mjs demo detailed`.
const DEMO_DEFS_DETAILED = [
  { id: 'demo-coder', kind: 'coder', task: 'Build a CSV-to-Markdown CLI with column alignment',
    actions: [
      'Sketching the module layout: cli.py (argparse front end), table.py (width + alignment), io.py (read/write + stdin)',
      'Writing table.py — computing per-column max width, padding cells, and emitting the :---: alignment separator row',
      'Running pytest -q: 18 tests across parsing, ragged rows, unicode-width cells, and empty-input edge cases',
    ],
    done: 'Done — 18 tests pass; handles ragged rows, unicode-width cells, and stdin piping.' },
  { id: 'demo-research', kind: 'researcher', task: 'Find a public-domain Hawaiian track for the soundtrack',
    actions: [
      'Searching archive.org and Musopen for pre-1925 recordings of "Aloha ʻOe" in the public domain',
      'Reading the rights pages — confirming the 1878 composition is PD and the specific transfer is CC0',
      'Drafting findings: three candidate sources with license notes, run-times, and direct download links',
    ],
    done: 'Found 3 public-domain recordings; recommending the cleanest transfer (CC0, ~3.5 min).' },
  { id: 'demo-security', kind: 'security', task: 'Audit the auth module for injection + secret leaks',
    actions: [
      'Running bandit -r on the auth package and triaging each medium/high finding by hand',
      'Reading db.py — verifying the login query uses parameter binding instead of string interpolation',
      'Grepping for hard-coded tokens and confirming every secret loads from the environment',
    ],
    done: 'bandit: 0 high/medium findings; login query is parameterized; no secrets in source.' },
  { id: 'demo-tester', kind: 'tester', task: 'Write an integration test suite for the REST API',
    actions: [
      'Writing test_api.py — fixtures spin up the app, seed a temp database, and tear it down between cases',
      'Covering the happy path plus the 401 / 404 / 422 error contracts and the pagination boundaries',
      'Running the suite under coverage to confirm the new endpoints are actually exercised',
    ],
    done: 'All 22 tests pass; 94% line coverage on the new endpoints.' },
]

function startDemo() {
  const defs = process.env.DEVCREW_DEMO === 'detailed' ? DEMO_DEFS_DETAILED : DEMO_DEFS_SHORT
  let t = 0
  const tick = () => {
    if (!win || win.isDestroyed()) return
    const roster = []
    defs.forEach((d, i) => {
      const start = i * 2, doneAt = start + 9, gone = doneAt + 4
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
  const seenDone = new Map()    // agentId -> when it finished (linger then drop)
  let prevWorking = new Set()   // ids that were working on the previous tick

  const tick = () => {
    if (!win || win.isDestroyed() || !scan) return
    let all = []
    // only read transcripts fresh enough to possibly be in the roster (perf)
    try { all = scan({ maxReadAgeMs: ACTIVE_MS + LINGER_MS + 5000 }) } catch { all = [] }

    const now = Date.now()
    const byId = new Map(all.map(a => [a.agentId, a]))
    const nowWorking = new Set()
    const roster = []

    for (const a of all) {
      if (a.ageMs < ACTIVE_MS) {
        nowWorking.add(a.agentId)
        seenDone.delete(a.agentId)
        roster.push({ ...a, state: 'working' })
      }
    }
    // edge-based finish: anything working last tick but not now just completed
    for (const id of prevWorking) {
      if (!nowWorking.has(id) && !seenDone.has(id)) seenDone.set(id, now)
    }
    // lingering 'done' poodles (celebrate), and prune the rest so the map can't grow
    for (const [id, t] of seenDone) {
      if (now - t < LINGER_MS) {
        const a = byId.get(id)
        if (a) roster.push({ ...a, state: 'done' })
      } else {
        seenDone.delete(id)
      }
    }
    prevWorking = nowWorking

    // de-dupe, newest first; cap at 16 (the workflow fan-out ceiling), renderer auto-fits
    const out = new Map()
    for (const r of roster) if (!out.has(r.agentId)) out.set(r.agentId, r)
    win.webContents.send('roster', [...out.values()].slice(0, 16))
  }

  const timer = setInterval(tick, 1400)
  tick()
  win.on('closed', () => clearInterval(timer))
}

ipcMain.handle('active-ms', () => ACTIVE_MS)

// allow the gentle Hawaiian loop to start without a user gesture
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
// Known Electron/Windows bug: the out-of-process audio service can fail to reach
// the output device — the page "plays" (clock advances) but no sound comes out.
// Forcing audio in-process fixes the silent-output case.
app.commandLine.appendSwitch('disable-features', 'AudioServiceOutOfProcess,AudioServiceSandbox')

app.whenReady().then(async () => { await loadScanner(); writeLock(); createWindow() })
app.on('window-all-closed', () => { audio.stopMusic(); clearLock(); app.quit() })
app.on('before-quit', audio.stopMusic)
app.on('quit', () => { audio.stopMusic(); clearLock() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
