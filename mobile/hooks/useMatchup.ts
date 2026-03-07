import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface IplWeek {
  id: string
  week_num: number
  label: string
  start_date: string
  end_date: string
  lock_time: string
  is_playoff: boolean
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
