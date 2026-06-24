// Best-effort audio for the PoodlePack windows. Routed through the OS (not the
// renderer's <audio>/Web Audio) because Chromium's audio path is silent on some
// Windows setups.
//
//   Windows      -> .NET MediaPlayer via play-audio.ps1. Media Foundation follows the
//                   real default output device, including VIRTUAL devices like SoundWire
//                   that ffplay/SDL silently miss — and needs no ffmpeg.
//   macOS/Linux  -> ffplay (part of ffmpeg). Optional: a silent no-op if not installed.
//
// Either way, if the player is missing every call here is a silent no-op and the
// windows still run perfectly; audio is a bonus, never required.
const { spawn, execSync } = require('child_process')
const path = require('path')

const IS_WIN = process.platform === 'win32'
const PS_HELPER = path.join(__dirname, 'play-audio.ps1')
const STOP_HELPER = path.join(__dirname, 'stop-audio.ps1')

let musicProc = null
let lastChime = 0

const clamp01 = (x) => Math.max(0, Math.min(1, x))

// Spawn the platform player for `file`. `loop` repeats forever (music) vs once (chime).
function spawnPlayer(file, volume, loop) {
  if (IS_WIN) {
    // -STA + a Dispatcher message pump (inside the .ps1) so MediaPlayer events fire.
    const args = ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', PS_HELPER,
      '-Path', file, '-Volume', String(clamp01(volume / 100))]
    if (loop) args.push('-Loop')
    return spawn('powershell', args, { stdio: 'ignore', windowsHide: true })
  }
  const args = ['-nodisp', '-autoexit', '-loglevel', 'quiet']
  if (loop) args.push('-loop', '0')
  args.push('-volume', String(volume), file)
  return spawn('ffplay', args, { stdio: 'ignore' })
}

// Loop a track forever at a gentle volume (0-100).
function startMusic(file, volume = 40) {
  if (musicProc || !file) return
  try {
    musicProc = spawnPlayer(file, volume, true)
    musicProc.on('error', () => { musicProc = null }) // player missing -> stay silent
    musicProc.on('exit', () => { musicProc = null })
  } catch { musicProc = null }
}

function stopMusic() {
  if (musicProc) { try { musicProc.kill() } catch {} musicProc = null }
  // On Windows the -STA host can spawn a child / a hard kill can orphan it, so sweep
  // by script name (synchronously, so it's gone before the app quits on window close).
  if (IS_WIN) {
    try { execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${STOP_HELPER}"`, { stdio: 'ignore' }) } catch {}
  }
}

function isMusicPlaying() { return !!musicProc }

// Play a short sound once. De-bounced so a burst of completions yields one chime.
function playChime(file, { debounceMs = 900, volume = 70 } = {}) {
  if (!file) return
  const now = Date.now()
  if (now - lastChime < debounceMs) return
  lastChime = now
  try {
    const p = spawnPlayer(file, volume, false)
    p.on('error', () => {}) // player missing -> silent
  } catch {}
}

module.exports = { startMusic, stopMusic, isMusicPlaying, playChime }
