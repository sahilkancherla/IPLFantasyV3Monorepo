import { useEffect, useState, useRef } from 'react'
import { api } from './api'

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000'
// VITE_WS_URL can point to a different host (e.g. Railway) for the auction WebSocket
const WS_URL = ((import.meta.env.VITE_WS_URL as string | undefined) ?? BASE_URL).replace(/^http/, 'ws')

// ── Types ─────────────────────────────────────────────────────────────────

interface League {
  id: string; name: string; status: string; currency: string
  starting_budget: number; created_at: string
}

interface Member {
  user_id: string; username: string; display_name: string | null
  remaining_budget: number; roster_count: number
}

interface RosterEntry {
  user_id: string; player_id: string; name: string
  role: string; ipl_team: string; nationality: string; price_paid: number
}

interface HistoryEntry {
  type: 'sold' | 'unsold'
  name: string
  ipl_team: string
  role: string
  winner_display_name: string | null
  winner_username: string | null
  sold_price: number | null
}

interface LiveState {
  live: boolean
  status?: string
  currentPlayer?: { id: string; name: string; ipl_team: string; role: string; nationality: string } | null
  currentBid?: number | null
  currentBidderId?: string | null
  timerExpiresAt?: string | null
  awaitingConfirmation?: boolean
  queueRemaining?: number
  members?: { userId: string; username: string; displayName: string | null; remainingBudget: number; rosterCount: number }[]
  auctionHistory?: HistoryEntry[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  batsman: 'BAT', wicket_keeper: 'WK', all_rounder: 'AR', bowler: 'BOWL',
}
const ROLE_COLORS: Record<string, string> = {
  batsman: '#2563eb', wicket_keeper: '#d97706', all_rounder: '#16a34a', bowler: '#dc2626',
}

function fmt(amount: number, currency: string) {
  return currency === 'usd' ? `$${amount}` : `₹${amount}L`
}

function useCountdown(expiresAt: string | null | undefined): number {
  const [secsLeft, setSecsLeft] = useState(0)
  useEffect(() => {
    if (!expiresAt) { setSecsLeft(0); return }
    const tick = () => setSecsLeft(Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [expiresAt])
  return secsLeft
}

// ── Live Auction Banner ────────────────────────────────────────────────────

function LiveBanner({ live, currency }: { live: LiveState; currency: string }) {
  const secsLeft = useCountdown(live.timerExpiresAt)
  const bidderName = live.members?.find(m => m.userId === live.currentBidderId)?.displayName
    ?? live.members?.find(m => m.userId === live.currentBidderId)?.username
    ?? '—'

  const timerColor = secsLeft <= 5 ? '#dc2626' : secsLeft <= 10 ? '#d97706' : '#16a34a'

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e1b4b 0%, #7c3aed 100%)',
      borderRadius: 16, padding: '24px 28px', marginBottom: 28, color: 'white',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{
          width: 10, height: 10, borderRadius: '50%', background: '#22c55e',
          boxShadow: '0 0 0 3px rgba(34,197,94,0.3)',
        }} />
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.5 }}>AUCTION LIVE</span>
        {live.status === 'paused' && (
          <span style={{ background: '#fbbf24', color: '#78350f', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
            PAUSED
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 13, opacity: 0.7 }}>
          {live.queueRemaining} player{live.queueRemaining !== 1 ? 's' : ''} remaining
        </span>
      </div>

      {live.currentPlayer ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32, flexWrap: 'wrap' }}>
          {/* Current player */}
          <div>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, letterSpacing: 0.5 }}>NOW UP</div>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>{live.currentPlayer.name}</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>{live.currentPlayer.ipl_team}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                background: ROLE_COLORS[live.currentPlayer.role] ?? '#6b7280', color: 'white',
              }}>
                {ROLE_LABELS[live.currentPlayer.role] ?? live.currentPlayer.role}
              </span>
              {live.currentPlayer.nationality !== 'Indian' && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#fbbf24', color: '#78350f' }}>OS</span>
              )}
            </div>
          </div>

          {/* Current bid */}
          <div>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, letterSpacing: 0.5 }}>CURRENT BID</div>
            <div style={{ fontSize: 32, fontWeight: 800 }}>
              {live.currentBid != null ? fmt(live.currentBid, currency) : '—'}
            </div>
            {live.currentBidderId && (
              <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>by {bidderName}</div>
            )}
          </div>

          {/* Timer */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, letterSpacing: 0.5 }}>TIME LEFT</div>
            {live.awaitingConfirmation ? (
              <div style={{ fontSize: 20, fontWeight: 700, color: '#fbbf24' }}>Awaiting confirm…</div>
            ) : (
              <div style={{ fontSize: 48, fontWeight: 900, color: timerColor, lineHeight: 1, minWidth: 80 }}>
                {secsLeft}
              </div>
            )}
          </div>

          {/* Budgets mini-list */}
          <div style={{ marginLeft: 'auto' }}>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 8, letterSpacing: 0.5 }}>BUDGETS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(live.members ?? []).map(m => (
                <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 12, opacity: m.userId === live.currentBidderId ? 1 : 0.7,
                    fontWeight: m.userId === live.currentBidderId ? 700 : 400,
                  }}>
                    {m.displayName ?? m.username}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{fmt(m.remainingBudget, currency)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ opacity: 0.7, fontSize: 15 }}>
          {live.status === 'paused' ? 'Auction is paused.' : 'Waiting for admin to nominate next player…'}
        </div>
      )}
    </div>
  )
}

