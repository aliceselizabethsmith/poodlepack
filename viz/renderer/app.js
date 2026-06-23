/* Renderer: turns the crew's event stream into a beach full of poodles.
   Presentation (fur color, size, accessory) is owned here; the manifest just says
   who is in the cast. */

const ROLE_ORDER = ['architect', 'coder', 'reviewer', 'tester', 'security', 'scribe']

// Each role is a distinctly colored + sized poodle.
const CAST_STYLE = {
  // Opal & Starr are black standard poodles; Ruby is the reddish one. Each wears a
  // different-colored Hawaiian hibiscus (the `flower` color).
  architect: { color: '#22222a', size: 1.40, flower: '#ff4d6d', label: 'architect', flowerTop: -36 },
  coder:     { color: '#7bdcb5', size: 1.00, flower: '#ff8c42', label: 'programmer' },
  reviewer:  { color: '#2b2b34', size: 1.12, flower: '#a06bff', label: 'reviewer', flowerTop: -14, halo: true },
  tester:    { color: '#d96b63', size: 0.92, flower: '#ffcf33', label: 'tester' },
  security:  { color: '#9aa0b5', size: 1.12, flower: '#ff5db1', label: 'security', flowerTop: -14 },
  scribe:    { color: '#ffb0d4', size: 0.82, flower: '#6fb7ff', label: 'scribe', flowerTop: 24 },
}
const FALLBACK_STYLE = { color: '#ffb3c6', size: 1.0, flower: '#ff8fb0', label: 'crew' }

const stage = document.getElementById('stage')
const phaseBadge = document.getElementById('phase')
const specEl = document.getElementById('spec')
const tickerEl = document.getElementById('ticker-text')
const fxLayer = document.getElementById('fx')
const chatlog = document.getElementById('chatlog')
const qmodal = document.getElementById('qmodal')
const answeredQ = new Set()
const questionQueue = []
let qActive = false

const chars = {}   // role -> { el, pup, persona, style }
let svgSeq = 0

/* ── poodle artwork (pure SVG, built from fluffy overlapping circles) ──────── */
function poodleSVG(color, halo) {
  const gid = `hl${svgSeq++}`
  const haloMarkup = halo ? `
    <ellipse cx="55" cy="-18" rx="25" ry="7" fill="none" stroke="#ffd95a" stroke-width="5" opacity=".9"/>
    <ellipse cx="55" cy="-18" rx="25" ry="7" fill="none" stroke="#fff7c8" stroke-width="1.8"/>` : ''
  const fluff = [
    // topknot poof — big and fluffy
    [55, 8, 15], [42, 15, 12], [68, 15, 12], [55, 18, 14], [47, 5, 10], [63, 5, 10], [55, -1, 10],
    // head
    [55, 42, 29],
    // ears (droopy poufs each side)
    [21, 47, 13], [18, 61, 12], [25, 71, 9],
    [89, 47, 13], [92, 61, 12], [85, 71, 9],
    // chest / body fluff
    [55, 90, 30], [33, 92, 18], [77, 92, 18], [40, 104, 16], [70, 104, 16], [55, 106, 24],
    // tail pom
    [93, 84, 11], [99, 78, 7],
  ].map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join('')

  return `<svg viewBox="0 0 110 132" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="${gid}" cx="38%" cy="30%" r="80%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity=".6"/>
        <stop offset="55%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>${haloMarkup}
    <!-- ground shadow -->
    <ellipse cx="55" cy="126" rx="40" ry="7" fill="rgba(0,0,0,.14)"/>
    <!-- haunch base -->
    <ellipse cx="55" cy="108" rx="42" ry="20" fill="${color}"/>
    <!-- legs + ankle poms -->
    <ellipse cx="45" cy="116" rx="8" ry="12" fill="${color}"/>
    <ellipse cx="66" cy="116" rx="8" ry="12" fill="${color}"/>
    <circle cx="45" cy="124" r="9" fill="${color}"/>
    <circle cx="66" cy="124" r="9" fill="${color}"/>
    <!-- main fluff mass -->
    <g fill="${color}">${fluff}</g>
    <!-- soft highlight -->
    <circle cx="55" cy="42" r="29" fill="url(#${gid})"/>
    <circle cx="55" cy="92" r="30" fill="url(#${gid})"/>
    <!-- muzzle -->
    <ellipse cx="55" cy="53" rx="15" ry="12" fill="rgba(255,255,255,.35)"/>
    <!-- blush -->
    <ellipse cx="37" cy="52" rx="5.5" ry="3.4" fill="#ff8fb0" opacity=".55"/>
    <ellipse cx="73" cy="52" rx="5.5" ry="3.4" fill="#ff8fb0" opacity=".55"/>
    <!-- eyes (light rim keeps them readable on black fur too) -->
    <g stroke="rgba(255,255,255,.28)" stroke-width="1">
      <ellipse cx="45" cy="44" rx="6.2" ry="7.7" fill="#2c2622"/>
      <ellipse cx="65" cy="44" rx="6.2" ry="7.7" fill="#2c2622"/>
    </g>
    <g>
      <circle cx="43" cy="41.5" r="2.4" fill="#fff"/>
      <circle cx="63" cy="41.5" r="2.4" fill="#fff"/>
      <circle cx="47" cy="46.5" r="1.1" fill="#fff" opacity=".75"/>
      <circle cx="67" cy="46.5" r="1.1" fill="#fff" opacity=".75"/>
    </g>
    <!-- nose + mouth -->
    <ellipse cx="55" cy="50" rx="4.6" ry="3.6" fill="#4a3b34"/>
    <circle cx="53.6" cy="49" r="1.1" fill="#fff" opacity=".6"/>
    <path d="M55 53 Q55 58 50 59 M55 53 Q55 58 60 59" stroke="#4a3b34"
          stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </svg>`
}

