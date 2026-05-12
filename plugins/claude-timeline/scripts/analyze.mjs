import fs from 'fs'
import path from 'path'
import { readConfig, OUR_CACHE, STATUSBAR_CACHE_DIR, PROJECTS_DIR } from './config.mjs'

const SESSION_LEN_MS = 5 * 3600 * 1000

function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

function rateLimitFromStdin(stdin) {
  const rl = stdin?.rate_limits?.five_hour
  if (!rl || rl.used_percentage == null || !rl.resets_at) return null
  return {
    pct: rl.used_percentage,
    resetsAt: rl.resets_at * 1000,
    sevenDayPct: stdin?.rate_limits?.seven_day?.used_percentage ?? null,
    sevenDayResetsAt: (stdin?.rate_limits?.seven_day?.resets_at || 0) * 1000 || null,
  }
}

function readOurCache() {
  if (!fs.existsSync(OUR_CACHE)) return null
  let stat
  try { stat = fs.statSync(OUR_CACHE) } catch { return null }
  const j = readJsonSafe(OUR_CACHE)
  const rl = rateLimitFromStdin(j)
  return rl ? { ...rl, cachedAt: stat.mtimeMs, sourceFile: OUR_CACHE } : null
}

function readStatusbarCache() {
  if (!fs.existsSync(STATUSBAR_CACHE_DIR)) return null
  let best = null
  for (const dir of fs.readdirSync(STATUSBAR_CACHE_DIR)) {
    const f = path.join(STATUSBAR_CACHE_DIR, dir, 'last_stdin.json')
    try {
      const stat = fs.statSync(f)
      if (!best || stat.mtimeMs > best.mtimeMs) best = { f, mtimeMs: stat.mtimeMs }
    } catch {}
  }
  if (!best) return null
  const j = readJsonSafe(best.f)
  const rl = rateLimitFromStdin(j)
  return rl ? { ...rl, cachedAt: best.mtimeMs, sourceFile: best.f } : null
}

export function resolveRateLimit(cfg = readConfig()) {
  if (cfg.source === 'self') return readOurCache()
  if (cfg.source === 'statusbar') return readStatusbarCache()
  // auto: prefer ours (first-party), fall back to statusbar
  return readOurCache() || readStatusbarCache()
}

function* walk(d) {
  let ents
  try { ents = fs.readdirSync(d, { withFileTypes: true }) } catch { return }
  for (const e of ents) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (e.isFile() && p.endsWith('.jsonl')) yield p
  }
}

