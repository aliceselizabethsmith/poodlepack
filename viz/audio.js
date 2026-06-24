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
// Full path to Windows PowerShell 5.1 so playback works even when `powershell` isn't on
// PATH and never accidentally resolves to PowerShell 7 (`pwsh`, no WPF MediaPlayer).
const POWERSHELL = process.env.SystemRoot
  ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  : 'powershell'

let musicProc = null
let lastChime = 0

const clamp01 = (x) => Math.max(0, Math.min(1, x))

// Spawn the platform player for `file`. `loop` repeats forever (music) vs once (chime).
function spawnPlayer(file, volume, loop) {
  if (IS_WIN) {
    // No -STA: Windows PowerShell 5.1 is already STA by default, and passing -STA makes
    // it re-spawn a child host (two processes, harder to kill cleanly).
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS_HELPER,
      '-Path', file, '-Volume', String(clamp01(volume / 100)), '-ParentPid', String(process.pid)]
    if (loop) args.push('-Loop')
    return spawn(POWERSHELL, args, { stdio: 'ignore', windowsHide: true })
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
    const p = spawnPlayer(file, volume, true)
    p.on('error', () => { if (musicProc === p) musicProc = null }) // player missing -> silent
    p.on('exit', () => { if (musicProc === p) musicProc = null })
    musicProc = p
  } catch { musicProc = null }
}

function stopMusic() {
  const p = musicProc
  musicProc = null
  if (!p) return
  // The -STA host can spawn a child, so kill the whole tree. taskkill /T is fast
  // (~50ms) — no per-name PowerShell sweep, so the mute toggle doesn't stutter. The
  // helper's own parent-death watchdog covers the case where we never get here (crash).
  if (IS_WIN && p.pid) {
    try { execSync(`taskkill /F /T /PID ${p.pid}`, { stdio: 'ignore' }) } catch {}
  } else {
    try { p.kill() } catch {}
  }
}

function isMusicPlaying() { return !!musicProc }

// Safety net (call at startup): kill any ORPHANED music helper from a previous instance
// that crashed before its own watchdog fired. stop-audio.ps1 only kills helpers whose
// parent process is gone, so this never silences another open window's music.
function sweepOrphans() {
  if (!IS_WIN) return
  try { execSync(`"${POWERSHELL}" -NoProfile -ExecutionPolicy Bypass -File "${STOP_HELPER}"`, { stdio: 'ignore' }) } catch {}
}

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

module.exports = { startMusic, stopMusic, isMusicPlaying, playChime, sweepOrphans }
