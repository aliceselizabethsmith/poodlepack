// Electron main for the background-activity dashboard ("the kennel").
// Polls the transcript scanner and streams the live agent roster to the renderer.
// Completely separate from the build-app window so neither destabilizes the other.

const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { pathToFileURL } = require('url')
const { spawn, exec } = require('child_process')

// ── audio via the OS (Electron's own audio path is unreliable on some Windows
// setups — it reports playing but no sound). ffplay loops the music; PowerShell
// SoundPlayer plays the completion sound, the same path the user's hooks use. ──
const MUSIC_FILE = path.join(__dirname, '..', 'assets', 'music', 'aloha-oe-loud.mp3')
let musicProc = null
function startMusic() {
  if (musicProc) return
  try {
    musicProc = spawn('ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet', '-loop', '0', '-volume', '40', MUSIC_FILE],
      { stdio: 'ignore', shell: true })
    musicProc.on('exit', () => { musicProc = null })
    musicProc.on('error', () => { musicProc = null })
  } catch { musicProc = null }
}
function stopMusic() {
  if (musicProc) { try { musicProc.kill() } catch {} musicProc = null }
  // ffplay is launched via a shell, so the handle above is the shell, not ffplay —
  // make sure the actual player is gone so audio never outlives the window
  try { exec('taskkill /F /IM ffplay.exe') } catch {}
}
let lastChime = 0
function playChime() {
  const now = Date.now()
  if (now - lastChime < 900) return // de-bounce: one sound even if several finish together
  lastChime = now
  exec(`powershell -NoProfile -Command "(New-Object Media.SoundPlayer 'C:\\Windows\\Media\\tada.wav').PlaySync()"`)
}
ipcMain.handle('music', (_e, on) => { if (on) startMusic(); else stopMusic(); return !!musicProc })
ipcMain.on('chime', playChime)

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
    startMusic()
    if (process.env.DEVCREW_DEMO) startDemo()
    else startPolling()
  })
  win.on('closed', stopMusic)
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
app.on('window-all-closed', () => { stopMusic(); clearLock(); app.quit() })
app.on('before-quit', stopMusic)
app.on('quit', () => { stopMusic(); clearLock() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
