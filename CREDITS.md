# Credits & attribution

## Code
PoodlePack is released under the MIT License — see [LICENSE](LICENSE).

## Music — "Aloha ʻOe"
The gentle Hawaiian loop (`viz/assets/music/aloha-oe-loud.mp3`) is **"Aloha ʻOe"**,
composed by **Queen Liliʻuokalani in 1878** — the composition is in the **public domain**.

The recording is the **Crescent Trio**, a Hawaiian steel-guitar instrumental
**published in 1921**, digitized by Archive.org's Great 78 Project:
<https://archive.org/details/78_aloha-oe_crescent-trio_gbia3019236a>

It is **public domain**: under the U.S. Music Modernization Act, every sound recording
first published before 1923 entered the public domain on **January 1, 2022**. The file
here has been de-crackled, denoised, and loudness-normalized with ffmpeg.

If you fork PoodlePack and prefer your own track, drop an mp3 at
`viz/assets/music/aloha-oe-loud.mp3` (or change `MUSIC_FILE` in `viz/audio.js`).

## Completion chime
`viz/assets/sounds/chime.wav` is **generated, not sampled** — a rising E-major
arpeggio synthesized from sine partials under a bell-like decay envelope by
[`viz/tools/make-chime.cjs`](viz/tools/make-chime.cjs). Pure Node, no
dependencies, no external audio. Re-render it or retune the notes with:

```bash
node viz/tools/make-chime.cjs
```

Earlier versions of PoodlePack bundled the Windows "tada" sound here. That file
is Microsoft's and is licensed for use on Windows rather than for
redistribution, so it was removed before this repository was made public.

## Art
All poodle artwork, the Kauai beach scene, and the UI are original, drawn in code
(inline SVG + CSS) — no external image assets.
