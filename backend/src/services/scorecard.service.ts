import { pool } from '../db/client.js'

export interface ScorecardStat {
  playerId: string; scorecardName: string; isInXI: boolean
  runs: number; ballsFaced: number; fours: number; sixes: number
  isOut: boolean; dismissalText: string
  wickets: number; ballsBowled: number; runsConceded: number
  maidens: number; lbwBowledWickets: number
  catches: number; stumpings: number; runOutsDirect: number; runOutsIndirect: number
}

interface ParsedBatter {
  scorecardName: string; dismissalText: string
  runs: number; ballsFaced: number; fours: number; sixes: number; isOut: boolean
}
interface ParsedBowler {
  scorecardName: string
  ballsBowled: number; maidens: number; runsConceded: number; wickets: number
}
interface DismissalInfo {
  batterName: string
  type: 'caught' | 'caught_and_bowled' | 'bowled' | 'lbw' | 'stumped' | 'runout_direct' | 'runout_indirect' | 'not_out' | 'did_not_bat' | 'other'
  fielder1Name: string | null; fielder2Name: string | null; lbwBowledBowlerName: string | null
}

function parseOvers(s: string): number | null {
  const m = String(s).match(/^(\d+)(?:\.([0-5]))?$/)
  if (!m) return null
  return parseInt(m[1]) * 6 + (m[2] ? parseInt(m[2]) : 0)
}
function cleanName(n: string): string {
  return n.replace(/\([^)]*\)/g, '').replace(/[†*]/g, '').replace(/\s+/g, ' ').trim()
}
function isNotOut(d: string): boolean {
  return /^(not\s+out|did\s+not\s+bat|retired\s+(not\s+out|hurt)|absent|dnb)/i.test(d.trim())
}
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim()
}
function parseDismissal(batterName: string, t: string): DismissalInfo {
  if (/^(not\s+out|retired\s+(not\s+out|hurt)|absent)/i.test(t))
    return { batterName, type: 'not_out', fielder1Name: null, fielder2Name: null, lbwBowledBowlerName: null }
  if (/^did\s+not\s+bat/i.test(t))
    return { batterName, type: 'did_not_bat', fielder1Name: null, fielder2Name: null, lbwBowledBowlerName: null }
  const cAndB = t.match(/^c\s*&\s*b\s+(.+)$/i)
  if (cAndB) return { batterName, type: 'caught_and_bowled', fielder1Name: cAndB[1].trim(), fielder2Name: null, lbwBowledBowlerName: null }
  const caught = t.match(/^c\s+(.+?)\s+b\s+\S/i)
  if (caught) return { batterName, type: 'caught', fielder1Name: caught[1].trim(), fielder2Name: null, lbwBowledBowlerName: null }
  const lbw = t.match(/^lbw\s+b\s+(.+)$/i)
  if (lbw) return { batterName, type: 'lbw', fielder1Name: null, fielder2Name: null, lbwBowledBowlerName: lbw[1].trim() }
  const bowled = t.match(/^b\s+(.+)$/i)
  if (bowled) return { batterName, type: 'bowled', fielder1Name: null, fielder2Name: null, lbwBowledBowlerName: bowled[1].trim() }
  const stumped = t.match(/^st\s+[†]?\s*(.+?)\s+b\s+/i)
  if (stumped) return { batterName, type: 'stumped', fielder1Name: stumped[1].trim(), fielder2Name: null, lbwBowledBowlerName: null }
  const roTwo = t.match(/run\s+out\s*\(\s*([^/)]+?)\s*\/\s*([^)]+?)\s*\)/i)
  if (roTwo) return { batterName, type: 'runout_indirect', fielder1Name: roTwo[1].trim(), fielder2Name: roTwo[2].trim(), lbwBowledBowlerName: null }
  const roOne = t.match(/run\s+out\s*\(\s*([^)]+?)\s*\)?$/i)
  if (roOne) return { batterName, type: 'runout_direct', fielder1Name: roOne[1].trim(), fielder2Name: null, lbwBowledBowlerName: null }
  return { batterName, type: 'other', fielder1Name: null, fielder2Name: null, lbwBowledBowlerName: null }
}
function normaliseScorecardUrl(u: string): string {
  const m = u.match(/(cricbuzz\.com\/(?:live-cricket-scorecard|live-cricket-scores|cricket-match-facts)\/\d+)/)
  if (m) return `https://www.${m[1].replace('live-cricket-scores', 'live-cricket-scorecard')}/scorecard`
  return u
}
function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()
}
function bigramSim(a: string, b: string): number {
  const bg = (s: string) => { const set = new Set<string>(); const t = s.replace(/\s/g, ''); for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2)); return set }
  const ba = bg(a); const bb = bg(b); let inter = 0
  for (const g of ba) if (bb.has(g)) inter++
  return ba.size + bb.size === 0 ? 0 : (2 * inter) / (ba.size + bb.size)
}