export function buildSnapshot(now = Date.now()) {
  const cfg = readConfig()
  const rl = resolveRateLimit(cfg)
  let sessionStart, sessionEnd, currentPct
  let dataSource

  if (rl) {
    sessionEnd = rl.resetsAt
    sessionStart = sessionEnd - SESSION_LEN_MS
    currentPct = rl.pct
    dataSource = rl.sourceFile.includes('claude-timeline') ? 'own statusLine capture' : 'claude-statusbar cache'
  } else {
    sessionStart = null
    sessionEnd = null
    currentPct = null
    dataSource = 'heuristic (no statusLine data found)'
  }

  const scanCutoff = sessionStart || (now - 24 * 3600 * 1000)
  const events = []
  const seenMsg = new Map()
  const seenUuid = new Set()

  for (const file of walk(PROJECTS_DIR)) {
    let stat
    try { stat = fs.statSync(file) } catch { continue }
    if (stat.mtimeMs < scanCutoff) continue
    const project = path.basename(path.dirname(file))
      .replace(/^-/, '/').replace(/-/g, '/')
      .replace(new RegExp(`^${process.env.HOME}/?`), '~/')
    const session = path.basename(file, '.jsonl')
    let content
    try { content = fs.readFileSync(file, 'utf8') } catch { continue }
    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      let j
      try { j = JSON.parse(line) } catch { continue }
      const ts = new Date(j.timestamp || 0).getTime()
      if (!ts || ts < scanCutoff) continue
      if (j.uuid) {
        if (seenUuid.has(j.uuid)) continue
        seenUuid.add(j.uuid)
      }
      if (j.type === 'user') {
        const c = j.message?.content
        const isHuman = !j.isSidechain && !j.isMeta && !j.isCompactSummary && typeof c === 'string' && !c.startsWith('<') && !c.startsWith('Caveat:')
        if (isHuman) events.push({ kind: 'prompt', ts, project, session, text: c.slice(0, 200) })
        continue
      }
      if (j.type === 'assistant' && j.message?.usage) {
        const u = j.message.usage
        const id = j.message.id || j.requestId
        const tot = (u.input_tokens||0) + (u.cache_creation_input_tokens||0) + (u.cache_read_input_tokens||0) + (u.output_tokens||0)
        const weighted = (u.input_tokens||0) + 1.25*(u.cache_creation_input_tokens||0) + 0.1*(u.cache_read_input_tokens||0) + 5*(u.output_tokens||0)
        if (id && seenMsg.has(id)) {
          const prev = seenMsg.get(id)
          if (tot > prev.tot) { prev.tot = tot; prev.weighted = weighted; prev.out = u.output_tokens||0 }
          continue
        }
        const ev = { kind: 'usage', ts, project, session, tot, weighted, out: u.output_tokens||0 }
        events.push(ev)
        if (id) seenMsg.set(id, ev)
      }
    }
  }

  events.sort((a,b) => a.ts - b.ts)

  if (!sessionStart) {
    const prompts = events.filter(e => e.kind === 'prompt')
    if (prompts.length) {
      sessionStart = prompts[0].ts
      for (let i = 1; i < prompts.length; i++) {
        if (prompts[i].ts - prompts[i-1].ts > SESSION_LEN_MS) sessionStart = prompts[i].ts
      }
      sessionEnd = sessionStart + SESSION_LEN_MS
    } else {
      sessionStart = now - SESSION_LEN_MS
      sessionEnd = now
    }
  }

  const sessionEvents = events.filter(e => e.ts >= sessionStart && e.ts <= now)
  const promptsBySession = new Map()
  for (const ev of sessionEvents) {
    if (ev.kind === 'prompt') {
      if (!promptsBySession.has(ev.session)) promptsBySession.set(ev.session, [])
      promptsBySession.get(ev.session).push({ ...ev, tokens: 0, weighted: 0, calls: 0 })
    } else if (ev.kind === 'usage') {
      const list = promptsBySession.get(ev.session)
      if (list && list.length) {
        const p = list[list.length - 1]
        p.tokens += ev.tot
        p.weighted += ev.weighted
        p.calls += 1
      }
    }
  }
  const allPrompts = []
  for (const list of promptsBySession.values()) allPrompts.push(...list)
  allPrompts.sort((a,b) => a.ts - b.ts)

  const totalTokens = sessionEvents.filter(e => e.kind==='usage').reduce((s,e) => s+e.tot, 0)
  const totalWeighted = sessionEvents.filter(e => e.kind==='usage').reduce((s,e) => s+e.weighted, 0)

  const series = []
  let cumTok = 0, cumPrompts = 0
  for (const ev of sessionEvents) {
    if (ev.kind === 'usage') cumTok += ev.tot
    else if (ev.kind === 'prompt') cumPrompts += 1
    series.push({ ts: ev.ts, cumTok, cumPrompts })
  }

  return {
    generatedAt: now,
    sessionStart, sessionEnd,
    currentPct,
    sevenDayPct: rl?.sevenDayPct ?? null,
    sevenDayResetsAt: rl?.sevenDayResetsAt ?? null,
    dataSource,
    totalTokens, totalWeighted,
    promptCount: allPrompts.length,
    series,
    prompts: allPrompts.map(p => ({ ts: p.ts, text: p.text, tokens: p.tokens, weighted: p.weighted, calls: p.calls, project: p.project })),
  }
}
