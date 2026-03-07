import type { Player } from '../db/queries/players.js'

// ============================================================
// Client → Server messages
// ============================================================
export interface JoinMessage {
  type: 'JOIN'
  leagueId: string
  token: string
}

export interface BidMessage {
  type: 'BID'
  leagueId: string
  amount: number
}

export interface NominateMessage {
  type: 'NOMINATE'
  leagueId: string
  playerId: string
}

export interface PassMessage {
  type: 'PASS'
  leagueId: string
}

export interface ConfirmMessage {
  type: 'CONFIRM'
  leagueId: string
}

export interface ResetMessage {
  type: 'RESET'
  leagueId: string
}

export interface PingMessage {
  type: 'PING'
}

export type ClientMessage =
  | JoinMessage
  | BidMessage
  | NominateMessage
  | PassMessage
  | ConfirmMessage
  | ResetMessage
  | PingMessage

// ============================================================
// Server → Client messages
// ============================================================
export interface MemberState {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  remainingBudget: number
  rosterCount: number
}

export interface AuctionHistoryItem {
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

export interface SessionStateMessage {
  type: 'SESSION_STATE'
  sessionId: string
  status: string
  player: Player | null
  currentBid: number | null
  currentBidder: MemberState | null
  timerExpiresAt: string | null
  awaitingConfirmation: boolean
  members: MemberState[]
  queueRemaining: number
  auctionHistory: AuctionHistoryItem[]
}

export interface TimerExpiredMessage {
  type: 'TIMER_EXPIRED'
  player: Player
  currentBid: number | null
  currentBidder: MemberState | null
}

export interface BidAcceptedMessage {
  type: 'BID_ACCEPTED'
  bidder: MemberState
  amount: number
  timerExpiresAt: string
}

export interface BidRejectedMessage {
  type: 'BID_REJECTED'
  reason: 'INSUFFICIENT_BUDGET' | 'TOO_LOW' | 'NOT_IN_SESSION' | 'SELF_BID' | 'NOT_AUTHENTICATED' | 'ROLE_LIMIT_REACHED'
}

export interface PlayerSoldMessage {
  type: 'PLAYER_SOLD'
  player: Player
  winner: MemberState
  price: number
  members: MemberState[]
}

export interface PlayerUnsoldMessage {
  type: 'PLAYER_UNSOLD'
  player: Player
}

export interface PlayerNominatedMessage {
  type: 'PLAYER_NOMINATED'
  player: Player
  basePrice: number
  timerExpiresAt: string
}

export interface SessionStatusMessage {
  type: 'SESSION_STATUS'
  status: 'live' | 'paused' | 'completed'
}

export interface ErrorMessage {
  type: 'ERROR'
  message: string
}

export interface PongMessage {
  type: 'PONG'
}

export type ServerMessage =
  | SessionStateMessage
  | BidAcceptedMessage
  | BidRejectedMessage
  | PlayerSoldMessage
  | PlayerUnsoldMessage
  | PlayerNominatedMessage
  | SessionStatusMessage
  | TimerExpiredMessage
  | ErrorMessage
  | PongMessage
