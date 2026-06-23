// Sliding-window fuzzy project name resolver.
// No external dependencies — pure Levenshtein on word windows.

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  // Space-optimised: single rolling row
  const row = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= n; j++) {
      const temp = row[j]
      row[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, row[j - 1], row[j])
      prev = temp
    }
  }
  return row[n]
}

function normalizedSim(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length)
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Score how well a query matches a single project name.
// Uses a sliding window of (project word count) over the query words,
// plus a penalised partial-window scan for partial name references (e.g. "Berkeley" → "Berkeley Square").
function scoreMatch(query: string, projectName: string): number {
  const q = normalize(query)
  const p = normalize(projectName)

  if (!q || !p) return 0
  if (q.includes(p)) return 1 // exact substring → perfect match

  const qWords = q.split(' ').filter(Boolean)
  const pWords = p.split(' ').filter(Boolean)
  const wSize = pWords.length

  let best = 0

  // Full-length window — covers "broccoli square" vs "berkeley square"
  if (qWords.length >= wSize) {
    for (let i = 0; i <= qWords.length - wSize; i++) {
      const window = qWords.slice(i, i + wSize).join(' ')
      best = Math.max(best, normalizedSim(window, p))
    }
  }

  // Shorter windows — covers "Berkeley" (1 word) referencing "Berkeley Square" (2 words).
  // Score is penalised by the fraction of the project name covered.
  if (wSize > 1) {
    for (let sz = 1; sz < wSize; sz++) {
      const coverage = sz / wSize
      for (let qi = 0; qi <= qWords.length - sz; qi++) {
        const qWindow = qWords.slice(qi, qi + sz).join(' ')
        for (let pi = 0; pi <= pWords.length - sz; pi++) {
          const pWindow = pWords.slice(pi, pi + sz).join(' ')
          best = Math.max(best, normalizedSim(qWindow, pWindow) * coverage)
        }
      }
    }
  }

  return best
}

// Minimum score to accept a match.
// 0.5 accepts "broccoli square" → "Berkeley Square" (score ~0.53)
// but rejects "I want a square apartment" → "Berkeley Square" (~0.44).
const THRESHOLD = 0.5

export interface FuzzyResult<T> {
  project: T
  score: number
  wasFuzzy: boolean // false = exact substring match, true = fuzzy
}

export function resolveProject<T extends { project_name: string | null }>(
  query: string,
  projects: T[]
): FuzzyResult<T> | null {
  if (!query.trim() || projects.length === 0) return null

  const q = normalize(query)
  let best: FuzzyResult<T> | null = null
  let hasTie = false

  for (const project of projects) {
    if (!project.project_name) continue
    const p = normalize(project.project_name)
    const exactMatch = q.includes(p)
    const score = exactMatch ? 1 : scoreMatch(query, project.project_name)

    if (score < THRESHOLD) continue

    if (!best || score > best.score) {
      best = { project, score, wasFuzzy: !exactMatch }
      hasTie = false
    } else if (score === best.score) {
      hasTie = true
    }
  }

  return hasTie ? null : best
}
