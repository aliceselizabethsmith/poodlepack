// Synthesize the completion chime to viz/assets/sounds/chime.wav.
//   node viz/tools/make-chime.cjs
//
// This replaces the Windows "tada" sound that used to sit here. That file is
// Microsoft's, licensed for use on Windows rather than for redistribution, so
// shipping it in a public MIT repo was not ours to do. Generating the chime
// instead also matches how everything else in PoodlePack is made: the poodles,
// the beach and the whole UI are drawn in code, with no external art.
//
// Pure Node, no dependencies. Additive synthesis: a rising E-major arpeggio,
// each note a few harmonics under an exponential decay, which is the cheapest
// way to get something bell-like rather than a flat sine beep.

const fs = require('fs')
const path = require('path')

const SAMPLE_RATE = 44100
const DURATION = 1.4
const OUT = path.join(__dirname, '..', 'assets', 'sounds', 'chime.wav')

// E major, ascending, landing an octave above where it started. Each note is
// struck 80 ms after the last so they overlap and ring together as a chord
// rather than reading as four separate beeps.
const NOTES = [
  { freq: 659.25, start: 0.00 }, // E5
  { freq: 830.61, start: 0.08 }, // G#5
  { freq: 987.77, start: 0.16 }, // B5
  { freq: 1318.51, start: 0.24 }, // E6
]

// Harmonic weights. The slightly-sharp 4.1x partial is what stops it sounding
// like an organ: real struck bells have inharmonic overtones.
const PARTIALS = [
  { mult: 1.0, amp: 1.00 },
  { mult: 2.0, amp: 0.42 },
  { mult: 3.0, amp: 0.22 },
  { mult: 4.1, amp: 0.11 },
]

const DECAY = 0.55 // seconds to 1/e
const ATTACK = 0.004 // short ramp; without it the note onset clicks

const frames = Math.floor(SAMPLE_RATE * DURATION)
const samples = new Float64Array(frames)

for (const note of NOTES) {
  const startFrame = Math.floor(note.start * SAMPLE_RATE)
  for (let i = startFrame; i < frames; i++) {
    const t = (i - startFrame) / SAMPLE_RATE
    // Test decay alone for the cutoff. Testing the full envelope would break
    // on the first sample of every note, where the attack ramp is still zero.
    const decay = Math.exp(-t / DECAY)
    if (decay < 1e-5) break
    const attack = t < ATTACK ? t / ATTACK : 1
    const envelope = attack * decay

    let value = 0
    for (const p of PARTIALS) {
      // Higher partials decay faster, as they do on a real bell.
      value += p.amp * Math.exp(-t * (p.mult - 1) * 0.7) *
               Math.sin(2 * Math.PI * note.freq * p.mult * t)
    }
    samples[i] += value * envelope
  }
}

// Fade the last 80 ms to zero so the file cannot end on a discontinuity.
const fadeFrames = Math.floor(0.08 * SAMPLE_RATE)
for (let i = frames - fadeFrames; i < frames; i++) {
  samples[i] *= (frames - i) / fadeFrames
}

// Normalize to -1 dBFS. Peak depends on how the four notes happen to align, so
// measure it rather than guessing a safe fixed gain.
let peak = 0
for (const s of samples) peak = Math.max(peak, Math.abs(s))
const gain = peak > 0 ? (10 ** (-1 / 20)) / peak : 1

const BYTES_PER_SAMPLE = 2
const dataBytes = frames * BYTES_PER_SAMPLE
const buffer = Buffer.alloc(44 + dataBytes)

buffer.write('RIFF', 0)
buffer.writeUInt32LE(36 + dataBytes, 4)
buffer.write('WAVE', 8)
buffer.write('fmt ', 12)
buffer.writeUInt32LE(16, 16) // PCM header size
buffer.writeUInt16LE(1, 20) // format: PCM
buffer.writeUInt16LE(1, 22) // channels: mono
buffer.writeUInt32LE(SAMPLE_RATE, 24)
buffer.writeUInt32LE(SAMPLE_RATE * BYTES_PER_SAMPLE, 28) // byte rate
buffer.writeUInt16LE(BYTES_PER_SAMPLE, 32) // block align
buffer.writeUInt16LE(16, 34) // bits per sample
buffer.write('data', 36)
buffer.writeUInt32LE(dataBytes, 40)

for (let i = 0; i < frames; i++) {
  const clamped = Math.max(-1, Math.min(1, samples[i] * gain))
  buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * BYTES_PER_SAMPLE)
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, buffer)
console.log(`wrote ${OUT}  (${(buffer.length / 1024).toFixed(1)} KB, ${DURATION}s, ${SAMPLE_RATE} Hz mono)`)
