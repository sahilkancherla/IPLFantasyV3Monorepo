import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface LineupEntry {
  id: string
  league_id: string
  user_id: string
  week_num: number
  player_id: string
  slot_role: 'batsman' | 'wicket_keeper' | 'all_rounder' | 'bowler'
  is_locked: boolean
  set_at: string
  // joined
  player_name: string
  player_role: string
  player_ipl_team: string
}

interface LineupResponse {
  lineup: LineupEntry[]
  weekNum: number
  locked: boolean
}

export function useLineup(leagueId: string, weekNum?: number) {
  const path = weekNum
    ? `/lineups/${leagueId}?week=${weekNum}`
    : `/lineups/${leagueId}`

  return useQuery({
    queryKey: ['lineup', leagueId, weekNum ?? 'current'],
    queryFn: () => api.get<LineupResponse>(path),
    enabled: !!leagueId,
  })
}

export function useSetLineup(leagueId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      weekNum: number
      entries: Array<{ playerId: string; slotRole: 'batsman' | 'wicket_keeper' | 'all_rounder' | 'bowler' }>
    }) => api.put<{ lineup: LineupEntry[] }>(`/lineups/${leagueId}`, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['lineup', leagueId] })
    },
  })
}

export function useAutoSetLineup(leagueId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api.post<{ lineup: LineupEntry[] }>(`/lineups/${leagueId}/auto`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lineup', leagueId] })
    },
  })
}
