export interface IplMatch {
  id: string
  match_id: string
  home_team: string
  away_team: string
  match_date: string
  week_num: number | null
  venue: string | null
  is_completed: boolean
  status: 'pending' | 'upcoming' | 'live' | 'completed'
  created_at: string
  start_time_utc: string | null
  scorecard_url: string | null
}

export interface Player {
  id: string
  name: string
  role: string
  ipl_team: string
}

export interface IplWeek {
  id: string
  week_num: number
  label: string
  start_date: string
  end_date: string
  lock_time: string | null
  window_start: string | null
  window_end: string | null
  week_type: 'regular' | 'playoff' | 'finals'
  is_playoff: boolean
  status: 'pending' | 'live' | 'completed'
}

export interface PlayerStats {
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
  dismissalText: string
  isInXI: boolean
}
