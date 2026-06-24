// Transcript scanner — the heart of the background-activity dashboard.
// It reads Claude Code's own subagent transcripts (verified layout:
//   ~/.claude/projects/<encoded-cwd>/<session-id>/subagents/agent-<id>.jsonl
// and .../subagents/workflows/<wf>/agent-<id>.jsonl ) and reports, for each
// agent, its task and current action. No dependence on hook payload internals —
// the transcript files are the ground truth.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'

export const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects')
const ACTIVE_MS = 45_000 // a transcript touched within this window = the agent is live

function safeReaddir(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }) } catch { return [] }
}

// every agent-*.jsonl under a session's subagents/ (including nested workflow dirs)
function collectAgentFiles(subagentsDir) {
  const out = []
  const walk = (dir) => {
    for (const ent of safeReaddir(dir)) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) walk(full)
      else if (ent.isFile() && /^agent-.*\.jsonl$/.test(ent.name)) out.push(full)
    }
  }
  walk(subagentsDir)
  return out
}

function readLines(file) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter(l => l.trim())
  } catch { return [] }
}

function parse(line) { try { return JSON.parse(line) } catch { return null } }

// the full first user message — the agent's assignment (used for kind classification)
function firstUserText(lines) {
  for (const line of lines) {
    const e = parse(line)
    if (e && e.type === 'user' && e.message) {
      const c = e.message.content
      return (typeof c === 'string' ? c
        : Array.isArray(c) ? c.map(b => (typeof b === 'string' ? b : b.text || '')).join(' ') : '')
        .replace(/\s+/g, ' ').trim()
    }
  }
  return ''
}

// a short, human task label — drop the crew persona preamble ("You are X, a Y …
// building this project:") so the nameplate shows the real assignment, not boilerplate
function cleanTask(full) {
  let t = full.replace(/^You are .*?building this project:?\s*/i, '')
  if (t === full) t = full.replace(/^You are [^.,:]*[.,:]\s*/i, '')
  const m = t.match(/(?:Spec|Your job|Task)\s*:?\s*"?([^"\n]{4,90})/i)
  return ((m ? m[1] : t).trim().slice(0, 80)) || 'working'
}

function baseName(p) { return p ? path.basename(String(p)) : '' }

// turn a tool_use into a short human phrase
function toolPhrase(name, input = {}) {
  switch (name) {
    case 'Read': return `reading ${baseName(input.file_path)}`
    case 'Edit': return `editing ${baseName(input.file_path)}`
    case 'Write': return `writing ${baseName(input.file_path)}`
    case 'Bash': return `running: ${String(input.command || '').slice(0, 48)}`
    case 'Grep': return `searching for "${String(input.pattern || '').slice(0, 40)}"`
    case 'Glob': return `finding files: ${input.pattern || ''}`
    case 'WebFetch': return `reading ${baseName(input.url) || input.url || 'a page'}`
    case 'WebSearch': return `web search: ${String(input.query || '').slice(0, 40)}`
    case 'Task': case 'Agent': return 'delegating a sub-task'
    case 'TodoWrite': return 'updating its plan'
    default: return `${name}…`
  }
}

// the agent's current action, from the latest assistant content
function actionOf(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    const e = parse(lines[i])
    if (!e || !e.message) continue
    if (e.type === 'assistant' && Array.isArray(e.message.content)) {
      for (let j = e.message.content.length - 1; j >= 0; j--) {
        const b = e.message.content[j]
        if (b.type === 'tool_use') return toolPhrase(b.name, b.input)
        if (b.type === 'text' && b.text && b.text.trim()) {
          const t = b.text.trim().replace(/\s+/g, ' ')
          return t.length > 220 ? `${t.slice(0, 220)}…` : t
        }
      }
      return 'thinking…'
    }
    if (e.type === 'user') return 'reviewing results…' // tool results came back; next action pending
  }
  return 'working…'
}

// agent kind (for poodle styling) inferred from the task wording
function kindOf(task) {
  const t = task.toLowerCase()
  if (/\b(audit|security|vulnerab|cve|injection)\b/.test(t)) return 'security'
  if (/\b(review|critique|inspect)\b/.test(t)) return 'reviewer'
  if (/\b(test|pytest|coverage)\b/.test(t)) return 'tester'
  if (/\b(research|investigate|find out|docs?)\b/.test(t)) return 'researcher'
  if (/\b(write|document|readme|summar)/.test(t)) return 'scribe'
  if (/\b(implement|build|code|refactor|fix)\b/.test(t)) return 'coder'
  return 'agent'
}

// maxReadAgeMs: don't open/parse transcripts older than this — only fresh ones can
// be in the dashboard roster, so skipping stale files avoids re-reading the whole
// (50+ MB) corpus every poll tick.
export function scan({ activeMs = ACTIVE_MS, maxReadAgeMs = Infinity } = {}) {
  const now = Date.now()
  const agents = []
  for (const proj of safeReaddir(PROJECTS_DIR)) {
    if (!proj.isDirectory()) continue
    const projDir = path.join(PROJECTS_DIR, proj.name)
    for (const sess of safeReaddir(projDir)) {
      if (!sess.isDirectory()) continue
      const subDir = path.join(projDir, sess.name, 'subagents')
      for (const file of collectAgentFiles(subDir)) {
        let st
        try { st = fs.statSync(file) } catch { continue }
        const age = now - st.mtimeMs
        if (age > maxReadAgeMs) continue // stale: stat only, never read the contents
        const lines = readLines(file)
        if (!lines.length) continue
        const full = firstUserText(lines)
        agents.push({
          agentId: path.basename(file).replace(/^agent-|\.jsonl$/g, ''),
          project: proj.name,
          session: sess.name,
          file,
          mtimeMs: st.mtimeMs,
          ageMs: age,
          active: age < activeMs,
          task: cleanTask(full),
          kind: kindOf(full),
          action: actionOf(lines),
        })
      }
    }
  }
  return agents.sort((a, b) => b.mtimeMs - a.mtimeMs)
}

// CLI: `node scan.mjs` (active only) | `node scan.mjs --all`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const all = process.argv.includes('--all')
  const agents = scan({ activeMs: all ? Infinity : ACTIVE_MS })
  const show = all ? agents : agents.filter(a => a.active)
  process.stdout.write(`${show.length} agent transcript(s)${all ? '' : ' active'}:\n`)
  for (const a of show) {
    const ageS = Math.round(a.ageMs / 1000)
    process.stdout.write(`  [${a.kind}] ${a.agentId.slice(0, 8)} ${a.active ? '●' : '○'} ${ageS}s ago\n`)
    process.stdout.write(`     task:   ${a.task}\n`)
    process.stdout.write(`     action: ${a.action}\n`)
  }
}
