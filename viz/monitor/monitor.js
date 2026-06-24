/* Activity dashboard renderer — a live kennel of whatever background agents are
   running. Reuses the poodle art + scene from the build window (../renderer/style.css). */

const stage = document.getElementById('stage')
const chatlog = document.getElementById('chatlog')
const summaryEl = document.getElementById('summary')
const taskEl = document.getElementById('taskline')
const tickerEl = document.getElementById('ticker-text')
const fxLayer = document.getElementById('fx')
const muteBtn = document.getElementById('mute')

/* dark or light ink, whichever reads better on the given chip color */
function readableInk(hex) {
  const c = String(hex || '').replace('#', '')
  if (c.length < 6) return '#fff'
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#5b4636' : '#fff'
}

/* the persistent task line under the header — shows the featured agent's task, with the
   label chip tinted to that agent's flower color. Clears to empty (hidden via
   .taskline:empty) when the kennel is idle. */
function setTaskLine(label, text, color) {
  if (!taskEl) return
  taskEl.textContent = ''
  if (!text) return
  const lbl = document.createElement('span'); lbl.className = 'tl-label'; lbl.textContent = label
  if (color) { lbl.style.background = color; lbl.style.color = readableInk(color) }
  const txt = document.createElement('span'); txt.className = 'tl-text'; txt.textContent = text
  taskEl.append(lbl, txt)
}

// agent kind -> poodle look (mirrors the build cast where it overlaps)
const KIND_STYLE = {
  architect:  { color: '#22222a', flower: '#ff4d6d', size: 1.05 },
  coder:      { color: '#7bdcb5', flower: '#ff8c42', size: 1.0 },
  reviewer:   { color: '#2b2b34', flower: '#a06bff', size: 1.0 },
  tester:     { color: '#d96b63', flower: '#ffcf33', size: 0.95 },
  security:   { color: '#9aa0b5', flower: '#ff5db1', size: 1.0 },
  scribe:     { color: '#ffb0d4', flower: '#6fb7ff', size: 0.92 },
  researcher: { color: '#7ec8ff', flower: '#ffd24d', size: 1.0 },
  agent:      { color: '#c9a6e0', flower: '#ff8fb0', size: 1.0 },
}
const styleFor = (kind) => KIND_STYLE[kind] || KIND_STYLE.agent

/* ── poodle art (kept in sync with the build window) ─────────────────────────*/
let svgSeq = 0
function poodleSVG(color) {
  const gid = `k${svgSeq++}`
  const fluff = [
    [55, 40, 30], [55, 19, 18],                       // smooth head + topknot
    [55, 90, 30], [33, 92, 18], [77, 92, 18], [40, 104, 16], [70, 104, 16], [55, 106, 24], // body
    [93, 84, 11], [99, 78, 7],                         // tail pom
  ].map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join('')
  return `<svg viewBox="0 0 110 132" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="${gid}" cx="38%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#fff" stop-opacity=".6"/><stop offset="55%" stop-color="#fff" stop-opacity="0"/>
    </radialGradient></defs>
    <ellipse cx="55" cy="126" rx="40" ry="7" fill="rgba(0,0,0,.14)"/>
    <ellipse cx="55" cy="108" rx="42" ry="20" fill="${color}"/>
    <ellipse cx="45" cy="116" rx="8" ry="12" fill="${color}"/><ellipse cx="66" cy="116" rx="8" ry="12" fill="${color}"/>
    <circle cx="45" cy="124" r="9" fill="${color}"/><circle cx="66" cy="124" r="9" fill="${color}"/>
    <g fill="${color}"><ellipse cx="19" cy="58" rx="12" ry="19"/><ellipse cx="91" cy="58" rx="12" ry="19"/></g>
    <g fill="${color}">${fluff}</g>
    <circle cx="55" cy="92" r="30" fill="url(#${gid})"/>
    <ellipse cx="55" cy="53" rx="15" ry="12" fill="rgba(255,255,255,.35)"/>
    <ellipse cx="37" cy="52" rx="5.5" ry="3.4" fill="#ff8fb0" opacity=".55"/><ellipse cx="73" cy="52" rx="5.5" ry="3.4" fill="#ff8fb0" opacity=".55"/>
    <g stroke="rgba(255,255,255,.28)" stroke-width="1"><ellipse cx="45" cy="44" rx="6.2" ry="7.7" fill="#2c2622"/><ellipse cx="65" cy="44" rx="6.2" ry="7.7" fill="#2c2622"/></g>
    <g><circle cx="43" cy="41.5" r="2.4" fill="#fff"/><circle cx="63" cy="41.5" r="2.4" fill="#fff"/><circle cx="47" cy="46.5" r="1.1" fill="#fff" opacity=".75"/><circle cx="67" cy="46.5" r="1.1" fill="#fff" opacity=".75"/></g>
    <ellipse cx="55" cy="50" rx="4.6" ry="3.6" fill="#4a3b34"/><circle cx="53.6" cy="49" r="1.1" fill="#fff" opacity=".6"/>
    <path d="M55 53 Q55 58 50 59 M55 53 Q55 58 60 59" stroke="#4a3b34" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </svg>`
}
function flowerSVG(color) {
  const petals = [0, 72, 144, 216, 288].map(a => `<ellipse cx="13" cy="6" rx="5.2" ry="7" fill="${color}" transform="rotate(${a} 13 13)"/>`).join('')
  return `<svg viewBox="0 0 26 26"><g>${petals}</g><circle cx="13" cy="13" r="4" fill="#fff3c4"/><circle cx="13" cy="13" r="1.9" fill="#ffb74d"/></svg>`
}