/* a little Hawaiian hibiscus the poodle wears, tinted per character */
function flowerSVG(color) {
  const petals = [0, 72, 144, 216, 288]
    .map(a => `<ellipse cx="13" cy="6" rx="5.2" ry="7" fill="${color}" transform="rotate(${a} 13 13)"/>`)
    .join('')
  return `<svg viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
    ${petals}
    <circle cx="13" cy="13" r="4" fill="#fff3c4"/>
    <circle cx="13" cy="13" r="1.9" fill="#ffb74d"/>
    <line x1="13" y1="13" x2="13" y2="3" stroke="#fff3c4" stroke-width="1.2"/>
    <circle cx="13" cy="3" r="1.5" fill="#ffe08a"/>
  </svg>`
}

/* ── build a poodle on the stage ──────────────────────────────────────────── */
function ensureChar(role, persona) {
  if (chars[role]) {
    if (persona && chars[role].persona !== persona) {
      chars[role].persona = persona
      chars[role].el.querySelector('.pname').textContent = persona
    }
    return chars[role]
  }
  const style = CAST_STYLE[role] || FALLBACK_STYLE

  const el = document.createElement('div')
  el.className = 'poodle'
  el.style.setProperty('order', String(ROLE_ORDER.indexOf(role) + 1 || 99))
  el.innerHTML = `
    <div class="ring"></div>
    <span class="accessory"${style.flowerTop != null ? ` style="top:${style.flowerTop}px"` : ''}>${flowerSVG(style.flower)}</span>
    <div class="pup" style="--s: ${style.size}">${poodleSVG(style.color, style.halo)}</div>
    <div class="nameplate"><span class="pname">${persona || role}</span>
      <span class="role">${style.label}</span></div>`
  stage.appendChild(el)

  // keep stage in role order even if events arrive out of order
  ;[...stage.children]
    .sort((a, b) => (+a.style.order || 99) - (+b.style.order || 99))
    .forEach(node => stage.appendChild(node))

  chars[role] = { el, pup: el.querySelector('.pup'), persona, style }
  return chars[role]
}

/* ── speech bubbles ───────────────────────────────────────────────────────── */
function speak(role, text, kind) {
  const c = chars[role]
  if (!c) return
  c.el.querySelector('.bubble')?.remove()
  const b = document.createElement('div')
  b.className = `bubble ${kind || ''}`
  b.textContent = text
  // float the bubble above the head, scaled to the poodle's size so bigger dogs
  // (Opal) get more clearance and don't have the bubble overlap their fluff
  const size = (CAST_STYLE[role] || FALLBACK_STYLE).size
  b.style.bottom = `${Math.round(128 * size + 28)}px`
  c.el.appendChild(b)
  setTimeout(() => { b.classList.add('fade'); setTimeout(() => b.remove(), 400) }, 4800)
}

