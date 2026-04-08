import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

interface InterestsResponse {
  myInterests: string[]
  counts: Record<string, number>
}

export interface AvailablePlayer {
  player_id: string
  queue_position: number
  status: 'pending' | 'live' | 'sold' | 'unsold'
  sold_to: string | null
  sold_price: number | null
  name: string
  ipl_team: string
  role: 'batsman' | 'bowler' | 'all_rounder' | 'wicket_keeper'
  base_price: number
  nationality: string
  image_url: string | null
  interest_count: number
  total_points: number
  team_games_played: number
}

export function usePlayerInterests(leagueId: string) {
  return useQuery({
    queryKey: ['interests', leagueId],
    queryFn: () => api.get<InterestsResponse>(`/auction/${leagueId}/interests`),
    enabled: !!leagueId,
  })
}

export function useToggleInterest(leagueId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (playerId: string) =>
      api.post<{ interested: boolean }>(`/auction/${leagueId}/interests/${playerId}`, {}),

    onMutate: async (playerId: string) => {
      // Cancel any in-flight refetch so it doesn't overwrite the optimistic update
      await queryClient.cancelQueries({ queryKey: ['interests', leagueId] })

      // Snapshot current data so we can roll back on error
      const previous = queryClient.getQueryData<InterestsResponse>(['interests', leagueId])

      // Optimistically toggle the interest immediately
      queryClient.setQueryData<InterestsResponse>(['interests', leagueId], (old) => {
        if (!old) return old
        const already = old.myInterests.includes(playerId)
        return {
          ...old,
          myInterests: already
            ? old.myInterests.filter((id) => id !== playerId)
            : [...old.myInterests, playerId],
          counts: {
            ...old.counts,
            [playerId]: (old.counts[playerId] ?? 0) + (already ? -1 : 1),
          },
        }
      })

      return { previous }
    },

    onError: (_err, _playerId, context) => {
      // Roll back if the API call fails
      if (context?.previous) {
        queryClient.setQueryData(['interests', leagueId], context.previous)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['interests', leagueId] })
    },
  })
}

export function useAvailablePlayers(leagueId: string) {
  return useQuery({
    queryKey: ['available-players', leagueId],
    queryFn: () => api.get<{ players: AvailablePlayer[] }>(`/auction/${leagueId}/available`),
    enabled: !!leagueId,
  })
}