// ── Team Column ────────────────────────────────────────────────────────────

function TeamColumn({ member, rosters, currency, memberCount }: { member: Member; rosters: RosterEntry[]; currency: string; memberCount: number }) {
  const roleCounts = { batsman: 0, wicket_keeper: 0, all_rounder: 0, bowler: 0 }
  rosters.forEach(r => { if (r.role in roleCounts) roleCounts[r.role as keyof typeof roleCounts]++ })

  return (
    <div style={{
      background: 'white', borderRadius: 14, border: '1px solid #e5e7eb',
      flex: `1 1 0`, minWidth: 0,
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 2 }}>
          {member.display_name ?? member.username}
        </div>
        <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
          {fmt(member.remaining_budget, currency)} remaining
        </div>
        {/* Role counts */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {Object.entries(roleCounts).map(([role, count]) => (
            <span key={role} style={{
              fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
              background: `${ROLE_COLORS[role]}20`, color: ROLE_COLORS[role],
            }}>
              {ROLE_LABELS[role]} {count}
            </span>
          ))}
          <span style={{ fontSize: 11, color: '#9ca3af', alignSelf: 'center' }}>
            ({rosters.length} total)
          </span>
        </div>
      </div>

      {/* Player list */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 480 }}>
        {rosters.length === 0 ? (
          <div style={{ padding: 20, color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>No players yet</div>
        ) : (
          rosters.map((r, i) => (
            <div key={r.player_id} style={{
              padding: '9px 14px',
              borderTop: i > 0 ? '1px solid #f9fafb' : 'none',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99,
                background: `${ROLE_COLORS[r.role] ?? '#6b7280'}20`,
                color: ROLE_COLORS[r.role] ?? '#6b7280',
                flexShrink: 0,
              }}>
                {ROLE_LABELS[r.role] ?? r.role}
              </span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#111827' }}>{r.name}</span>
              <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, flexShrink: 0 }}>
                {fmt(r.price_paid, currency)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── History Column ─────────────────────────────────────────────────────────

function HistoryColumn({ history, currency }: { history: HistoryEntry[]; currency: string }) {
  return (
    <div style={{
      background: 'white', borderRadius: 14, border: '1px solid #e5e7eb',
      width: 240, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Auction History</div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{history.length} player{history.length !== 1 ? 's' : ''}</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 480 }}>
        {history.length === 0 ? (
          <div style={{ padding: 20, color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>No players sold yet</div>
        ) : (
          history.map((h, i) => (
            <div key={i} style={{
              padding: '9px 14px',
              borderTop: i > 0 ? '1px solid #f9fafb' : 'none',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 0', borderRadius: 99, flexShrink: 0,
                width: 40, display: 'inline-flex', justifyContent: 'center',
                background: `${ROLE_COLORS[h.role] ?? '#6b7280'}20`,
                color: ROLE_COLORS[h.role] ?? '#6b7280',
              }}>
                {ROLE_LABELS[h.role] ?? h.role}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.name}
                </div>
                {h.type === 'sold' ? (
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    {h.winner_display_name ?? h.winner_username}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>Unsold</div>
                )}
              </div>
              {h.type === 'sold' && h.sold_price != null ? (
                <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, flexShrink: 0 }}>
                  {fmt(h.sold_price, currency)}
                </span>
              ) : (
                <span style={{ fontSize: 11, color: '#d1d5db', fontWeight: 600, flexShrink: 0 }}>—</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

interface Props {
  leagueId: string
  leagueName: string
  secret: string
  onBack: () => void
}

const refreshRosters = (leagueId: string, secret: string, setMembers: (m: Member[]) => void, setRosters: (r: RosterEntry[]) => void) => {
  api.get(`/admin/leagues/${leagueId}`, secret)
    .then((d: any) => { setMembers(d.members); setRosters(d.rosters) })
    .catch(() => {})
}

export function LeagueDetail({ leagueId, leagueName, secret, onBack }: Props) {
  const [league, setLeague] = useState<League | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [rosters, setRosters] = useState<RosterEntry[]>([])
  const [live, setLive] = useState<LiveState>({ live: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [wsError, setWsError] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load static league data once
  useEffect(() => {
    api.get(`/admin/leagues/${leagueId}`, secret)
      .then((d: any) => {
        setLeague(d.league)
        setMembers(d.members)
        setRosters(d.rosters)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [leagueId, secret])

  // WebSocket connection for live auction updates
  useEffect(() => {
    let destroyed = false

    function connect() {
      if (destroyed) return
      const ws = new WebSocket(`${WS_URL}/ws/auction`)
      wsRef.current = ws

      ws.onopen = () => {
        setWsStatus('connected')
        setWsError('')
        ws.send(JSON.stringify({ type: 'JOIN', leagueId, adminSecret: secret }))
      }

      ws.onmessage = (event) => {
        let msg: any
        try { msg = JSON.parse(event.data) } catch { return }

        if (msg.type === 'ERROR') {
          setWsStatus('error')
          setWsError(msg.message ?? 'Unknown WS error')
          return
        }

        if (msg.type === 'SESSION_STATE') {
          setLive({
            live: msg.status !== 'completed',
            status: msg.status,
            currentPlayer: msg.player,
            currentBid: msg.currentBid,
            currentBidderId: msg.currentBidder?.userId ?? null,
            timerExpiresAt: msg.timerExpiresAt,
            awaitingConfirmation: msg.awaitingConfirmation,
            queueRemaining: msg.queueRemaining,
            members: msg.members,
            auctionHistory: msg.auctionHistory ?? [],
          })
        } else if (msg.type === 'BID_ACCEPTED') {
          setLive(prev => ({
            ...prev,
            currentBid: msg.amount,
            currentBidderId: msg.bidder.userId,
            timerExpiresAt: msg.timerExpiresAt,
            members: prev.members?.map(m =>
              m.userId === msg.bidder.userId ? { ...m, remainingBudget: msg.bidder.remainingBudget } : m
            ),
          }))
        } else if (msg.type === 'PLAYER_NOMINATED') {
          setLive(prev => ({
            ...prev,
            live: true,
            currentPlayer: msg.player,
            currentBid: null,
            currentBidderId: null,
            timerExpiresAt: msg.timerExpiresAt,
            awaitingConfirmation: false,
          }))
        } else if (msg.type === 'TIMER_EXPIRED') {
          setLive(prev => ({
            ...prev,
            timerExpiresAt: null,
            awaitingConfirmation: true,
            currentBid: msg.currentBid,
            currentBidderId: msg.currentBidder?.userId ?? null,
          }))
        } else if (msg.type === 'PLAYER_SOLD') {
          setLive(prev => ({
            ...prev,
            currentPlayer: null,
            currentBid: null,
            currentBidderId: null,
            timerExpiresAt: null,
            awaitingConfirmation: false,
            members: msg.members,
            auctionHistory: [
              { type: 'sold', name: msg.player.name, ipl_team: msg.player.ipl_team,
                role: msg.player.role, winner_display_name: msg.winner.displayName,
                winner_username: msg.winner.username, sold_price: msg.price },
              ...(prev.auctionHistory ?? []),
            ],
          }))
          refreshRosters(leagueId, secret, setMembers, setRosters)
        } else if (msg.type === 'PLAYER_UNSOLD') {
          setLive(prev => ({
            ...prev,
            currentPlayer: null,
            currentBid: null,
            currentBidderId: null,
            timerExpiresAt: null,
            awaitingConfirmation: false,
            auctionHistory: [
              { type: 'unsold', name: msg.player.name, ipl_team: msg.player.ipl_team,
                role: msg.player.role, winner_display_name: null,
                winner_username: null, sold_price: null },
              ...(prev.auctionHistory ?? []),
            ],
          }))
        } else if (msg.type === 'SESSION_STATUS') {
          setLive(prev => ({
            ...prev,
            live: msg.status !== 'completed',
            status: msg.status,
          }))
        }
      }

      ws.onclose = () => {
        if (!destroyed) {
          setWsStatus('connecting')
          reconnectRef.current = setTimeout(connect, 3000)
        }
      }

      ws.onerror = () => { setWsStatus('error'); ws.close() }
    }

    connect()

    return () => {
      destroyed = true
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [leagueId, secret])

  if (loading) return <div style={{ padding: 40, color: '#6b7280' }}>Loading…</div>
  if (error) return <div style={{ padding: 40, color: '#ef4444' }}>Error: {error}</div>
  if (!league) return null

  const currency = league.currency
  const rostersByMember = (userId: string) => rosters.filter(r => r.user_id === userId)

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Back + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={onBack}
          style={{
            background: '#f3f4f6', border: 'none', borderRadius: 8,
            padding: '7px 14px', cursor: 'pointer', fontWeight: 600,
            fontSize: 14, color: '#374151', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          ← Back
        </button>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111827' }}>{leagueName}</h2>
        <span style={{ fontSize: 13, color: '#6b7280' }}>
          {members.length} teams · {currency === 'usd' ? `$${league.starting_budget}` : `₹${league.starting_budget}L`} budget
        </span>
        {/* WS status badge */}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: wsStatus === 'connected' ? '#16a34a' : wsStatus === 'error' ? '#dc2626' : '#d97706',
          }} />
          <span style={{ color: '#6b7280' }}>
            {wsStatus === 'connected' ? `WS: ${WS_URL}` : wsStatus === 'error' ? `WS error: ${wsError || 'check console'}` : 'WS connecting…'}
          </span>
        </span>
      </div>

      {/* Live auction banner */}
      {live.live && <LiveBanner live={live} currency={currency} />}

      {/* Teams grid + history */}
      <div style={{
        display: 'flex', gap: 16, alignItems: 'flex-start',
        paddingBottom: 16,
      }}>
        {members.map(m => (
          <TeamColumn
            key={m.user_id}
            member={m}
            rosters={rostersByMember(m.user_id)}
            currency={currency}
            memberCount={members.length}
          />
        ))}
        {members.length === 0 && (
          <div style={{ color: '#9ca3af', padding: 40 }}>No members in this league yet.</div>
        )}
        <HistoryColumn history={live.auctionHistory ?? []} currency={currency} />
      </div>
    </div>
  )
}
