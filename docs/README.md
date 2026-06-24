# Demo assets

Screenshots/clips the main [README](../README.md) embeds, plus longer clips for sharing.
Filenames are referenced from the README — **keep them exact**.

## What to capture

| File | Used in | Type | Length | Content |
|------|---------|------|--------|---------|
| `poodlepack.gif` | README header | GIF (loop) | ≤ 15s | Tracker demo — lots of motion (poodles working + a celebration) |
| `watch.png` | README Watch section | screenshot | — | The Kennel with a few agents working |
| `build.png` | README Build section | screenshot | — | The Build crew mid-pipeline (bubbles + a handoff) |
| `watch.mp4` | Discord / sharing | video | 30–45s | A Kennel run, start through a celebration |
| `build.mp4` | Discord / sharing | video | 60–90s | A small Build, sped up 3–4× |

## Recording the demos

Each scripted demo runs **without Claude Code**. From `viz/`:

```bash
npm run demo:tracker            # the agent tracker (Kennel) — short, snappy actions
npm run demo:tracker:detailed   # the tracker with in-depth, realistic action text
npm run demo:pipeline           # the Poodle Pipeline (Build crew)
```

Screen-record the window — Windows: `Win+G` (Game Bar) or OBS; macOS: `Cmd+Shift+5`; Linux: OBS.

## Converting a recording to an optimized GIF (the header)

Keep the header GIF short and small. Trim first if needed, then palette-encode for crisp color:

```bash
# trim to the best ≤15s
ffmpeg -i raw.mp4 -ss 0 -t 15 -c copy poodlepack.mp4

# 1) build a color palette  2) render the GIF with it
ffmpeg -i poodlepack.mp4 -vf "fps=15,scale=900:-1:flags=lanczos,palettegen" palette.png
ffmpeg -i poodlepack.mp4 -i palette.png -lavfi "fps=15,scale=900:-1:flags=lanczos[x];[x][1:v]paletteuse" poodlepack.gif
```

Aim for a few MB at most. (`docs/` is not git-ignored — commit the final assets here.)
