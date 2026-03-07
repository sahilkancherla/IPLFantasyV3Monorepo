// Fantasy point calculation — mirrors calc_fantasy_points() DB function
// Run in Node so scores can be validated/previewed before DB insert

export interface RawMatchStats {
  runs: number
  ballsFaced: number
  fours: number
  sixes: number
  isOut: boolean
  wickets: number
  ballsBowled: number
  runsConceded: number
  maidens: number
  catches: number
  stumpings: number
  runOutsDirect: number
  runOutsIndirect: number
}

export function calcFantasyPoints(s: RawMatchStats): number {
  let pts = 0

  // ── Batting ─────────────────────────────────────────────
  pts += s.runs                    // 1 pt per run
  pts += s.fours                   // +1 per 4
  pts += s.sixes * 2               // +2 per 6

  if (s.runs >= 100)      pts += 25   // century
  else if (s.runs >= 50)  pts += 10   // half-century

  if (s.isOut && s.runs === 0)  pts -= 5   // duck

  if (s.ballsFaced >= 10) {
    const sr = (s.runs / s.ballsFaced) * 100
    if (sr >= 150)      pts += 5
    else if (sr < 70)   pts -= 5
  }

  // ── Bowling ──────────────────────────────────────────────
  pts += s.wickets * 20

  if (s.wickets >= 5)       pts += 30
  else if (s.wickets >= 4)  pts += 20
  else if (s.wickets >= 3)  pts += 10

  pts += s.maidens * 5

  if (s.ballsBowled >= 24) {    // min 4 overs
    const overs = s.ballsBowled / 6
    const econ  = s.runsConceded / overs
    if (econ < 6)       pts += 5
    else if (econ > 10) pts -= 5
  }

  // ── Fielding ────────────────────────────────────────────
  pts += s.catches * 5
  pts += s.stumpings * 10
  pts += s.runOutsDirect * 10
  pts += s.runOutsIndirect * 5

  return Math.round(pts * 100) / 100
}

// Get the IPL week number for a given date
export function getWeekForDate(
  date: Date,
  weeks: Array<{ week_num: number; start_date: string; end_date: string }>
): number | null {
  const d = date.toISOString().slice(0, 10)   // YYYY-MM-DD
  for (const w of weeks) {
    if (d >= w.start_date && d <= w.end_date) return w.week_num
  }
  return null
}
