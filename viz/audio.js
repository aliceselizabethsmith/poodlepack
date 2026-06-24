// Cross-platform, best-effort audio for the PoodlePack windows.
//
// Both the looping music and the one-shot chime play through ffplay (part of
// ffmpeg), which exists on Windows, macOS and Linux — so there is a single,
// optional dependency. If ffplay isn't installed, every call here is a silent
// no-op and the windows still run perfectly; audio is a bonus, never required.
//
// (We route through the OS rather than the renderer's <audio>/Web Audio because
// Chromium's audio path is silent on some Windows setups.)
const { spawn, execSync } = require('child_process')

const IS_WIN = process.platform === 'win32'
const FFPLAY = ['-nodisp', '-autoexit', '-loglevel', 'quiet']

let musicProc = null
let lastChime = 0

// Loop a track forever at a gentle volume.
function startMusic(file, volume = 40) {
  if (musicProc || !file) return
  try {
    // shell:true on Windows so the bare `ffplay` resolves through PATHEXT; off-Windows
    // we spawn it directly so kill() reaches the process itself.
    musicProc = spawn('ffplay', [...FFPLAY, '-loop', '0', '-volume', String(volume), file],
      { stdio: 'ignore', shell: IS_WIN })
    musicProc.on('error', () => { musicProc = null }) // no ffplay -> stay silent
    musicProc.on('exit', () => { musicProc = null })
  } catch { musicProc = null }
}

function stopMusic() {
  if (musicProc) { try { musicProc.kill() } catch {} musicProc = null }
  // shell:true can leave the real ffplay.exe orphaned on Windows. Kill it synchronously
  // so it's gone before the app quits on window close (an async kill can lose the race).
  if (IS_WIN) { try { execSync('taskkill /F /IM ffplay.exe', { stdio: 'ignore' }) } catch {} }
}

function isMusicPlaying() { return !!musicProc }

// Play a short sound once. De-bounced so a burst of completions yields one chime.
function playChime(file, { debounceMs = 900, volume = 70 } = {}) {
  if (!file) return
  const now = Date.now()
  if (now - lastChime < debounceMs) return
  lastChime = now
  try {
    const p = spawn('ffplay', [...FFPLAY, '-volume', String(volume), file], { stdio: 'ignore', shell: IS_WIN })
    p.on('error', () => {}) // no ffplay -> silent
  } catch {}
}

module.exports = { startMusic, stopMusic, isMusicPlaying, playChime }