/* append a line to the scrolling conversation history (translucent, auto-scrolls) */
function addLog(role, persona, text, phase) {
  if (!chatlog || !text || !text.trim()) return
  const style = CAST_STYLE[role] || FALLBACK_STYLE
  const col = style.flower || style.color
  const msg = document.createElement('div')
  msg.className = 'logmsg'
  msg.style.setProperty('--c', col)
  const who = document.createElement('span')
  who.className = 'who'
  who.style.color = col
  who.textContent = persona || role
  const tag = document.createElement('span')
  tag.className = 'logphase'
  tag.textContent = phase ? ` · ${phase}` : ''
  msg.appendChild(who)
  msg.appendChild(tag)
  msg.appendChild(document.createTextNode(' — ' + text))
  chatlog.appendChild(msg)
  // keep the newest message in view as the panel outgrows its frame
  chatlog.scrollTop = chatlog.scrollHeight
}

function spotlight(role) {
  for (const r in chars) chars[r].el.classList.toggle('dim', r !== role)
  chars[role]?.el.classList.add('active')
  for (const r in chars) if (r !== role) chars[r].el.classList.remove('active')
}

/* ── flying handoff token (one poodle passes the work to the next) ─────────── */
function handoff(fromRole, toRole, emoji) {
  const from = chars[fromRole]?.pup, to = chars[toRole]?.pup
  if (!from || !to) return
  const scene = document.getElementById('scene').getBoundingClientRect()
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect()
  const tok = document.createElement('div')
  tok.className = 'token'
  tok.textContent = emoji || '🐚'
  tok.style.left = `${a.left - scene.left + a.width / 2 - 13}px`
  tok.style.top = `${a.top - scene.top + 10}px`
  fxLayer.appendChild(tok)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    tok.style.left = `${b.left - scene.left + b.width / 2 - 13}px`
    tok.style.top = `${b.top - scene.top + 10}px`
  }))
  setTimeout(() => { tok.style.opacity = '0' }, 1100)
  setTimeout(() => tok.remove(), 1500)
}

/* ── finale ───────────────────────────────────────────────────────────────── */
function celebrate(ok) {
  for (const r in chars) { chars[r].el.classList.remove('dim'); chars[r].el.classList.add('cheer') }
  phaseBadge.textContent = ok === false ? 'finished (with notes)' : 'shipped! 🎉'
  const pieces = ['🌺', '🐩', '🎉', '🌴', '⭐', '🐚', '🦩']
  for (let i = 0; i < 46; i++) {
    const c = document.createElement('div')
    c.className = 'confetti'
    c.textContent = pieces[i % pieces.length]
    c.style.left = `${(i * 2.2) % 100}%`
    c.style.animationDuration = `${2.4 + (i % 5) * 0.5}s`
    c.style.animationDelay = `${(i % 7) * 0.12}s`
    document.getElementById('scene').appendChild(c)
    setTimeout(() => c.remove(), 6000)
  }
}

/* ── question modal: a poodle asks, the user answers ──────────────────────── */
// Questions are queued so several (e.g. interface + storage) show one at a time, in order.
function enqueueQuestion(q) {
  if (!qmodal || !q || !q.id || answeredQ.has(q.id)) return
  if (questionQueue.some(x => x.id === q.id)) return
  questionQueue.push(q)
  if (!qActive) renderNextQuestion()
}

