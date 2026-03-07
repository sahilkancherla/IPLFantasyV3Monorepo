import { useEffect, useRef, useCallback } from 'react'
import { WsManager } from '../lib/websocket'
import { useAuctionStore } from '../stores/auctionStore'

export function useAuction(leagueId: string) {
  const wsRef = useRef<WsManager | null>(null)
  const store = useAuctionStore()

  const handleMessage = useCallback((msg: unknown) => {
    if (!msg || typeof msg !== 'object') return
    const m = msg as Record<string, unknown>

    switch (m.type) {
      case 'SESSION_STATE':
        store.handleSessionState(m)
        break
      case 'BID_ACCEPTED':
        store.handleBidAccepted(m)
        break
      case 'PLAYER_SOLD':
        store.handlePlayerSold(m)
        break
      case 'PLAYER_UNSOLD':
        store.handlePlayerUnsold(m)
        break
      case 'PLAYER_NOMINATED':
        store.handlePlayerNominated(m)
        break
      case 'SESSION_STATUS':
        store.handleSessionStatus(m)
        break
      case 'TIMER_EXPIRED':
        store.handleTimerExpired(m)
        break
      case 'PONG':
        break  // heartbeat ack
      default:
        console.warn('Unknown WS message type:', m.type)
    }
  }, [store])

  useEffect(() => {
    const manager = new WsManager({
      leagueId,
      onMessage: handleMessage,
      onStatusChange: store.setWsStatus,
    })

    wsRef.current = manager
    manager.connect().catch(console.error)

    return () => {
      manager.disconnect()
      store.reset()
      wsRef.current = null
    }
  }, [leagueId]) // eslint-disable-line react-hooks/exhaustive-deps

  const placeBid = useCallback((amount: number) => {
    wsRef.current?.bid(leagueId, amount)
  }, [leagueId])

  const nominatePlayer = useCallback((playerId: string) => {
    wsRef.current?.nominate(leagueId, playerId)
  }, [leagueId])

  const passPlayer = useCallback(() => {
    wsRef.current?.pass(leagueId)
  }, [leagueId])

  const confirmPlayer = useCallback(() => {
    wsRef.current?.confirm(leagueId)
  }, [leagueId])

  const resetPlayer = useCallback(() => {
    wsRef.current?.reset(leagueId)
  }, [leagueId])

  return {
    ...store,
    placeBid,
    nominatePlayer,
    passPlayer,
    confirmPlayer,
    resetPlayer,
  }
}
