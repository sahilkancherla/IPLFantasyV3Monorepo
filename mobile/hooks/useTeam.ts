import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface RosterEntry {
  id: string
  league_id: string
  user_id: string
  player_id: string
  price_paid: number
  acquired_at: string
  player_name: string
  player_ipl_team: string
  player_role: string
  player_image_url: string | null
}

export const useTeam = (leagueId: string) => useMyTeam(leagueId)

export function useMyTeam(leagueId: string) {
  return useQuery({
    queryKey: ['team', leagueId],
    queryFn: () => api.get<{ roster: RosterEntry[] }>(`/teams/${leagueId}`),
    select: (data) => data.roster,
    enabled: !!leagueId,
  })
}

export function useAllTeams(leagueId: string) {
  return useQuery({
    queryKey: ['teams-all', leagueId],
    queryFn: () => api.get<{ rosters: RosterEntry[] }>(`/teams/${leagueId}/all`),
    select: (data) => data.rosters,
    enabled: !!leagueId,
  })
}

export function useLeaderboard(leagueId: string) {
  return useQuery({
    queryKey: ['leaderboard', leagueId],
    queryFn: () =>
      api.get<{ leaderboard: Array<{
        user_id: string
        total_points: number
        last_updated: string
        username: string
        display_name: string | null
        avatar_url: string | null
      }> }>(`/leaderboard/${leagueId}`),
    select: (data) => data.leaderboard,
    enabled: !!leagueId,
    refetchInterval: 30000,  // refresh every 30s
  })
}