/* ── audio (played by the main process via the OS, not Electron) ─────────────*/
let muted = false
function chime() { if (!muted) window.kennel.chime() } // OS completion sound
window.kennel.playMusic(true)                          // start the OS music loop
muteBtn.addEventListener('click', () => {
  muted = !muted
  muteBtn.textContent = muted ? '🔇' : '🔊'
  window.kennel.playMusic(!muted)
})

/* ── roster reconciliation ───────────────────────────────────────────────────*/
const live = new Map() // agentId -> { el, poodleEl, bubbleEl, kind, action, state }

function makeCard(a) {
  const s = styleFor(a.kind)
  const card = document.createElement('div')
  card.className = 'agent-card'
  const bubble = document.createElement('div')
  bubble.className = 'cardbubble'
  const btext = document.createElement('span')
  btext.className = 'bubbletext'
  bubble.appendChild(btext)
  const poodle = document.createElement('div')
  poodle.className = 'poodle'
  poodle.innerHTML = `
    <div class="ring"></div>
    <div class="pup" style="--s:1">${poodleSVG(s.color)}<span class="accessory">${flowerSVG(s.flower)}</span></div>
    <div class="nameplate"><span class="pname">${a.kind}</span>
      <span class="role">${shortTask(a.task)}</span></div>`
  card.appendChild(bubble)
  card.appendChild(poodle)
  stage.appendChild(card)
  const rec = { el: card, poodleEl: poodle, bubbleEl: bubble, bubbleTextEl: btext, kind: a.kind, agent: a, action: null, state: null }
  card.style.cursor = 'pointer'
  card.addEventListener('click', () => showSummary(rec))
  return rec
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}
function projName(p) {
  const m = String(p || '').match(/repos-(.+)$/)
  return m ? m[1].replace(/-/g, '/') : (p || '')
}

// click a poodle -> a little summary card with its full task + current action
function showSummary(rec) {
  const a = rec.agent
  if (!a) return
  const s = styleFor(a.kind)
  let pop = document.getElementById('summarypop')
  if (!pop) { pop = document.createElement('div'); pop.id = 'summarypop'; document.getElementById('scene').appendChild(pop) }
  pop.innerHTML =
    `<button class="sp-close" aria-label="close">×</button>` +
    `<div class="sp-head"><span class="sp-flower">${flowerSVG(s.flower)}</span>` +
    `<span class="sp-kind" style="color:${s.flower}">${escapeHtml(a.kind)}</span>` +
    `<span class="sp-state">${rec.state === 'done' ? '✓ done' : 'working…'}</span></div>` +
    `<div class="sp-row"><span class="sp-label">Task</span><span class="sp-val">${escapeHtml(a.task)}</span></div>` +
    `<div class="sp-row"><span class="sp-label">Now</span><span class="sp-val">${escapeHtml(a.action)}</span></div>` +
    (a.project ? `<div class="sp-meta">📁 ${escapeHtml(projName(a.project))}</div>` : '')
  pop.querySelector('.sp-close').onclick = () => pop.classList.remove('show')
  pop.classList.add('show')
}
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.getElementById('summarypop')?.classList.remove('show')
})

function shortTask(task) {
  return String(task || '').slice(0, 30) // task is already cleaned in the scanner
}

// returns true if the action text changed
function setBubble(rec, text) {
  if (rec.action === text) return false
  rec.action = text
  rec.bubbleTextEl.textContent = text
  rec.bubbleEl.title = text // hover shows the full text when clamped
  rec.bubbleEl.classList.remove('pulse'); void rec.bubbleEl.offsetWidth; rec.bubbleEl.classList.add('pulse')
  return true
}

// rolling chat history of agent actions
function addLog(a) {
  if (!chatlog) return
  const s = styleFor(a.kind)
  const msg = document.createElement('div')
  msg.className = 'logmsg'
  msg.style.setProperty('--c', s.flower)
  msg.title = `${a.kind} — ${a.action}` // hover shows the full entry
  const who = document.createElement('span')
  who.className = 'who'; who.style.color = s.flower; who.textContent = a.kind
  msg.appendChild(who)
  msg.appendChild(document.createTextNode(' — ' + a.action))
  chatlog.appendChild(msg)
  while (chatlog.children.length > 80) chatlog.removeChild(chatlog.firstChild)
  chatlog.scrollTop = chatlog.scrollHeight
}

