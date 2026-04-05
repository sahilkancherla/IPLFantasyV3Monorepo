// Fantasy point calculation — mirrors calc_fantasy_points() DB function
// Run in Node so scores can be validated/previewed before DB insert

export interface RawMatchStats {
  role: string   // 'batsman' | 'wicket_keeper' | 'all_rounder' | 'bowler'
  runs: number
  ballsFaced: number
  fours: number
  sixes: number
  isOut: boolean
  wickets: number
  ballsBowled: number
  runsConceded: number
  maidens: number
  lbwBowledWickets: number
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

  // Milestone bonuses are mutually exclusive — only the highest applies
  if (s.runs >= 100)      pts += 16   // century
  else if (s.runs >= 50)  pts += 8    // half-century
  else if (s.runs >= 30)  pts += 4    // 30-run bonus

  if (s.isOut && s.runs === 0)  pts -= 2   // duck

  // ── Bowling ──────────────────────────────────────────────
  pts += s.wickets * 25                // 25 pts per wicket
  pts += s.lbwBowledWickets * 8        // +8 per LBW/bowled wicket

  // Haul bonuses are mutually exclusive — only the highest applies
  if (s.wickets >= 5)       pts += 16
  else if (s.wickets >= 4)  pts += 8
  else if (s.wickets >= 3)  pts += 4

  pts += s.maidens * 12                // 12 pts per maiden

  if (s.ballsBowled >= 12) {    // min 2 overs
    const overs = s.ballsBowled / 6
    const econ  = s.runsConceded / overs
    if      (econ < 5)   pts += 6
    else if (econ < 6)   pts += 4
    else if (econ < 7)   pts += 2
    else if (econ < 10)  pts += 0
    else if (econ < 11)  pts -= 2
    else if (econ < 12)  pts -= 4
    else                 pts -= 6
  }

  // ── Strike Rate (batsman / wicket_keeper / all_rounder only) ────────────
  const srRoles = ['batsman', 'wicket_keeper', 'all_rounder']
  if (srRoles.includes(s.role) && s.ballsFaced > 0 && (s.ballsFaced >= 10 || s.runs >= 20)) {
    const sr = (s.runs / s.ballsFaced) * 100
    if      (sr <  50)  pts -= 6
    else if (sr <  60)  pts -= 4
    else if (sr <  70)  pts -= 2
    else if (sr < 130)  pts += 0
    else if (sr < 150)  pts += 2
    else if (sr < 170)  pts += 4
    else                pts += 6
  }

  // ── Fielding ────────────────────────────────────────────
  pts += s.catches * 8
  if (s.catches >= 3) pts += 4    // 3-catch bonus
  pts += s.stumpings * 12
  pts += s.runOutsDirect * 12     // only player involved
  pts += s.runOutsIndirect * 6    // multiple players involved

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
