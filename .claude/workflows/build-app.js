export const meta = {
  name: 'build-app',
  description: 'ChatDev-style kawaii crew: design, code, review, fix, test, secure, and document an app from a one-line spec',
  whenToUse: 'When you want to turn a one-line software spec into a working project under projects/<name>/, optionally animated live in the kawaii Kauai crew window',
  phases: [
    { title: 'Design', detail: 'Leilani the architect picks language + file structure' },
    { title: 'Code', detail: 'Kai codes one file per programmer, in parallel' },
    { title: 'Review', detail: 'Koa reads the code for bugs and gaps' },
    { title: 'Fix', detail: 'Kai applies the confirmed review findings' },
    { title: 'Test', detail: 'Ruby writes + runs tests, then a fix loop until green' },
    { title: 'Security', detail: 'Pueo runs scanners + an AI security review, then fixes' },
    { title: 'Docs', detail: 'Mahina writes the README' },
  ],
}

// ── Inputs ────────────────────────────────────────────────────────────────────
// args may be a bare spec string (headless run) or { spec, runDir } when the kawaii
// window is attached. runDir is the shared folder both the crew and the window watch.
const DEFAULT_SPEC = 'a CLI tool that converts a CSV file into a formatted Markdown table'
// args may arrive as an object, a JSON string (the Workflow tool sometimes serializes object
// args), or a bare spec string. Normalize all three so runDir is never silently lost.
function parseInput(raw) {
  if (raw && typeof raw === 'object') return raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed.startsWith('{')) {
      try { return JSON.parse(trimmed) } catch { /* not JSON — treat as a plain spec */ }
    }
    return { spec: raw }
  }
  return {}
}
const input = parseInput(args)
const spec = (typeof input.spec === 'string' && input.spec.trim()) ? input.spec.trim() : DEFAULT_SPEC
const runDir = (typeof input.runDir === 'string' && input.runDir.trim()) ? input.runDir.trim() : null

// ── The cast (kawaii Kauai islanders) ─────────────────────────────────────────
const CAST = {
  architect: { persona: 'Opal',    emoji: '🌺', label: 'architect',     to: 'coder' },
  coder:     { persona: 'Kai',     emoji: '🏄', label: 'programmer',     to: 'reviewer' },
  reviewer:  { persona: 'Starr',   emoji: '🔍', label: 'code reviewer',  to: 'coder' },
  tester:    { persona: 'Ruby',    emoji: '🌺', label: 'tester',         to: 'security' },
  security:  { persona: 'Pueo',    emoji: '🦉', label: 'security guard',  to: 'scribe' },
  scribe:    { persona: 'Mahina',  emoji: '🌙', label: 'scribe',         to: null },
}

// ── Event emission: the bridge to the kawaii window ───────────────────────────
// The orchestration script is sandboxed and cannot write files, so each agent writes
// its own start/done event files. nextSeq() controls ordering across the whole run.
let _seq = 0
const nextSeq = () => ++_seq
const pad4 = n => String(n).padStart(4, '0')

// Build the instruction block that tells an agent to announce itself in the crew window.
// Returns '' when no window is attached, so headless runs are unaffected.
function emitBlock({ seq, role, phase, to = CAST[role].to, file = null, extraDone = '' }) {
  if (!runDir) return ''
  const me = CAST[role]
  const toPersona = to && CAST[to] ? CAST[to].persona : 'the crew'
  const fileField = file ? `,\n     "file": ${JSON.stringify(file)}` : ''
  const toField = to ? `,\n     "to": ${JSON.stringify(to)}` : ''
  return `

─── REPORT YOUR STATUS TO THE CREW WINDOW (do this, it is part of the job) ───
You are ${me.persona}, the ${me.label} on a professional software development crew shipping real,
working code. The crew window shows a live feed of what the team is doing.
Each "bubble" must be a clear, factual status line a developer can read to know exactly what happened —
name the file, the approach, the count, or the result. Be concrete and technical, not cute. No emoji,
no island slang. One sentence.
  Good: "Implementing generator.py using the secrets module for cryptographically secure RNG."
  Good: "Ran pytest: 40 passed, 0 failed."
  Bad:  "Surfing into the code, woohoo!"

Use the Write tool to create BOTH event files:

1) IMMEDIATELY, before any other work, write:
   Path: ${runDir}/events/${pad4(seq)}-${role}-start.json
   {
     "seq": ${seq}, "role": "${role}", "persona": "${me.persona}", "phase": "${phase}",
     "kind": "start", "bubble": "<what you are starting: the file/component and your approach>"${fileField}
   }

2) AFTER you finish, write:
   Path: ${runDir}/events/${pad4(seq)}-${role}-done.json
   {
     "seq": ${seq}, "role": "${role}", "persona": "${me.persona}", "phase": "${phase}",
     "kind": "done", "bubble": "<what you produced or found (give counts/results), handing to ${toPersona}>"${toField}${fileField}${extraDone}
   }

NEVER edit or delete an event file — only create new ones.
───────────────────────────────────────────────────────────────────────────────`
}

