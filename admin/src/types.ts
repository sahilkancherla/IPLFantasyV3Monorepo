export interface IplMatch {
  id: string
  match_id: string
  home_team: string
  away_team: string
  match_date: string
  week_num: number | null
  venue: string | null
  is_completed: boolean
  created_at: string
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
  catches: number
  stumpings: number
  runOutsDirect: number
  runOutsIndirect: number
}
