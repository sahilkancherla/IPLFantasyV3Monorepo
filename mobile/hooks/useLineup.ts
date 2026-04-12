import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface LineupEntry {
  id: string
  league_id: string
  user_id: string
  week_num: number
  player_id: string
  slot_role: 'batsman' | 'wicket_keeper' | 'all_rounder' | 'bowler' | 'flex'
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
    staleTime: 60_000,
    gcTime: 30 * 60_000,
  })
}

export function useSetLineup(leagueId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      weekNum: number
      entries: Array<{ playerId: string; slotRole: 'batsman' | 'wicket_keeper' | 'all_rounder' | 'bowler' | 'flex' }>
    }) => api.put<{ lineup: LineupEntry[] }>(`/lineups/${leagueId}`, data),
    onSuccess: (data, vars) => {
      // Immediately populate the cache so the UI updates before the background refetch
      queryClient.setQueryData(
        ['lineup', leagueId, vars.weekNum],
        { lineup: data.lineup, weekNum: vars.weekNum, locked: false }
      )
      queryClient.invalidateQueries({ queryKey: ['lineup', leagueId] })
      queryClient.invalidateQueries({ queryKey: ['game-breakdown', leagueId] })
    },
  })
}

export function useAdminSetLineup(leagueId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      userId: string
      weekNum: number
      entries: Array<{ playerId: string; slotRole: 'batsman' | 'wicket_keeper' | 'all_rounder' | 'bowler' | 'flex' }>
    }) => api.put<{ lineup: LineupEntry[] }>(`/lineups/${leagueId}/user/${data.userId}`, {
      weekNum: data.weekNum,
      entries: data.entries,
    }),
    onSuccess: (data, vars) => {
      queryClient.setQueryData(
        ['lineup', leagueId, vars.userId, vars.weekNum],
        { lineup: data.lineup, weekNum: vars.weekNum, locked: false }
      )
      queryClient.invalidateQueries({ queryKey: ['lineup', leagueId] })
    },
  })
}

export function useUserLineup(leagueId: string, userId: string, weekNum: number) {
  return useQuery({
    queryKey: ['lineup', leagueId, userId, weekNum],
    queryFn: () =>
      api.get<LineupResponse>(`/lineups/${leagueId}/user/${userId}?week=${weekNum}`),
    enabled: !!leagueId && !!userId && !!weekNum,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
  })
}

export interface GamePlayer {
  playerId: string
  playerName: string
  playerTeam: string
  playerRole: string
  slotRole: string
  points: number
  // batting
  runsScored: number
  ballsFaced: number
  fours: number
  sixes: number
  isOut: boolean
  // bowling
  ballsBowled: number
  runsConceded: number
  wicketsTaken: number
  maidens: number
  lbwBowledWickets: number
  // fielding
  catches: number
  stumpings: number
  runOutsDirect: number
  runOutsIndirect: number
  isInXI: boolean
}

export interface GameBreakdownData {
  matchId: string
  homeTeam: string
  awayTeam: string
  matchDate: string
  startTimeUtc: string | null
  isCompleted: boolean
  status: 'pending' | 'upcoming' | 'live' | 'completed'
  matchNumber: number | null
  myPoints: number
  oppPoints: number
  myPlayers: GamePlayer[]
  oppPlayers: GamePlayer[]
}

export function useGameBreakdown(leagueId: string, weekNum: number, opponentId: string | null, isCompleted?: boolean) {
  return useQuery({
    queryKey: ['game-breakdown', leagueId, weekNum, opponentId],
    queryFn: () =>
      api.get<{ games: GameBreakdownData[] }>(
        `/lineups/${leagueId}/game-breakdown?week=${weekNum}&opponentId=${opponentId}`
      ),
    enabled: !!leagueId && !!weekNum && !!opponentId,
    staleTime: isCompleted ? Infinity : 30_000,
    gcTime: 30 * 60_000,
    refetchInterval: isCompleted ? false : 60_000,
  })
}

export function useMatchupBreakdown(
  leagueId: string,
  weekNum: number,
  homeUserId: string | null,
  awayUserId: string | null,
  isCompleted?: boolean
) {
  return useQuery({
    queryKey: ['game-breakdown', leagueId, weekNum, homeUserId, awayUserId],
    queryFn: () =>
      api.get<{ games: GameBreakdownData[] }>(
        `/lineups/${leagueId}/game-breakdown?week=${weekNum}&userId=${homeUserId}&opponentId=${awayUserId}`
      ),
    enabled: !!leagueId && !!weekNum && !!homeUserId && !!awayUserId,
    staleTime: isCompleted ? Infinity : 30_000,
    gcTime: 30 * 60_000,
    refetchInterval: isCompleted ? false : 60_000,
  })
}

export interface PlayerMatchStat {
  matchId: string
  matchNumber: number | null
  homeTeam: string
  awayTeam: string
  matchDate: string
  startTimeUtc: string | null
  status: string
  playerIplTeam: string
  weekNum: number | null
  weekLabel: string | null
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
  isInXI: boolean
}

export function usePlayerStats(playerId: string | null) {
  return useQuery({
    queryKey: ['player-stats', playerId],
    queryFn: () => api.get<{ stats: PlayerMatchStat[] }>(`/players/${playerId}/stats`),
    enabled: !!playerId,
    select: (data) => data.stats,
    staleTime: 5 * 60_000,
  })
}

export interface PlayerUpcomingMatch {
  matchId: string
  matchNumber: number | null
  homeTeam: string
  awayTeam: string
  matchDate: string
  startTimeUtc: string | null
  status: 'pending' | 'upcoming'
  venue: string | null
  playerIplTeam: string
  weekNum: number | null
  weekLabel: string | null
}

export function usePlayerUpcoming(playerId: string | null) {
  return useQuery({
    queryKey: ['player-upcoming', playerId],
    queryFn: () => api.get<{ matches: PlayerUpcomingMatch[] }>(`/players/${playerId}/upcoming`),
    enabled: !!playerId,
    select: (data) => data.matches,
    staleTime: 5 * 60_000,
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
