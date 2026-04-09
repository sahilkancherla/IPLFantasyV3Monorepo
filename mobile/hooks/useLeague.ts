import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { League } from '../stores/leagueStore'

interface LeagueMember {
  id: string
  league_id: string
  user_id: string
  remaining_budget: number
  roster_count: number
  waiver_priority: number
  joined_at: string
  team_name: string
  username: string
  full_name: string
  display_name: string | null
  avatar_url: string | null
}

export function useLeagues() {
  return useQuery({
    queryKey: ['leagues'],
    queryFn: () => api.get<{ leagues: League[] }>('/leagues'),
    select: (data) => data.leagues,
  })
}

export function useLeague(leagueId: string) {
  return useQuery({
    queryKey: ['league', leagueId],
    queryFn: () => api.get<{ league: League; members: LeagueMember[] }>(`/leagues/${leagueId}`),
    enabled: !!leagueId,
  })
}

export function useCreateLeague() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      name: string
      teamName: string
      startingBudget?: number
      maxTeams?: number
      rosterSize?: number
      maxBatsmen?: number
      maxWicketKeepers?: number
      maxAllRounders?: number
      maxBowlers?: number
      currency?: 'usd' | 'lakhs'
      bidTimeoutSecs?: number
      vetoHours?: number
    }) => api.post<{ league: League }>('/leagues', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] })
    },
  })
}

export function useJoinLeague() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ inviteCode, teamName }: { inviteCode: string; teamName: string }) =>
      api.post<{ league: League; member: LeagueMember }>('/leagues/join', { inviteCode, teamName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] })
    },
  })
}

export function useUpdateTeamName() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ leagueId, teamName }: { leagueId: string; teamName: string }) =>
      api.patch(`/leagues/${leagueId}/team-name`, { teamName }),
    onSuccess: (_data, { leagueId }) => {
      queryClient.invalidateQueries({ queryKey: ['league', leagueId] })
    },
  })
}

export function useLeaveLeague() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (leagueId: string) => api.delete(`/leagues/${leagueId}/leave`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] })
    },
  })
}

export function useAdvanceLeagueStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ leagueId, status }: { leagueId: string; status: string }) =>
      api.patch<{ league: League }>(`/leagues/${leagueId}/status`, { status }),
    onSuccess: (_data, { leagueId }) => {
      queryClient.invalidateQueries({ queryKey: ['league', leagueId] })
      queryClient.invalidateQueries({ queryKey: ['leagues'] })
    },
  })
}

export function useDeleteLeague() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (leagueId: string) => api.delete(`/leagues/${leagueId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] })
    },
  })
}

export function useDeleteAuction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (leagueId: string) => api.delete(`/leagues/${leagueId}/auction`),
    onSuccess: (_data, leagueId) => {
      queryClient.invalidateQueries({ queryKey: ['league', leagueId] })
      queryClient.invalidateQueries({ queryKey: ['leagues'] })
    },
  })
}

export function useGenerateSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (leagueId: string) =>
      api.post<{ matchups: unknown[] }>(`/schedule/${leagueId}/generate`, {}),
    onSuccess: (_data, leagueId) => {
      queryClient.invalidateQueries({ queryKey: ['schedule', leagueId] })
      queryClient.invalidateQueries({ queryKey: ['league-home', leagueId] })
    },
  })
}

export function useUpdateWeekMatchups() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ leagueId, weekNum, matchups }: {
      leagueId: string
      weekNum: number
      matchups: Array<{ id: string; home_user: string; away_user: string }>
    }) =>
      api.put<{ matchups: unknown[] }>(`/schedule/${leagueId}/week/${weekNum}/matchups`, { matchups }),
    onSuccess: (_data, { leagueId }) => {
      queryClient.invalidateQueries({ queryKey: ['schedule', leagueId] })
      queryClient.invalidateQueries({ queryKey: ['league-home', leagueId] })
    },
  })
}
