// Electron main process for the kawaii Kauai crew window.
// It owns one job besides creating the window: poll the shared run folder for the
// manifest and event files the crew agents write, and forward them to the renderer.
// Polling (not fs.watch) because it is dead simple and immune to half-written files —
// we only ever forward a file once we can parse it as complete JSON.

const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const fsp = require('fs/promises')
const audio = require('./audio')

// Gentle Hawaiian loop while the crew works; a chime when they ship. Both go through
// the shared cross-platform helper (ffplay), which no-ops silently if ffplay is absent.
const MUSIC_FILE = path.join(__dirname, 'assets', 'music', 'aloha-oe-loud.mp3')
const CHIME_FILE = path.join(__dirname, 'assets', 'sounds', 'tada.wav')

// Resolve the run folder from --run-dir <path> or DEVCREW_RUN_DIR, relative to CWD.
function resolveRunDir() {
  const flagIdx = process.argv.indexOf('--run-dir')
  const fromFlag = flagIdx >= 0 ? process.argv[flagIdx + 1] : null
  const raw = fromFlag || process.env.DEVCREW_RUN_DIR || '.devcrew/run'
  return path.resolve(process.cwd(), raw)
}

const RUN_DIR = resolveRunDir()
const EVENTS_DIR = path.join(RUN_DIR, 'events')
const QUESTIONS_DIR = path.join(RUN_DIR, 'questions')
const ANSWERS_DIR = path.join(RUN_DIR, 'answers')
const MANIFEST_FILE = path.join(RUN_DIR, 'manifest.json')
const STATUS_FILE = path.join(RUN_DIR, 'status.json')

let win = null

function createWindow() {
  win = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 760,
    minHeight: 560,
    title: 'PoodlePack 🌺',
    backgroundColor: '#ffd9a0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.removeMenu()
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  win.webContents.once('did-finish-load', () => { audio.startMusic(MUSIC_FILE); startWatching() })
  win.on('closed', audio.stopMusic)
}

async function readJson(file) {
  try {
    const text = await fsp.readFile(file, 'utf8')
    return JSON.parse(text)
  } catch {
    return null // missing or mid-write — try again next tick
  }
}

function startWatching() {
  const seenEvents = new Set()
  const seenQuestions = new Set()
  let manifestSent = false
  let lastStatus = null

  const tick = async () => {
    if (!win || win.isDestroyed()) return

    // Manifest: send once it appears and parses.
    if (!manifestSent) {
      const manifest = await readJson(MANIFEST_FILE)
      if (manifest) {
        manifestSent = true
        win.webContents.send('manifest', manifest)
      }
    }

    // Events: forward every new, fully-parseable file in sequence order.
    let files = []
    try {
      files = (await fsp.readdir(EVENTS_DIR)).filter(f => f.endsWith('.json'))
    } catch {
      files = [] // events dir not created yet
    }
    files.sort() // filenames are zero-padded seq + role + kind, so this is run order
    for (const name of files) {
      if (seenEvents.has(name)) continue
      const evt = await readJson(path.join(EVENTS_DIR, name))
      if (!evt) continue // half-written; pick it up next tick
      seenEvents.add(name)
      win.webContents.send('event', evt)
    }

    // Questions: forward each new question so the window can pop a modal.
    let qfiles = []
    try {
      qfiles = (await fsp.readdir(QUESTIONS_DIR)).filter(f => f.endsWith('.json'))
    } catch {
      qfiles = [] // questions dir not created yet
    }
    qfiles.sort()
    for (const name of qfiles) {
      if (seenQuestions.has(name)) continue
      // already answered (e.g. the window was reloaded mid-run)? don't re-ask.
      if (fs.existsSync(path.join(ANSWERS_DIR, name))) { seenQuestions.add(name); continue }
      const q = await readJson(path.join(QUESTIONS_DIR, name))
      if (!q) continue
      seenQuestions.add(name)
      win.webContents.send('question', q)
    }

    // Status: forward 'done'/'error' transitions so the window can celebrate.
    const status = await readJson(STATUS_FILE)
    if (status && status.state && status.state !== lastStatus) {
      lastStatus = status.state
      win.webContents.send('status', status)
      if (status.state === 'done') audio.playChime(CHIME_FILE) // celebratory tada on ship
    }
  }

  const timer = setInterval(tick, 350)
  tick()
  win.on('closed', () => clearInterval(timer))
}

// Let the renderer ask where it's watching (handy for the header).
ipcMain.handle('run-dir', () => RUN_DIR)

// The renderer submits the user's answer; we write it where the waiting agent polls.
ipcMain.handle('answer', async (_e, payload) => {
  if (!payload || !payload.id) return false
  await fsp.mkdir(ANSWERS_DIR, { recursive: true })
  await fsp.writeFile(
    path.join(ANSWERS_DIR, `${payload.id}.json`),
    JSON.stringify({ id: payload.id, answer: payload.answer }),
  )
  return true
})

// Mute toggle from the renderer: true resumes the loop, false stops it.
ipcMain.handle('music', (_e, on) => { on ? audio.startMusic(MUSIC_FILE) : audio.stopMusic() })

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { audio.stopMusic(); app.quit() })
app.on('before-quit', audio.stopMusic)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
