import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { RosterEntry } from './useTeam'
import type { Matchup, MatchPlayer } from './useMatchup'

export interface IplMatchDetail {
  id: string
  match_id: string
  home_team: string
  away_team: string
  match_date: string
  start_time_utc: string | null
  venue: string | null
  week_num: number | null
  is_completed: boolean
  status?: string
  match_number?: number | null
}

export interface LeagueHomeData {
  currentMatch: IplMatchDetail | null
  matchup: Matchup | null
  roster: RosterEntry[]
  currentWeekNum: number | null
  myPlayers: MatchPlayer[]
  oppPlayers: MatchPlayer[]
  myWeekPoints: number
  oppWeekPoints: number
}

export function useLeagueHome(leagueId: string) {
  return useQuery({
    queryKey: ['league-home', leagueId],
    queryFn: () => api.get<LeagueHomeData>(`/schedule/${leagueId}/home`),
    enabled: !!leagueId,
    staleTime: 0,
    refetchInterval: 30_000,
  })
}

export interface HomeSummaryMatchup {
  leagueId: string
  leagueName: string
  matchup: Matchup | null
}

export interface HomeSummaryData {
  currentMatch: IplMatchDetail | null
  currentWeekNum: number | null
  matchups: HomeSummaryMatchup[]
}

export function useHomeSummary() {
  return useQuery({
    queryKey: ['home-summary'],
    queryFn: () => api.get<HomeSummaryData>('/schedule/home-summary'),
    staleTime: 60_000,
  })
}
