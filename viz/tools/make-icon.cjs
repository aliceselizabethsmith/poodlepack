// One-off: render the brand poodle (Opal — black standard poodle + red hibiscus) on a
// soft Kauai background and capture it to viz/assets/icon.png at a few sizes, then build
// a multi-size icon.ico for the Windows title bar + taskbar.
//   node_modules/.bin/electron viz/tools/make-icon.cjs
const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const ASSETS = path.join(__dirname, '..', 'assets')

// The poodle, drawn the same way the app draws Opal (black fluff + face + a hibiscus).
const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:256px;height:256px;overflow:hidden}
  .bg{width:256px;height:256px;display:flex;align-items:flex-end;justify-content:center;
      background:radial-gradient(circle at 50% 34%, #ffe9c6 0%, #ffc6d2 62%, #c9a7eb 100%)}
  .sand{position:absolute;left:0;right:0;bottom:0;height:34%;
        background:linear-gradient(180deg,#f6e0b5,#e9c98c)}
  svg.pup{width:182px;height:218px;margin-bottom:6px;position:relative;
          filter:drop-shadow(0 6px 5px rgba(0,0,0,.20))}
</style></head><body>
  <div class="bg"><div class="sand"></div>
  <svg class="pup" viewBox="0 0 110 132" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="55" cy="126" rx="40" ry="7" fill="rgba(0,0,0,.14)"/>
    <ellipse cx="55" cy="108" rx="42" ry="20" fill="#22222a"/>
    <ellipse cx="45" cy="116" rx="8" ry="12" fill="#22222a"/>
    <ellipse cx="66" cy="116" rx="8" ry="12" fill="#22222a"/>
    <circle cx="45" cy="124" r="9" fill="#22222a"/>
    <circle cx="66" cy="124" r="9" fill="#22222a"/>
    <g fill="#22222a"><ellipse cx="19" cy="58" rx="12" ry="19"/><ellipse cx="91" cy="58" rx="12" ry="19"/></g>
    <g fill="#22222a">
      <circle cx="55" cy="40" r="30"/><circle cx="55" cy="19" r="18"/>
      <circle cx="55" cy="90" r="30"/><circle cx="33" cy="92" r="18"/><circle cx="77" cy="92" r="18"/>
      <circle cx="40" cy="104" r="16"/><circle cx="70" cy="104" r="16"/><circle cx="55" cy="106" r="24"/>
      <circle cx="93" cy="84" r="11"/><circle cx="99" cy="78" r="7"/>
    </g>
    <ellipse cx="55" cy="53" rx="15" ry="12" fill="rgba(255,255,255,.35)"/>
    <ellipse cx="37" cy="52" rx="5.5" ry="3.4" fill="#ff8fb0" opacity=".55"/>
    <ellipse cx="73" cy="52" rx="5.5" ry="3.4" fill="#ff8fb0" opacity=".55"/>
    <g stroke="rgba(255,255,255,.28)" stroke-width="1">
      <ellipse cx="45" cy="44" rx="6.2" ry="7.7" fill="#2c2622"/>
      <ellipse cx="65" cy="44" rx="6.2" ry="7.7" fill="#2c2622"/>
    </g>
    <circle cx="43" cy="41.5" r="2.4" fill="#fff"/><circle cx="63" cy="41.5" r="2.4" fill="#fff"/>
    <circle cx="47" cy="46.5" r="1.1" fill="#fff" opacity=".75"/><circle cx="67" cy="46.5" r="1.1" fill="#fff" opacity=".75"/>
    <ellipse cx="55" cy="50" rx="4.6" ry="3.6" fill="#4a3b34"/>
    <circle cx="53.6" cy="49" r="1.1" fill="#fff" opacity=".6"/>
    <path d="M55 53 Q55 58 50 59 M55 53 Q55 58 60 59" stroke="#4a3b34" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <g transform="translate(66 -2) scale(1.05)">
      <g fill="#ff4d6d">
        <ellipse cx="13" cy="6" rx="5.2" ry="7"/>
        <ellipse cx="13" cy="6" rx="5.2" ry="7" transform="rotate(72 13 13)"/>
        <ellipse cx="13" cy="6" rx="5.2" ry="7" transform="rotate(144 13 13)"/>
        <ellipse cx="13" cy="6" rx="5.2" ry="7" transform="rotate(216 13 13)"/>
        <ellipse cx="13" cy="6" rx="5.2" ry="7" transform="rotate(288 13 13)"/>
      </g>
      <circle cx="13" cy="13" r="4" fill="#fff3c4"/><circle cx="13" cy="13" r="1.9" fill="#ffb74d"/>
    </g>
  </svg></div>
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
  const win = new BrowserWindow({ width: 256, height: 256, show: false, webPreferences: {} })
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
