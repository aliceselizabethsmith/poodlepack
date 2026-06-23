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
    title: 'Poodle Vision 🐩',
    backgroundColor: '#ffd9a0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  })
  win.removeMenu()
  win.loadFile(path.join(__dirname, 'index.html'))
  win.webContents.once('did-finish-load', startPolling)
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
