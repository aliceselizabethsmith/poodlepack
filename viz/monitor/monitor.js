/* Activity dashboard renderer — a live kennel of whatever background agents are
   running. Reuses the poodle art + scene from the build window (../renderer/style.css). */

const stage = document.getElementById('stage')
const chatlog = document.getElementById('chatlog')
const summaryEl = document.getElementById('summary')
const tickerEl = document.getElementById('ticker-text')
const fxLayer = document.getElementById('fx')
const muteBtn = document.getElementById('mute')
const music = document.getElementById('music')

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

/* ── completion chime (synthesized; plays even when window is unfocused) ──────*/
let muted = false
let audioCtx = null
function chime() {
  if (muted) return
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    const t0 = audioCtx.currentTime
    ;[880, 1174.7, 1567.98].forEach((freq, i) => {       // a soft rising arpeggio
      const o = audioCtx.createOscillator(), g = audioCtx.createGain()
      o.type = 'sine'; o.frequency.value = freq
      const start = t0 + i * 0.11
      g.gain.setValueAtTime(0, start)
      g.gain.linearRampToValueAtTime(0.16, start + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0008, start + 0.6)
      o.connect(g); g.connect(audioCtx.destination); o.start(start); o.stop(start + 0.62)
    })
  } catch { /* audio unavailable — silent */ }
}
// gentle Hawaiian background loop
if (music) {
  music.volume = 0.32
  music.play().catch(() => { /* a click on the speaker will start it */ })
}
muteBtn.addEventListener('click', () => {
  muted = !muted
  muteBtn.textContent = muted ? '🔇' : '🔊'
  if (muted) { music?.pause() }
  else {
    music?.play().catch(() => {})
    if (audioCtx?.state === 'suspended') audioCtx.resume()
  }
})

// if autoplay was blocked, kick the music off on the first interaction
function ensureMusic() {
  if (music && !muted && music.paused) music.play().catch(() => {})
  if (audioCtx?.state === 'suspended') audioCtx.resume()
}
window.addEventListener('click', ensureMusic)
window.addEventListener('keydown', ensureMusic)

/* ── roster reconciliation ───────────────────────────────────────────────────*/
const live = new Map() // agentId -> { el, poodleEl, bubbleEl, kind, action, state }

function makeCard(a) {
  const s = styleFor(a.kind)
  const card = document.createElement('div')
  card.className = 'agent-card'
  const bubble = document.createElement('div')
  bubble.className = 'cardbubble'
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
  return { el: card, poodleEl: poodle, bubbleEl: bubble, kind: a.kind, action: null, state: null }
}

function shortTask(task) {
  // strip the build-crew persona preamble if present, keep it terse
  return String(task || '').replace(/^You are \w+[^,]*,?\s*/i, '').slice(0, 26)
}

// returns true if the action text changed
function setBubble(rec, text) {
  if (rec.action === text) return false
  rec.action = text
  rec.bubbleEl.textContent = text
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
    c.style.fontSize = `${20 + Math.random() * 22}px`
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
  summaryEl.textContent = working
    ? `${working} background agent${working > 1 ? 's' : ''} working…`
    : (live.size ? 'wrapping up…' : 'the kennel is quiet — no background agents running')
  const latest = roster[0]
  tickerEl.textContent = latest ? `🌺 ${latest.kind} · ${latest.action}` : '🐩 watching for background agents…'
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
