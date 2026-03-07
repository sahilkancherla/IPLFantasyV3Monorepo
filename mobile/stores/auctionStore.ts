import { create } from 'zustand'
import type { WsStatus } from '../lib/websocket'

interface HistoryItemFromServer {
  type: 'sold' | 'unsold'
  player_id: string
  name: string
  ipl_team: string
  role: string
  base_price: number
  nationality: string
  image_url: string | null
  winner_id: string | null
  winner_username: string | null
  winner_display_name: string | null
  winner_avatar_url: string | null
  sold_price: number | null
}

export interface Player {
  id: string
  name: string
  ipl_team: string
  role: 'batsman' | 'bowler' | 'all_rounder' | 'wicket_keeper'
  base_price: number
  nationality: string
  image_url: string | null
}

export interface MemberState {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  remainingBudget: number
  rosterCount: number
}

export interface BidHistoryEntry {
  bidder: MemberState
  amount: number
  timestamp: string
}

export interface AuctionHistoryEntry {
  type: 'sold' | 'unsold'
  player: Player
  winner?: MemberState
  price?: number
  timestamp: string
}

interface AuctionState {
  // Connection
  wsStatus: WsStatus

  // Session
  sessionId: string | null
  sessionStatus: 'live' | 'paused' | 'completed' | null

  // Current nomination
  currentPlayer: Player | null
  currentBid: number | null
  currentBidder: MemberState | null
  timerExpiresAt: string | null
  awaitingConfirmation: boolean

  // Increments each time a fresh PLAYER_NOMINATED message arrives (not on reconnect)
  nominationTick: number

  // Members
  members: MemberState[]
  queueRemaining: number

  // Bid history for current player (last 20)
  bidHistory: BidHistoryEntry[]

  // Auction history (all sold/unsold events this session)
  auctionHistory: AuctionHistoryEntry[]

  // Toast notifications
  lastSoldPlayer: { player: Player; winner: MemberState; price: number } | null
  lastUnsoldPlayer: Player | null

  // Actions
  setWsStatus: (status: WsStatus) => void
  handleSessionState: (msg: Record<string, unknown>) => void
  handleBidAccepted: (msg: Record<string, unknown>) => void
  handlePlayerSold: (msg: Record<string, unknown>) => void
  handlePlayerUnsold: (msg: Record<string, unknown>) => void
  handlePlayerNominated: (msg: Record<string, unknown>) => void
  handleSessionStatus: (msg: Record<string, unknown>) => void
  handleTimerExpired: (msg: Record<string, unknown>) => void
  clearToasts: () => void
  reset: () => void
}

export const useAuctionStore = create<AuctionState>((set, get) => ({
  wsStatus: 'disconnected',
  sessionId: null,
  sessionStatus: null,
  currentPlayer: null,
  currentBid: null,
  currentBidder: null,
  timerExpiresAt: null,
  awaitingConfirmation: false,
  nominationTick: 0,
  members: [],
  queueRemaining: 0,
  bidHistory: [],
  auctionHistory: [],
  lastSoldPlayer: null,
  lastUnsoldPlayer: null,

  setWsStatus: (wsStatus) => set({ wsStatus }),

  handleSessionState: (msg) => {
    const rawHistory = (msg.auctionHistory as HistoryItemFromServer[] | undefined) ?? []
    const auctionHistory: AuctionHistoryEntry[] = rawHistory.map((h) => ({
      type: h.type,
      player: {
        id: h.player_id,
        name: h.name,
        ipl_team: h.ipl_team,
        role: h.role as Player['role'],
        base_price: h.base_price,
        nationality: h.nationality,
        image_url: h.image_url,
      },
      winner: h.winner_id
        ? {
            userId: h.winner_id,
            username: h.winner_username ?? h.winner_id,
            displayName: h.winner_display_name,
            avatarUrl: h.winner_avatar_url,
            remainingBudget: 0,
            rosterCount: 0,
          }
        : undefined,
      price: h.sold_price ?? undefined,
      timestamp: '',
    }))

    set({
      sessionId: msg.sessionId as string,
      sessionStatus: msg.status as AuctionState['sessionStatus'],
      currentPlayer: (msg.player as Player) ?? null,
      currentBid: (msg.currentBid as number) ?? null,
      currentBidder: (msg.currentBidder as MemberState) ?? null,
      timerExpiresAt: (msg.timerExpiresAt as string) ?? null,
      awaitingConfirmation: (msg.awaitingConfirmation as boolean) ?? false,
      members: (msg.members as MemberState[]) ?? [],
      queueRemaining: (msg.queueRemaining as number) ?? 0,
      auctionHistory,
    })
  },

  handleBidAccepted: (msg) => {
    const bidder = msg.bidder as MemberState
    const amount = msg.amount as number
    const timerExpiresAt = msg.timerExpiresAt as string

    const entry: BidHistoryEntry = {
      bidder,
      amount,
      timestamp: new Date().toISOString(),
    }

    const history = [entry, ...get().bidHistory].slice(0, 20)

    set({
      currentBid: amount,
      currentBidder: bidder,
      timerExpiresAt,
      bidHistory: history,
    })
  },

  handlePlayerSold: (msg) => {
    const player = msg.player as Player
    const winner = msg.winner as MemberState
    const price = msg.price as number

    const historyEntry: AuctionHistoryEntry = {
      type: 'sold',
      player,
      winner,
      price,
      timestamp: new Date().toISOString(),
    }

    set({
      currentPlayer: null,
      currentBid: null,
      currentBidder: null,
      timerExpiresAt: null,
      awaitingConfirmation: false,
      members: (msg.members as MemberState[]) ?? [],
      bidHistory: [],
      auctionHistory: [historyEntry, ...get().auctionHistory],
      lastSoldPlayer: { player, winner, price },
    })
  },

  handlePlayerUnsold: (msg) => {
    const player = msg.player as Player

    const historyEntry: AuctionHistoryEntry = {
      type: 'unsold',
      player,
      timestamp: new Date().toISOString(),
    }

    set({
      currentPlayer: null,
      currentBid: null,
      currentBidder: null,
      timerExpiresAt: null,
      awaitingConfirmation: false,
      bidHistory: [],
      auctionHistory: [historyEntry, ...get().auctionHistory],
      lastUnsoldPlayer: player,
    })
  },

  handlePlayerNominated: (msg) => {
    set({
      currentPlayer: msg.player as Player,
      currentBid: null,
      currentBidder: null,
      timerExpiresAt: msg.timerExpiresAt as string,
      awaitingConfirmation: false,
      bidHistory: [],
      nominationTick: get().nominationTick + 1,
    })
  },

  handleSessionStatus: (msg) => {
    set({ sessionStatus: msg.status as AuctionState['sessionStatus'] })
  },

  handleTimerExpired: (msg) => {
    set({
      currentPlayer: (msg.player as Player) ?? null,
      currentBid: (msg.currentBid as number) ?? null,
      currentBidder: (msg.currentBidder as MemberState) ?? null,
      timerExpiresAt: null,
      awaitingConfirmation: true,
    })
  },

  clearToasts: () => set({ lastSoldPlayer: null, lastUnsoldPlayer: null }),

  reset: () => set({
    wsStatus: 'disconnected',
    sessionId: null,
    sessionStatus: null,
    currentPlayer: null,
    currentBid: null,
    currentBidder: null,
    timerExpiresAt: null,
    awaitingConfirmation: false,
    nominationTick: 0,
    members: [],
    queueRemaining: 0,
    bidHistory: [],
    auctionHistory: [],
    lastSoldPlayer: null,
    lastUnsoldPlayer: null,
  }),
}))