const DESIGN_SCHEMA = {
  type: 'object',
  required: ['projectName', 'language', 'summary', 'files'],
  properties: {
    projectName: { type: 'string', description: 'kebab-case folder name for the project' },
    language: { type: 'string' },
    summary: { type: 'string', description: '2-3 sentence description of the design and how the pieces fit' },
    files: {
      type: 'array',
      items: {
        type: 'object',
        required: ['path', 'purpose'],
        properties: {
          path: { type: 'string', description: 'path relative to the project folder, e.g. src/main.py' },
          purpose: { type: 'string', description: 'what this file does and what it must contain' },
        },
      },
    },
  },
}

const REVIEW_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'severity', 'issue', 'fix'],
        properties: {
          file: { type: 'string' },
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          issue: { type: 'string' },
          fix: { type: 'string', description: 'concrete change that resolves the issue' },
        },
      },
    },
  },
}

const TEST_SCHEMA = {
  type: 'object',
  required: ['ranTests', 'passed', 'failed', 'failures'],
  properties: {
    framework: { type: 'string', description: 'e.g. pytest, node --test' },
    ranTests: { type: 'boolean', description: 'true if the test command actually executed' },
    passed: { type: 'integer' },
    failed: { type: 'integer' },
    failures: {
      type: 'array',
      items: {
        type: 'object',
        required: ['test', 'message'],
        properties: {
          test: { type: 'string' },
          message: { type: 'string', description: 'the assertion / error, trimmed' },
          file: { type: 'string' },
        },
      },
    },
    summary: { type: 'string' },
  },
}

const SECURITY_SCHEMA = {
  type: 'object',
  required: ['toolsRun', 'findings'],
  properties: {
    toolsRun: { type: 'array', items: { type: 'string' }, description: 'scanners actually executed, e.g. bandit, npm audit' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'file', 'issue', 'fix'],
        properties: {
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          file: { type: 'string' },
          issue: { type: 'string' },
          fix: { type: 'string' },
        },
      },
    },
  },
}

// ── Phase 1: Design (Leilani) ─────────────────────────────────────────────────
phase('Design')
const designSeq = nextSeq()
const design = await agent(
  `You are Opal, the architect who leads a professional software development crew (styled as a pack of
poodles on Kauai, but the work is real engineering). Design a project that satisfies this spec:

"${spec}"

Choose the most fitting language and a clean, minimal file structure. Prefer the standard library over
heavy dependencies. Keep the project small and focused — only the files genuinely needed. Plan for the
code to be testable (clear functions/modules a tester can import).

Return the design as structured output. projectName must be kebab-case. List every source file with a
clear purpose so a programmer can implement it without further questions.${
    emitBlock({ seq: designSeq, role: 'architect', phase: 'Design',
      extraDone: ',\n     "projectName": "<the kebab-case projectName you chose>"' })}`,
  { label: 'leilani:design', schema: DESIGN_SCHEMA },
)

const base = `projects/${design.projectName}`
log(`Opal designed "${design.projectName}" in ${design.language} — ${design.files.length} file(s)`)
log(`Output target: ${base}/  (relative to the workspace root — make sure that's the devcrew repo)`)