function celebrate(rec) {
  rec.poodleEl.classList.add('cheer')
  const scene = document.getElementById('scene').getBoundingClientRect()
  const r = rec.el.getBoundingClientRect()
  const cx = r.left - scene.left + r.width / 2
  const cy = r.top - scene.top + r.height * 0.45
  const pieces = ['🌺', '🐩', '⭐', '🎉', '🐚', '🌴', '🦩', '✨', '🥳']
  for (let i = 0; i < 34; i++) {                          // bigger burst
    const c = document.createElement('div')
    c.className = 'confetti'
    c.textContent = pieces[i % pieces.length]
    c.style.fontSize = `${13 + Math.random() * 12}px`
    c.style.left = `${cx + (Math.random() - 0.5) * 280}px`
    c.style.top = `${cy + (Math.random() - 0.5) * 60}px`
    c.style.animationDuration = `${2.2 + Math.random() * 1.8}s`
    c.style.animationDelay = `${Math.random() * 0.3}s`
    fxLayer.appendChild(c)
    setTimeout(() => c.remove(), 4500)
  }
}

window.kennel.onRoster((roster) => {
  const ids = new Set(roster.map(a => a.agentId))

  for (const a of roster) {
    let rec = live.get(a.agentId)
    if (!rec) { rec = makeCard(a); live.set(a.agentId, rec) }
    rec.agent = a // keep fresh for the click-summary popup
    if (setBubble(rec, a.action)) addLog(a)
    if (a.state === 'working') { rec.poodleEl.classList.add('active'); rec.poodleEl.classList.remove('cheer') }
    if (a.state === 'done' && rec.state !== 'done') { rec.poodleEl.classList.remove('active'); celebrate(rec); chime() }
    rec.state = a.state
  }
  // drop agents that fell out of the roster (lingered out)
  for (const [id, rec] of live) {
    if (!ids.has(id)) { rec.el.remove(); live.delete(id) }
  }

  const working = roster.filter(a => a.state === 'working').length
  // when idle, leave the header summary empty — the centered "napping" line carries
  // it, so the top bar isn't a third copy of the same message
  summaryEl.textContent = working
    ? `${working} background agent${working > 1 ? 's' : ''} working…`
    : (live.size ? 'wrapping up…' : '')
  const latest = roster[0]
  tickerEl.textContent = latest ? `🌺 ${latest.kind} · ${latest.action}` : '🐩 watching for background agents…'
  setTaskLine(latest ? latest.kind : '', latest ? latest.task : '', latest ? styleFor(latest.kind).flower : '')
  document.body.classList.toggle('idle', live.size === 0)
  fitStage()
})

// scale every card down by a uniform factor until the whole kennel fits without
// scrolling — so no poodle is ever cut off, whatever the count or window size
function fitStage() {
  stage.style.setProperty('--cs', '1')
  if (stage.scrollHeight <= stage.clientHeight + 1) return // fits at full size
  let lo = 0.4, hi = 1
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2
    stage.style.setProperty('--cs', String(mid))
    if (stage.scrollHeight <= stage.clientHeight + 1) lo = mid
    else hi = mid
  }
  stage.style.setProperty('--cs', String(lo))
}
window.addEventListener('resize', fitStage)

/* every actively-working poodle kicks up a little sandstorm at its feet */
const SAND_COLORS = ['#f4dba6', '#e8b96f', '#f7e7c0', '#d99a55', '#ffe0a3', '#caa15f', '#f3c79b', '#e9a86b']
setInterval(() => {
  if (!fxLayer) return
  const pups = document.querySelectorAll('.poodle.active .pup')
  if (!pups.length) return
  const scene = document.getElementById('scene').getBoundingClientRect()
  pups.forEach((pup) => {
    const r = pup.getBoundingClientRect()
    const baseX = r.left - scene.left + r.width / 2
    const baseY = r.bottom - scene.top - 8
    const count = 2 + Math.floor(Math.random() * 2)
    for (let i = 0; i < count; i++) {
      const puff = document.createElement('div')
      puff.className = 'sandpuff'
      const off = (Math.random() - 0.5) * (r.width * 0.95)
      const size = 5 + Math.random() * 9
      const color = SAND_COLORS[Math.floor(Math.random() * SAND_COLORS.length)]
      puff.style.width = puff.style.height = `${size}px`
      puff.style.background = `radial-gradient(circle at 40% 35%, #fff3d6, ${color})`
      puff.style.left = `${baseX + off - size / 2}px`
      puff.style.top = `${baseY + (Math.random() - 0.5) * 8}px`
      puff.style.setProperty('--dx', `${off * 1.2}px`)
      puff.style.setProperty('--dy', `${-22 - Math.random() * 30}px`)
      fxLayer.appendChild(puff)
      setTimeout(() => puff.remove(), 800)
    }
  })
}, 180)
