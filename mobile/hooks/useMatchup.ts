import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface IplWeek {
  week_num: number
  label: string
  start_date: string
  end_date: string
  lock_time: string
  is_playoff: boolean
  week_type?: string
  status?: string
  window_start?: string | null
  window_end?: string | null
}

export interface Matchup {
  id: string
  league_id: string
  week_num: number
  home_user: string
  away_user: string
  home_points: number
  away_points: number
  winner_id: string | null
  is_final: boolean
  // joined
  home_username: string
  home_full_name: string
  away_username: string
  away_full_name: string
}

export function useCurrentWeek() {
  return useQuery({
    queryKey: ['currentWeek'],
    queryFn: () => api.get<{ week: IplWeek | null }>('/schedule/weeks/current'),
    select: (data) => data.week,
    staleTime: 60_000,
  })
}

export function useAllWeeks() {
  return useQuery({
    queryKey: ['allWeeks'],
    queryFn: () => api.get<{ weeks: IplWeek[] }>('/schedule/weeks'),
    select: (data) => data.weeks,
    staleTime: 5 * 60_000,
  })
}

export function useLeagueSchedule(leagueId: string) {
  return useQuery({
    queryKey: ['schedule', leagueId],
    queryFn: () => api.get<{ matchups: Matchup[] }>(`/schedule/${leagueId}`),
    enabled: !!leagueId,
    select: (data) => data.matchups,
  })
}

export interface IplMatch {
  id: string
  match_id: string
  match_number: number | null
  home_team: string
  away_team: string
  match_date: string
  start_time_utc: string | null
  venue: string | null
  status: string
}

export function useWeekMatches(weekNum: number | null) {
  return useQuery({
    queryKey: ['weekMatches', weekNum],
    queryFn: () => api.get<{ matches: IplMatch[] }>(`/schedule/weeks/${weekNum}/matches`),
    enabled: weekNum !== null,
    select: (data) => data.matches,
    staleTime: 60_000,
  })
}

export interface CurrentMatchInfo {
  id: string
  match_id: string
  home_team: string
  away_team: string
  status: string
  match_number: number | null
  start_time_utc: string | null
  venue: string | null
}

export interface MatchPlayer {
  playerId: string
  playerName: string
  playerRole: string
  playerTeam: string
  slotRole: string
  points: number
  runsScored: number
  ballsFaced: number
  fours: number
  sixes: number
  isOut: boolean
  ballsBowled: number
  runsConceded: number
  wicketsTaken: number
  maidens: number
  catches: number
  stumpings: number
  runOutsDirect: number
  runOutsIndirect: number
}

export interface HomeSummaryEntry {
  leagueId: string
  leagueName: string
  matchup: Matchup | null
  myPlayers: MatchPlayer[]
  oppPlayers: MatchPlayer[]
}

export interface HomeSummaryData {
  currentMatch: CurrentMatchInfo | null
  currentWeekNum: number | null
  matchups: HomeSummaryEntry[]
}

export function useHomeSummary() {
  return useQuery({
    queryKey: ['home-summary'],
    queryFn: () => api.get<HomeSummaryData>('/schedule/home-summary'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useMatchup(leagueId: string, weekNum?: number) {
  const path = weekNum
    ? `/schedule/${leagueId}/week/${weekNum}`
    : null

  return useQuery({
    queryKey: ['matchup', leagueId, weekNum],
    queryFn: () => api.get<{ matchup: Matchup | null; locked: boolean }>(path!),
    enabled: !!leagueId && !!weekNum,
  })
}