// ── Phase 2: Code (Kai, one programmer per file, in parallel) ─────────────────
phase('Code')
const fileList = design.files.map(f => `- ${f.path}: ${f.purpose}`).join('\n')
await parallel(design.files.map(file => {
  const seq = nextSeq()
  return () => agent(
    `You are Kai 🏄, a programmer on the software development crew building this project:

Spec: "${spec}"
Language: ${design.language}
Design summary: ${design.summary}

All files in the project:
${fileList}

Your job: implement EXACTLY this one file and write it to disk using the Write tool.
  Path: ${base}/${file.path}   (relative to the current working directory / workspace root)
  Purpose: ${file.purpose}

Write complete, working, idiomatic code — no TODOs, no placeholders, no stubbed functions. Assume the
sibling files above exist and import/reference them as designed.${
      emitBlock({ seq, role: 'coder', phase: 'Code', file: file.path })}`,
    { label: `kai:${file.path}`, phase: 'Code' },
  )
}))

// ── Phase 3: Review (Koa) ─────────────────────────────────────────────────────
phase('Review')
const reviewSeq = nextSeq()
const review = await agent(
  `You are Starr 🔍, a sharp-eyed black standard poodle and senior code reviewer on the software development crew.
Review the project just written under ${base}/ (read the files with your tools). The project should satisfy:

"${spec}"

Look for real defects: bugs, broken imports, mismatched interfaces between files, missing error
handling, and gaps versus the spec. Do NOT invent style nitpicks. Return structured findings; if the
code is genuinely correct and complete, return an empty findings array.${
    emitBlock({ seq: reviewSeq, role: 'reviewer', phase: 'Review' })}`,
  { label: 'koa:review', schema: REVIEW_SCHEMA },
)

const actionable = review.findings.filter(f => f.severity !== 'minor')
log(`Starr: ${review.findings.length} finding(s), ${actionable.length} actionable`)

// ── Phase 4: Fix (Kai applies review findings) ────────────────────────────────
if (actionable.length > 0) {
  phase('Fix')
  const fixSeq = nextSeq()
  const findingList = actionable
    .map(f => `- [${f.severity}] ${f.file}: ${f.issue}\n    Fix: ${f.fix}`).join('\n')
  await agent(
    `You are Kai 🏄, back at the keyboard. Starr the reviewer found issues in the project under ${base}/.
Read the affected files and apply these fixes using the Edit/Write tools. Make only the changes needed
to resolve each finding; keep the rest of the code intact.

Findings:
${findingList}${
      emitBlock({ seq: fixSeq, role: 'coder', phase: 'Fix', to: 'tester' })}`,
    { label: 'kai:fix-review', phase: 'Fix' },
  )
} else {
  log('No actionable review findings — Kai skips the fix phase.')
}

// ── Phase 5: Test (Ruby writes + runs tests, then a bounded fix loop) ─────────
phase('Test')
const MAX_TEST_ROUNDS = 2
let testResult = null
for (let round = 1; round <= MAX_TEST_ROUNDS; round++) {
  const testSeq = nextSeq()
  const isRetry = round > 1
  testResult = await agent(
    `You are Ruby, the tester on the crew. ${isRetry
      ? 'You are re-running the tests after Kai patched the failures from the last round.'
      : 'Write a focused test suite for the project, then run it.'}

Project: ${base}/   Language: ${design.language}
Spec it must satisfy: "${spec}"

Do this:
1. ${isRetry ? 'Make sure the existing tests still cover the behavior (add cases only if a gap is obvious).'
      : 'Write tests that cover the core behavior and the important edge cases. Put them in the conventional location for this language (e.g. tests/ for Python with pytest, or *.test.js / a test file for Node).'}
2. RUN the tests with the right command for this project using the Bash tool. Examples:
   - Python:  python -m pytest -q   (run from inside ${base})
   - Node:    npm test   or   node --test   (run from inside ${base})
   Capture the real pass/fail output. Do not fabricate results.
3. Report the outcome as structured output. failures[] must list each failing test with its real error
   message. If everything passes, failures is empty and failed is 0.${
      emitBlock({ seq: testSeq, role: 'tester', phase: 'Test',
        to: 'security',
        extraDone: ',\n     "ok": <true if all tests passed, false otherwise>' })}`,
    { label: `nalu:test-r${round}`, phase: 'Test', schema: TEST_SCHEMA },
  )

  log(`Ruby round ${round}: ${testResult.passed} passed, ${testResult.failed} failed` +
      (testResult.ranTests ? '' : ' (tests did not execute)'))

  if (!testResult.ranTests || testResult.failed === 0) break
  if (round === MAX_TEST_ROUNDS) {
    log(`Tests still failing after ${MAX_TEST_ROUNDS} rounds — moving on with known failures.`)
    break
  }

  // Hand the failures to Kai for a fix, then loop to re-test.
  const fixSeq = nextSeq()
  const failList = testResult.failures
    .map(f => `- ${f.test} (${f.file || '?'}): ${f.message}`).join('\n')
  await agent(
    `You are Kai 🏄. Ruby's tests are failing in the project under ${base}/. Read the relevant source
and test files, then fix the SOURCE code so the tests pass (only change a test if it is genuinely wrong
about the spec). Use Edit/Write.

Failing tests:
${failList}${
      emitBlock({ seq: fixSeq, role: 'coder', phase: 'Test', to: 'tester' })}`,
    { label: `kai:fix-tests-r${round}`, phase: 'Test' },
  )
}

