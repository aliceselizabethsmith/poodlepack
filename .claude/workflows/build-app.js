export const meta = {
  name: 'build-app',
  description: 'ChatDev-style crew: design, code, review, fix, and document an app from a one-line spec',
  whenToUse: 'When you want to turn a one-line software spec into a working project under projects/<name>/',
  phases: [
    { title: 'Design', detail: 'CTO picks language + file structure' },
    { title: 'Code', detail: 'one programmer per file, written in parallel' },
    { title: 'Review', detail: 'reviewer reads the code for bugs and gaps' },
    { title: 'Fix', detail: 'programmer applies the confirmed findings' },
    { title: 'Docs', detail: 'doc writer produces the README' },
  ],
}

// The one-line spec comes in via `args`. Fall back to a sample so a bare run still demonstrates the flow.
const spec = (typeof args === 'string' && args.trim())
  ? args.trim()
  : 'a CLI tool that converts a CSV file into a formatted Markdown table'

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

// ── Phase 1: Design ───────────────────────────────────────────────────────────
phase('Design')
const design = await agent(
  `You are the CTO of a small software crew. Design a project that satisfies this spec:

"${spec}"

Choose the most fitting language and a clean, minimal file structure. Prefer the standard library
over heavy dependencies. Keep the project small and focused — only the files genuinely needed.

Return the design as structured output. projectName must be kebab-case. List every source file with
a clear purpose so a programmer can implement it without further questions.`,
  { label: 'cto:design', schema: DESIGN_SCHEMA },
)

const base = `projects/${design.projectName}`
log(`Designing "${design.projectName}" in ${design.language} — ${design.files.length} file(s)`)

// ── Phase 2: Code (one programmer per file, in parallel) ──────────────────────
phase('Code')
const fileList = design.files.map(f => `- ${f.path}: ${f.purpose}`).join('\n')
await parallel(design.files.map(file => () =>
  agent(
    `You are a programmer on a crew building this project:

Spec: "${spec}"
Language: ${design.language}
Design summary: ${design.summary}

All files in the project:
${fileList}

Your job: implement EXACTLY this one file and write it to disk using the Write tool.
  Path: ${base}/${file.path}   (relative to the devcrew repo root)
  Purpose: ${file.purpose}

Write complete, working, idiomatic code — no TODOs, no placeholders, no stubbed functions.
Assume the sibling files above exist and import/reference them as designed. After writing the file,
return a one-line confirmation of what you wrote.`,
    { label: `code:${file.path}`, phase: 'Code' },
  )
))

// ── Phase 3: Review ───────────────────────────────────────────────────────────
phase('Review')
const review = await agent(
  `You are a senior code reviewer. Review the project just written under ${base}/ (read the files
with your tools). The project should satisfy:

"${spec}"

Look for real defects: bugs, broken imports, mismatched interfaces between files, missing error
handling, and gaps versus the spec. Do NOT invent style nitpicks. Return structured findings; if the
code is genuinely correct and complete, return an empty findings array.`,
  { label: 'reviewer', schema: REVIEW_SCHEMA },
)

const actionable = review.findings.filter(f => f.severity !== 'minor')
log(`Review: ${review.findings.length} finding(s), ${actionable.length} actionable`)

// ── Phase 4: Fix (only if there is something worth fixing) ─────────────────────
if (actionable.length > 0) {
  phase('Fix')
  const findingList = actionable
    .map(f => `- [${f.severity}] ${f.file}: ${f.issue}\n    Fix: ${f.fix}`).join('\n')
  await agent(
    `You are the programmer. The reviewer found issues in the project under ${base}/. Read the
affected files and apply these fixes using the Edit/Write tools. Make only the changes needed to
resolve each finding; keep the rest of the code intact.

Findings:
${findingList}

After editing, return a one-line summary of what you changed.`,
    { label: 'fix:apply', phase: 'Fix' },
  )
} else {
  log('No actionable findings — skipping fix phase.')
}

// ── Phase 5: Docs ─────────────────────────────────────────────────────────────
phase('Docs')
await agent(
  `You are a technical writer. Read the finished project under ${base}/ and write a clear README.md
at ${base}/README.md using the Write tool. Include: a one-paragraph description, how to install/run
it, a usage example with real input and expected output, and a short "How it works" section.
Keep it concise and accurate to the actual code. Return a one-line confirmation when done.`,
  { label: 'docs:readme' },
)

return {
  project: design.projectName,
  language: design.language,
  path: base,
  filesWritten: design.files.map(f => f.path),
  reviewFindings: review.findings.length,
  fixesApplied: actionable.length,
}