function renderNextQuestion() {
  const q = questionQueue.shift()
  if (!q) { qActive = false; qmodal.classList.add('hidden'); qmodal.innerHTML = ''; return }
  qActive = true
  const style = CAST_STYLE[q.role] || FALLBACK_STYLE
  const persona = q.persona || q.role || 'Crew'
  spotlight(q.role)
  addLog(q.role, persona, `❓ ${q.text || ''}`, 'Question')

  const finish = (answer) => {
    if (!answer || answeredQ.has(q.id)) return
    answeredQ.add(q.id)
    window.devcrew.submitAnswer(q.id, answer)
    addLog(q.role, 'You', `→ ${answer}`, 'Answer')
    renderNextQuestion() // show the next queued question, or hide if none
  }

  const card = document.createElement('div')
  card.className = 'qcard'

  const head = document.createElement('div')
  head.className = 'qhead'
  head.innerHTML = `<span class="qflower">${flowerSVG(style.flower)}</span>` +
    `<span class="qwho" style="color:${style.flower}"></span>`
  head.querySelector('.qwho').innerHTML = `${persona} <small>has a question</small>`
  card.appendChild(head)

  const text = document.createElement('div')
  text.className = 'qtext'
  text.textContent = q.text || 'Which option do you prefer?'
  card.appendChild(text)

  if (Array.isArray(q.options) && q.options.length) {
    const opts = document.createElement('div')
    opts.className = 'qopts'
    q.options.forEach(opt => {
      const btn = document.createElement('button')
      btn.className = 'qopt'
      btn.textContent = opt
      btn.onclick = () => finish(opt)
      opts.appendChild(btn)
    })
    card.appendChild(opts)
  }

  const row = document.createElement('div')
  row.className = 'qrow'
  const input = document.createElement('input')
  input.className = 'qinput'
  input.type = 'text'
  input.placeholder = 'or type your own answer…'
  input.onkeydown = (e) => { if (e.key === 'Enter') finish(input.value.trim()) }
  const send = document.createElement('button')
  send.className = 'qsend'
  send.textContent = 'Send'
  send.onclick = () => finish(input.value.trim())
  row.appendChild(input)
  row.appendChild(send)
  card.appendChild(row)

  qmodal.innerHTML = ''
  qmodal.appendChild(card)
  qmodal.classList.remove('hidden')
  // only grab focus if our window is foreground — focusing a background window dings Windows
  setTimeout(() => { if (document.hasFocus()) input.focus() }, 50)
}

/* ── wire the event streams from main ─────────────────────────────────────── */
window.devcrew.onManifest((m) => {
  if (m.spec) specEl.textContent = m.spec
  const cast = Array.isArray(m.cast) ? m.cast : []
  cast.slice().sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
      .forEach(c => ensureChar(c.role, c.persona))
})

window.devcrew.onEvent((evt) => {
  if (!evt || !evt.role) return
  const c = ensureChar(evt.role, evt.persona)
  if (evt.projectName) specEl.textContent = `building “${evt.projectName}” 🛠️`
  if (evt.phase) phaseBadge.textContent = evt.phase

  spotlight(evt.role)
  if (evt.bubble) {
    speak(evt.role, evt.bubble, evt.kind)
    addLog(evt.role, evt.persona, evt.bubble, evt.phase)
  }

  if (evt.kind === 'done' && evt.to) {
    handoff(evt.role, evt.to, '🌺')
  }
  const tag = evt.kind === 'done' ? '✓' : '…'
  tickerEl.textContent = `🌺 ${evt.persona || evt.role} · ${evt.phase || ''} ${tag} ${evt.bubble || ''}`
})

window.devcrew.onQuestion(enqueueQuestion)

window.devcrew.onStatus((s) => {
  if (s.state === 'done') celebrate(s.ok)
  else if (s.state === 'error') { phaseBadge.textContent = 'uh-oh 🌧️'; tickerEl.textContent = s.message || 'the build hit a snag.' }
})

/* kick up a big colorful sandstorm at the feet of whichever poodle is digging (active) */
const SAND_COLORS = ['#f4dba6', '#e8b96f', '#f7e7c0', '#d99a55', '#ffe0a3', '#caa15f', '#f3c79b', '#e9a86b']
setInterval(() => {
  const pup = document.querySelector('.poodle.active .pup')
  if (!pup || !fxLayer) return
  const scene = document.getElementById('scene').getBoundingClientRect()
  const r = pup.getBoundingClientRect()
  const baseX = r.left - scene.left + r.width / 2
  const baseY = r.bottom - scene.top - 12
  const count = 9 + Math.floor(Math.random() * 8) // 9-16 grains per burst
  for (let i = 0; i < count; i++) {
    const puff = document.createElement('div')
    puff.className = 'sandpuff'
    const off = (Math.random() - 0.5) * 130         // very wide spread
    const size = 6 + Math.random() * 16             // varied grain sizes
    const color = SAND_COLORS[Math.floor(Math.random() * SAND_COLORS.length)]
    puff.style.width = puff.style.height = `${size}px`
    puff.style.background = `radial-gradient(circle at 40% 35%, #fff3d6, ${color})`
    puff.style.left = `${baseX + off - size / 2}px`
    puff.style.top = `${baseY + (Math.random() - 0.5) * 12}px`
    puff.style.setProperty('--dx', `${off * 1.4}px`)
    puff.style.setProperty('--dy', `${-36 - Math.random() * 60}px`) // higher arcs
    fxLayer.appendChild(puff)
    setTimeout(() => puff.remove(), 950)
  }
}, 120)
