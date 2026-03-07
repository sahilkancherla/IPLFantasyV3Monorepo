import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface TradeProposal {
  id: string
  league_id: string
  proposer_id: string
  receiver_id: string
  status: 'pending' | 'accepted' | 'rejected' | 'vetoed' | 'cancelled' | 'expired'
  veto_deadline: string | null
  note: string | null
  created_at: string
  resolved_at: string | null
  proposer_username: string
  proposer_full_name: string
  receiver_username: string
  receiver_full_name: string
}

export interface TradeItem {
  id: string
  trade_id: string
  player_id: string
  from_user: string
  to_user: string
  player_name: string
  player_role: string
  player_ipl_team: string
}

export function useMyTrades(leagueId: string) {
  return useQuery({
    queryKey: ['myTrades', leagueId],
    queryFn: () => api.get<{ trades: TradeProposal[] }>(`/trades/${leagueId}/mine`),
    enabled: !!leagueId,
    select: (data) => data.trades,
  })
}

export function useLeagueTrades(leagueId: string) {
  return useQuery({
    queryKey: ['leagueTrades', leagueId],
    queryFn: () => api.get<{ trades: TradeProposal[] }>(`/trades/${leagueId}`),
    enabled: !!leagueId,
    select: (data) => data.trades,
  })
}

export function useTradeDetail(leagueId: string, tradeId: string) {
  return useQuery({
    queryKey: ['trade', leagueId, tradeId],
    queryFn: () => api.get<{ trade: TradeProposal; items: TradeItem[] }>(`/trades/${leagueId}/${tradeId}`),
    enabled: !!leagueId && !!tradeId,
  })
}

export function useProposeTrade(leagueId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      receiverId: string
      note?: string
      items: Array<{ playerId: string; fromUser: string; toUser: string }>
    }) => api.post<{ trade: TradeProposal }>(`/trades/${leagueId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTrades', leagueId] })
      queryClient.invalidateQueries({ queryKey: ['leagueTrades', leagueId] })
    },
  })
}

export function useRespondToTrade(leagueId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ tradeId, action }: { tradeId: string; action: 'accept' | 'reject' }) => {
      if (action === 'accept') {
        return api.post(`/trades/${leagueId}/${tradeId}/accept`, {})
      }
      return api.post(`/trades/${leagueId}/${tradeId}/reject`, {})
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTrades', leagueId] })
      queryClient.invalidateQueries({ queryKey: ['leagueTrades', leagueId] })
    },
  })
}

export function useCancelTrade(leagueId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (tradeId: string) => api.delete(`/trades/${leagueId}/${tradeId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTrades', leagueId] })
    },
  })
}
