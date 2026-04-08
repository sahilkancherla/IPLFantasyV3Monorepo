import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../lib/adminApi'

export interface AdminMatch {
  id: string
  match_id: string
  home_team: string
  away_team: string
  match_date: string
  start_time_utc: string | null
  week_num: number | null
  venue: string | null
  status: 'pending' | 'upcoming' | 'live' | 'completed'
  is_completed: boolean
  match_number: number | null
  scorecard_url: string | null
}

export interface AdminPlayer {
  id: string
  name: string
  role: string
  ipl_team: string
}

export interface AdminStatRow {
  player_id: string
  runs_scored: number
  balls_faced: number
  fours: number
  sixes: number
  is_out: boolean
  wickets_taken: number
  balls_bowled: number
  runs_conceded: number
  maidens: number
  lbw_bowled_wickets: number
  catches: number
  stumpings: number
  run_outs_direct: number
  run_outs_indirect: number
  dismissal_text: string | null
  is_in_xi: boolean
  fantasy_points: number
}

export interface AdminMatchDetail {
  match: AdminMatch
  homePlayers: AdminPlayer[]
  awayPlayers: AdminPlayer[]
  stats: Record<string, AdminStatRow>
}

export interface PlayerStatPayload {
  playerId: string
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

export function useAdminMatches() {
  return useQuery({
    queryKey: ['admin-matches'],
    queryFn: () => adminApi.get<{ matches: AdminMatch[] }>('/admin/matches'),
    select: (d) => d.matches,
    staleTime: 30_000,
  })
}

export function useAdminMatchDetail(matchId: string | null) {
  return useQuery({
    queryKey: ['admin-match', matchId],
    queryFn: () => adminApi.get<AdminMatchDetail>(`/admin/matches/${matchId}`),
    enabled: !!matchId,
    staleTime: 0,
  })
}

export function useAdminPatchMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ matchId, data }: { matchId: string; data: Record<string, unknown> }) =>
      adminApi.patch<{ match: AdminMatch }>(`/admin/matches/${matchId}`, data),
    onSuccess: (res, { matchId }) => {
      qc.invalidateQueries({ queryKey: ['admin-matches'] })
      qc.setQueryData<AdminMatchDetail>(['admin-match', matchId], (old) =>
        old ? { ...old, match: res.match } : old
      )
    },
  })
}

export function useAdminSaveStats() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ matchId, playerStats }: { matchId: string; playerStats: PlayerStatPayload[] }) =>
      adminApi.post<{ saved: number }>(`/admin/matches/${matchId}/stats`, { playerStats }),
    onSuccess: (_res, { matchId }) => {
      qc.invalidateQueries({ queryKey: ['admin-match', matchId] })
      qc.invalidateQueries({ queryKey: ['admin-matches'] })
    },
  })
}

export function useAdminImportScorecard() {
  return useMutation({
    mutationFn: ({ matchId, url }: { matchId: string; url: string }) =>
      adminApi.post<{ matched: PlayerStatPayload[]; unmatched: string[] }>(
        `/admin/matches/${matchId}/import-scorecard`,
        { url }
      ),
  })
}

export function useAdminClearStats() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (matchId: string) =>
      adminApi.delete(`/admin/matches/${matchId}/stats`),
    onSuccess: (_res, matchId) => {
      qc.invalidateQueries({ queryKey: ['admin-match', matchId] })
    },
  })
}
