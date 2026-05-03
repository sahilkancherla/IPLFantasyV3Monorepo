import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface WaiverClaim {
  id: string
  league_id: string
  claimant_id: string
  claim_player_id: string
  drop_player_id: string
  status: 'pending' | 'granted' | 'denied' | 'cancelled'
  priority_at_submission: number
  created_at: string
  resolved_at: string | null
  // joined
  claim_player_name: string
  claim_player_role: string
  drop_player_name: string
  claimant_username: string
}

export interface FreeAgent {
  id: string
  name: string
  role: string
  ipl_team: string
  base_price: number
  image_url?: string | null
}

export function useFreeAgents(leagueId: string) {
  return useQuery({
    queryKey: ['freeAgents', leagueId],
    queryFn: () => api.get<{ players: FreeAgent[] }>(`/waivers/${leagueId}/free-agents`),
    enabled: !!leagueId,
    select: (data) => data.players,
  })
}

export function usePendingClaims(leagueId: string) {
  return useQuery({
    queryKey: ['waiverClaims', leagueId],
    queryFn: () => api.get<{ claims: WaiverClaim[] }>(`/waivers/${leagueId}/claims`),
    enabled: !!leagueId,
    select: (data) => data.claims,
  })
}

export function useMyClaims(leagueId: string) {
  return useQuery({
    queryKey: ['myClaims', leagueId],
    queryFn: () => api.get<{ claims: WaiverClaim[] }>(`/waivers/${leagueId}/my-claims`),
    enabled: !!leagueId,
    select: (data) => data.claims,
  })
}

export function useSubmitClaim(leagueId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { claimPlayerId: string; dropPlayerId: string }) =>
      api.post<{ claim: WaiverClaim }>(`/waivers/${leagueId}/claims`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiverClaims', leagueId] })
      queryClient.invalidateQueries({ queryKey: ['myClaims', leagueId] })
    },
  })
}

export function useCancelClaim(leagueId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (claimId: string) => api.delete(`/waivers/${leagueId}/claims/${claimId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myClaims', leagueId] })
    },
  })
}