// ── Phase 6: Security (Pueo runs scanners + AI review, then a fix) ────────────
phase('Security')
const secSeq = nextSeq()
const security = await agent(
  `You are Pueo 🦉, the night-owl security guard on the software development crew. Audit the project under ${base}/.

Language: ${design.language}
Run REAL tooling where it fits, using the Bash tool, then add your own careful review:
  - Python project: if 'bandit' isn't installed, install it quietly (pip install bandit), then run
    'bandit -r .' from inside ${base}.
  - Node project: run 'npm audit --json' from inside ${base} (after npm install if there's a package.json).
  - Always also read the code yourself for: command/SQL injection, unsafe deserialization, path
    traversal, shell=True / eval / exec on untrusted input, hardcoded secrets, and missing input
    validation.

List the scanners you actually ran in toolsRun. Report real findings only — no boilerplate. If the
project is clean, return an empty findings array.${
    emitBlock({ seq: secSeq, role: 'security', phase: 'Security' })}`,
  { label: 'pueo:audit', phase: 'Security', schema: SECURITY_SCHEMA },
)

const secActionable = security.findings.filter(f => f.severity === 'critical' || f.severity === 'high')
log(`Pueo ran [${security.toolsRun.join(', ') || 'AI review only'}]: ` +
    `${security.findings.length} finding(s), ${secActionable.length} high/critical`)

if (secActionable.length > 0) {
  const secFixSeq = nextSeq()
  const secList = secActionable
    .map(f => `- [${f.severity}] ${f.file}: ${f.issue}\n    Fix: ${f.fix}`).join('\n')
  await agent(
    `You are Kai 🏄. Pueo found security issues in the project under ${base}/. Apply these fixes with
Edit/Write, changing only what's needed to close each issue:

${secList}${
      emitBlock({ seq: secFixSeq, role: 'coder', phase: 'Security', to: 'scribe' })}`,
    { label: 'kai:fix-security', phase: 'Security' },
  )
} else {
  log('No high/critical security findings — nothing for Kai to patch.')
}

// ── Phase 7: Docs (Mahina) ────────────────────────────────────────────────────
phase('Docs')
const docSeq = nextSeq()
await agent(
  `You are Mahina 🌙, the scribe on the software development crew. Read the finished project under ${base}/ and write a
clear README.md at ${base}/README.md using the Write tool. Include: a one-paragraph description, how to
install/run it, a usage example with real input and expected output, how to run the tests, and a short
"How it works" section. Keep it concise and accurate to the actual code.${
    emitBlock({ seq: docSeq, role: 'scribe', phase: 'Docs', to: null })}`,
  { label: 'mahina:readme', phase: 'Docs' },
)

return {
  project: design.projectName,
  language: design.language,
  path: base,
  filesWritten: design.files.map(f => f.path),
  reviewFindings: review.findings.length,
  reviewFixesApplied: actionable.length,
  tests: testResult ? { passed: testResult.passed, failed: testResult.failed, ran: testResult.ranTests } : null,
  security: { toolsRun: security.toolsRun, findings: security.findings.length, highCriticalFixed: secActionable.length },
}
