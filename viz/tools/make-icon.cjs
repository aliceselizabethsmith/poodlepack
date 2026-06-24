// One-off: render the brand poodle (Opal — black standard poodle + red hibiscus) on a
// soft Kauai background and capture it to viz/assets/icon.png at a few sizes, then build
// a multi-size icon.ico for the Windows title bar + taskbar.
//   node_modules/.bin/electron viz/tools/make-icon.cjs
const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const ASSETS = path.join(__dirname, '..', 'assets')

// The hibiscus flower EMOJI on a TRANSPARENT canvas — the app's mark, vivid and legible
// even at 16px. Sized to fit the whole flower with margin so nothing is clipped.
const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:256px;height:256px;overflow:hidden;background:transparent}
  .bg{width:256px;height:256px;display:flex;align-items:center;justify-content:center;
      font-family:'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif;
      font-size:172px;line-height:1}
  .pup{filter:drop-shadow(0 4px 5px rgba(0,0,0,.22))}
</style></head><body>
  <div class="bg"><span class="pup">🌺</span></div>
</body></html>`

// Pack several PNG sizes into a Vista+ .ico (each entry is a PNG payload).
function buildIco(entriesIn) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2)               // type = icon
  header.writeUInt16LE(entriesIn.length, 4)
  const dir = Buffer.alloc(16 * entriesIn.length)
  let offset = 6 + dir.length
  const datas = []
  entriesIn.forEach((e, i) => {
    const d = dir.subarray(16 * i, 16 * i + 16)
    d.writeUInt8(e.size >= 256 ? 0 : e.size, 0) // width (0 means 256)
    d.writeUInt8(e.size >= 256 ? 0 : e.size, 1) // height
    d.writeUInt16LE(1, 4)                       // planes
    d.writeUInt16LE(32, 6)                      // bpp
    d.writeUInt32LE(e.buf.length, 8)            // byte size
    d.writeUInt32LE(offset, 12)                 // offset
    offset += e.buf.length
    datas.push(e.buf)
  })
  return Buffer.concat([header, dir, ...datas])
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 256, height: 256, show: false, frame: false, transparent: true, backgroundColor: '#00000000', webPreferences: {} })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(HTML))
  await new Promise((r) => setTimeout(r, 400)) // let it paint
  const img = await win.webContents.capturePage()
  fs.writeFileSync(path.join(ASSETS, 'icon.png'), img.toPNG())
  const sizes = [256, 128, 64, 48, 32, 16]
  const entries = sizes.map((s) => ({ size: s, buf: img.resize({ width: s, height: s }).toPNG() }))
  fs.writeFileSync(path.join(ASSETS, 'icon.ico'), buildIco(entries))
  win.destroy()
  process.stdout.write('wrote assets/icon.png + assets/icon.ico (16-256)\n')
  app.quit()
})