export async function parseScorecardUrl(rawUrl: string, matchId: string): Promise<{ matched: ScorecardStat[]; unmatched: string[] }> {
  const fetchUrl = normaliseScorecardUrl(rawUrl)
  const res = await fetch(fetchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Failed to fetch scorecard: HTTP ${res.status}`)
  const html = await res.text()

  // ── Parse batting + bowling ──────────────────────────────────────────────
  const batters: ParsedBatter[] = []
  const bowlers: ParsedBowler[] = []

  if (html.includes('scorecard-bat-grid')) {
    const seenBat = new Set<string>(); const seenBowl = new Set<string>()
    for (const sec of html.split('<div class="grid scorecard-bat-grid').slice(1)) {
      const nameM = sec.match(/<a[^>]+\/profiles\/(\d+)\/[^"]*"[^>]*>([^<]+)<\/a>/)
      if (!nameM) continue
      const name = cleanName(nameM[2])
      if (!name || /^(Batter|Extras|Total|Fall of Wickets|Did not bat)$/i.test(name)) continue
      const dismissalM = sec.match(/<\/a><div[^>]*>([\s\S]*?)<\/div>/)
      const dismissal = dismissalM ? stripTags(dismissalM[1]) || 'not out' : 'not out'
      const nums = [...sec.matchAll(/<div class="flex justify-center[^"]*">(\d+(?:\.\d+)?)<\/div>/g)].map(m => m[1])
      if (nums.length < 4) continue
      const key = `${nameM[1]}-${nums[0]}-${nums[1]}`
      if (seenBat.has(key)) continue; seenBat.add(key)
      batters.push({ scorecardName: name, dismissalText: dismissal, runs: parseInt(nums[0]), ballsFaced: parseInt(nums[1]), fours: parseInt(nums[2]), sixes: parseInt(nums[3]), isOut: !isNotOut(dismissal) })
    }
    for (const sec of html.split('<div class="grid scorecard-bowl-grid').slice(1)) {
      const nameM = sec.match(/<a[^>]+\/profiles\/(\d+)\/[^"]*"[^>]*>([^<]+)<\/a>/)
      if (!nameM) continue
      const name = cleanName(nameM[2])
      if (!name || /^Bowler$/i.test(name)) continue
      const nums = [...sec.matchAll(/<div class="[^"]*(?:justify-center|items-center)[^"]*">(\d+(?:\.\d+)?)<\/div>/g)].map(m => m[1])
      if (nums.length < 4) continue
      const key = `${nameM[1]}-${nums[2]}-${nums[3]}`
      if (seenBowl.has(key)) continue; seenBowl.add(key)
      bowlers.push({ scorecardName: name, ballsBowled: parseOvers(nums[0]) ?? 0, maidens: parseInt(nums[1]), runsConceded: parseInt(nums[2]), wickets: parseInt(nums[3]) })
    }
  }

  // Generic HTML table fallback
  if (batters.length === 0 && bowlers.length === 0) {
    const DISMISSAL_RE = /^(c\s|c\s*&|lbw|not\s+out|did\s+not\s+bat|run\s+out|b\s|st\s|retired|absent)/i
    const rows = html
      .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<\/tr>/gi, '\n').replace(/<\/t[dh]>/gi, '\t').replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#?\w+;/g, ' ')
      .split('\n').map(l => l.split('\t').map(c => c.replace(/\s+/g, ' ').trim()).filter(Boolean)).filter(c => c.length >= 4)
    for (const cols of rows) {
      if (cols.length >= 6 && DISMISSAL_RE.test(cols[1]) && /^\d+$/.test(cols[2])) {
        const dismissal = cols[1].trim()
        batters.push({ scorecardName: cleanName(cols[0]), dismissalText: dismissal, runs: parseInt(cols[2]) || 0, ballsFaced: parseInt(cols[3]) || 0, fours: parseInt(cols[4]) || 0, sixes: parseInt(cols[5]) || 0, isOut: !isNotOut(dismissal) })
      } else if (cols.length >= 5) {
        const balls = parseOvers(cols[1])
        if (balls !== null && /^\d+$/.test(cols[2]) && /^\d+$/.test(cols[3]) && /^\d+$/.test(cols[4]))
          bowlers.push({ scorecardName: cleanName(cols[0]), ballsBowled: balls, maidens: parseInt(cols[2]), runsConceded: parseInt(cols[3]), wickets: parseInt(cols[4]) })
      }
    }
  }

  if (batters.length === 0 && bowlers.length === 0)
    throw new Error('Could not extract batting or bowling data from the page.')

  // ── Dismissal parsing ────────────────────────────────────────────────────
  const dismissals = batters.map(b => parseDismissal(b.scorecardName, b.dismissalText))

  // ── Fetch players for name matching ──────────────────────────────────────
  const { rows: matchRows } = await pool.query<{ home_team: string; away_team: string }>(
    `SELECT home_team, away_team FROM ipl_matches WHERE id = $1`, [matchId]
  )
  const matchTeams = matchRows[0] ? [matchRows[0].home_team, matchRows[0].away_team] : []
  const { rows: playerRows } = await pool.query<{ id: string; name: string }>(
    matchTeams.length === 2
      ? `SELECT id, name FROM players WHERE is_active = true AND ipl_team = ANY($1)`
      : `SELECT id, name FROM players WHERE is_active = true`,
    matchTeams.length === 2 ? [matchTeams] : []
  )

  // ── Name matching ─────────────────────────────────────────────────────────
  function matchPlayerName(scorecardName: string): string | null {
    const sc = normName(scorecardName); const scToks = sc.split(' '); const scLast = scToks[scToks.length - 1]
    for (const p of playerRows) { if (normName(p.name) === sc) return p.id }
    const byLastName = playerRows.filter(p => { const t = normName(p.name).split(' '); return t[t.length - 1] === scLast })
    if (byLastName.length === 1) return byLastName[0].id
    if (byLastName.length > 1 && scToks.length > 1) {
      for (const p of byLastName) {
        const dbToks = normName(p.name).split(' ')
        if (scToks.slice(0, -1).every((t, i) => dbToks[i]?.[0] === t[0])) return p.id
      }
    }
    let best = 0; let bestId: string | null = null
    for (const p of playerRows) { const s = bigramSim(sc, normName(p.name)); if (s > best) { best = s; bestId = p.id } }
    return best >= 0.6 ? bestId : null
  }

  const allNames = new Set<string>()
  for (const b of batters) allNames.add(b.scorecardName)
  for (const b of bowlers) allNames.add(b.scorecardName)
  for (const d of dismissals) {
    if (d.fielder1Name) allNames.add(d.fielder1Name)
    if (d.fielder2Name) allNames.add(d.fielder2Name)
    if (d.lbwBowledBowlerName) allNames.add(d.lbwBowledBowlerName)
  }
  const nameToUUID = new Map<string, string>(); const unmatched: string[] = []
  for (const name of allNames) {
    const id = matchPlayerName(name)
    if (id) nameToUUID.set(name.toLowerCase().trim(), id); else unmatched.push(name)
  }
  if (unmatched.length > 0) console.warn('[scorecard] unmatched names:', unmatched)

  const lookup = (n: string | null) => n ? (nameToUUID.get(n.toLowerCase().trim()) ?? null) : null

  // ── Fielding credits ─────────────────────────────────────────────────────
  const catches = new Map<string, number>(); const stumpings = new Map<string, number>()
  const runOutsDirect = new Map<string, number>(); const runOutsIndir = new Map<string, number>()
  const lbwBowledMap = new Map<string, number>()
  for (const d of dismissals) {
    const f1 = lookup(d.fielder1Name); const f2 = lookup(d.fielder2Name)
    if (d.type === 'caught' || d.type === 'caught_and_bowled') { if (f1) catches.set(f1, (catches.get(f1) ?? 0) + 1) }
    else if (d.type === 'stumped') { if (f1) stumpings.set(f1, (stumpings.get(f1) ?? 0) + 1) }
    else if (d.type === 'runout_direct') { if (f1) runOutsDirect.set(f1, (runOutsDirect.get(f1) ?? 0) + 1) }
    else if (d.type === 'runout_indirect') { if (f1) runOutsIndir.set(f1, (runOutsIndir.get(f1) ?? 0) + 1); if (f2) runOutsIndir.set(f2, (runOutsIndir.get(f2) ?? 0) + 1) }
    if (d.lbwBowledBowlerName) { const id = lookup(d.lbwBowledBowlerName); if (id) lbwBowledMap.set(id, (lbwBowledMap.get(id) ?? 0) + 1) }
  }

  // ── Merge into per-player stat rows ──────────────────────────────────────
  const statsMap = new Map<string, ScorecardStat>()
  for (const b of batters) {
    const id = lookup(b.scorecardName); if (!id) continue
    const ex = statsMap.get(id)
    statsMap.set(id, { playerId: id, scorecardName: b.scorecardName, isInXI: true, runs: b.runs, ballsFaced: b.ballsFaced, fours: b.fours, sixes: b.sixes, isOut: b.isOut, dismissalText: b.dismissalText, wickets: ex?.wickets ?? 0, ballsBowled: ex?.ballsBowled ?? 0, runsConceded: ex?.runsConceded ?? 0, maidens: ex?.maidens ?? 0, lbwBowledWickets: ex?.lbwBowledWickets ?? 0, catches: 0, stumpings: 0, runOutsDirect: 0, runOutsIndirect: 0 })
  }
  for (const b of bowlers) {
    const id = lookup(b.scorecardName); if (!id) continue
    const ex = statsMap.get(id) ?? { playerId: id, scorecardName: b.scorecardName, isInXI: true, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false, dismissalText: '', catches: 0, stumpings: 0, runOutsDirect: 0, runOutsIndirect: 0, lbwBowledWickets: 0 } as ScorecardStat
    statsMap.set(id, { ...ex, wickets: b.wickets, ballsBowled: b.ballsBowled, runsConceded: b.runsConceded, maidens: b.maidens, lbwBowledWickets: lbwBowledMap.get(id) ?? 0 })
  }
  // Add zero-stat entries for pure fielders who never batted or bowled
  const allFielderIds = new Set<string>([
    ...catches.keys(), ...stumpings.keys(), ...runOutsDirect.keys(), ...runOutsIndir.keys(),
  ])
  for (const fielderId of allFielderIds) {
    if (!statsMap.has(fielderId)) {
      const scorecardName = [...nameToUUID.entries()].find(([, id]) => id === fielderId)?.[0] ?? fielderId
      statsMap.set(fielderId, {
        playerId: fielderId, scorecardName, isInXI: true,
        runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false, dismissalText: '',
        wickets: 0, ballsBowled: 0, runsConceded: 0, maidens: 0, lbwBowledWickets: 0,
        catches: 0, stumpings: 0, runOutsDirect: 0, runOutsIndirect: 0,
      })
    }
  }

  const matched: ScorecardStat[] = [...statsMap.values()].map(s => ({
    ...s,
    catches:         catches.get(s.playerId)       ?? 0,
    stumpings:       stumpings.get(s.playerId)     ?? 0,
    runOutsDirect:   runOutsDirect.get(s.playerId) ?? 0,
    runOutsIndirect: runOutsIndir.get(s.playerId)  ?? 0,
  }))

  console.log('[scorecard] parsed:', { matched: matched.length, unmatched: unmatched.length, url: fetchUrl })
  return { matched, unmatched }
}
