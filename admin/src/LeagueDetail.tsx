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

interface Matchup {
  id: string
  league_id: string
  week_num: number
  home_user: string
  away_user: string
  home_points: number
  away_points: number
  winner_id: string | null
  is_final: boolean
  home_full_name: string | null
  home_username: string
  away_full_name: string | null
  away_username: string
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

function TeamColumn({ member, rosters, currency, memberCount, onSetLineup }: { member: Member; rosters: RosterEntry[]; currency: string; memberCount: number; onSetLineup: () => void }) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, flex: 1 }}>
            {fmt(member.remaining_budget, currency)} remaining
          </div>
          <button
            onClick={onSetLineup}
            style={{
              padding: '3px 10px', fontSize: 11, fontWeight: 700,
              background: '#eff6ff', color: '#2563eb',
              border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Set Lineup
          </button>
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
      <div style={{ flex: 1, overflowY: 'auto' }}>
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
              <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: '#111827' }}>{r.name}</span>
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
      width: 300, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Auction History</div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{history.length} player{history.length !== 1 ? 's' : ''}</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
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
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
  const [activeTab, setActiveTab] = useState<'auction' | 'schedule'>('auction')
  const [matchups, setMatchups] = useState<Matchup[]>([])
  const [matchupsLoading, setMatchupsLoading] = useState(false)
  // per-matchup edit state: { [matchupId]: { homeUserId, awayUserId, saving, saved } }
  const [matchupEdits, setMatchupEdits] = useState<Record<string, { homeUserId: string; awayUserId: string; saving: boolean; saved: boolean }>>({})
  const [regenerating, setRegenerating] = useState(false)

  // Lineup modal
  const [lineupModal, setLineupModal] = useState<{ userId: string; displayName: string } | null>(null)
  const [lineupWeek, setLineupWeek] = useState(1)
  const [availableWeeks, setAvailableWeeks] = useState<number[]>([])
  const [lineupDraft, setLineupDraft] = useState<Array<{ slotRole: string; playerId: string }>>([])
  const [lineupLoading, setLineupLoading] = useState(false)
  const [lineupSaving, setLineupSaving] = useState(false)
  const [lineupSaved, setLineupSaved] = useState(false)

  const SLOT_DEFS = [
    { slotRole: 'batsman',       count: 3 },
    { slotRole: 'wicket_keeper', count: 1 },
    { slotRole: 'all_rounder',   count: 1 },
    { slotRole: 'bowler',        count: 3 },
    { slotRole: 'flex',          count: 3 },
  ]
  const SLOTS = SLOT_DEFS.flatMap(({ slotRole, count }) =>
    Array.from({ length: count }, (_, i) => ({ slotRole, nth: i }))
  )

  const initDraft = (lineup: Array<{ player_id: string; slot_role: string }>) => {
    const byRole: Record<string, string[]> = {}
    for (const e of lineup) {
      if (!byRole[e.slot_role]) byRole[e.slot_role] = []
      byRole[e.slot_role].push(e.player_id)
    }
    const counters: Record<string, number> = {}
    return SLOTS.map(slot => {
      const idx = counters[slot.slotRole] ?? 0
      counters[slot.slotRole] = idx + 1
      return { slotRole: slot.slotRole, playerId: byRole[slot.slotRole]?.[idx] ?? '' }
    })
  }

  const loadLineupForWeek = async (userId: string, weekNum: number) => {
    setLineupLoading(true)
    try {
      const res = await api.get(`/admin/leagues/${leagueId}/lineups/${userId}?week=${weekNum}`, secret) as {
        lineup: Array<{ player_id: string; slot_role: string }>
      }
      setLineupDraft(initDraft(res.lineup))
    } catch {
      setLineupDraft(SLOTS.map(s => ({ slotRole: s.slotRole, playerId: '' })))
    } finally {
      setLineupLoading(false)
    }
  }

  const openLineupModal = async (member: Member) => {
    setLineupModal({ userId: member.user_id, displayName: member.display_name ?? member.username })
    setLineupSaved(false)
    setLineupDraft(SLOTS.map(s => ({ slotRole: s.slotRole, playerId: '' })))
    try {
      const settings = await api.get('/admin/settings', secret) as { weeks: Array<{ week_num: number }> }
      const weekNums = settings.weeks.map(w => w.week_num).sort((a, b) => a - b)
      setAvailableWeeks(weekNums)
      const first = weekNums[0] ?? 1
      setLineupWeek(first)
      await loadLineupForWeek(member.user_id, first)
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleLineupWeekChange = async (weekNum: number) => {
    setLineupWeek(weekNum)
    if (lineupModal) await loadLineupForWeek(lineupModal.userId, weekNum)
  }

  const handleSaveLineup = async () => {
    if (!lineupModal) return
    const filled = lineupDraft.filter(e => e.playerId)
    if (filled.length !== 11) { alert(`Select all 11 players (${filled.length}/11 filled)`); return }
    setLineupSaving(true)
    setLineupSaved(false)
    try {
      await api.put(`/admin/leagues/${leagueId}/lineups/${lineupModal.userId}`, secret, {
        weekNum: lineupWeek,
        entries: filled.map(e => ({ playerId: e.playerId, slotRole: e.slotRole })),
      })
      setLineupSaved(true)
      setTimeout(() => setLineupSaved(false), 2500)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLineupSaving(false)
    }
  }
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

  const loadMatchups = () => {
    setMatchupsLoading(true)
    api.get(`/admin/leagues/${leagueId}/matchups`, secret)
      .then((d: any) => {
        setMatchups(d.matchups)
        // Initialise edit state for each matchup
        const edits: typeof matchupEdits = {}
        for (const m of d.matchups as Matchup[]) {
          edits[m.id] = { homeUserId: m.home_user, awayUserId: m.away_user, saving: false, saved: false }
        }
        setMatchupEdits(edits)
      })
      .catch(e => alert(e.message))
      .finally(() => setMatchupsLoading(false))
  }

  useEffect(() => {
    if (activeTab === 'schedule') loadMatchups()
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveMatchup = async (matchupId: string) => {
    const edit = matchupEdits[matchupId]
    if (!edit) return
    setMatchupEdits(prev => ({ ...prev, [matchupId]: { ...prev[matchupId], saving: true, saved: false } }))
    try {
      const res: any = await api.patch(`/admin/matchups/${matchupId}`, secret, {
        homeUserId: edit.homeUserId,
        awayUserId: edit.awayUserId,
      })
      setMatchups(prev => prev.map(m => m.id === matchupId ? res.matchup : m))
      setMatchupEdits(prev => ({ ...prev, [matchupId]: { ...prev[matchupId], saving: false, saved: true } }))
      setTimeout(() => setMatchupEdits(prev => ({ ...prev, [matchupId]: { ...prev[matchupId], saved: false } })), 2000)
    } catch (e: any) {
      alert(e.message)
      setMatchupEdits(prev => ({ ...prev, [matchupId]: { ...prev[matchupId], saving: false } }))
    }
  }

  const handleRegenerate = async () => {
    if (!confirm('Regenerate schedule? This will overwrite all existing matchups for this league.')) return
    setRegenerating(true)
    try {
      const res: any = await api.post(`/admin/leagues/${leagueId}/matchups/regenerate`, secret, {})
      setMatchups(res.matchups)
      const edits: typeof matchupEdits = {}
      for (const m of res.matchups as Matchup[]) {
        edits[m.id] = { homeUserId: m.home_user, awayUserId: m.away_user, saving: false, saved: false }
      }
      setMatchupEdits(edits)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setRegenerating(false)
    }
  }

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
    <div style={{
      padding: '24px 28px', boxSizing: 'border-box',
      height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Back + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexShrink: 0 }}>
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

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexShrink: 0 }}>
        {(['auction', 'schedule'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 14, textTransform: 'capitalize',
              background: activeTab === tab ? '#dc2626' : '#f3f4f6',
              color: activeTab === tab ? 'white' : '#6b7280',
            }}
          >
            {tab === 'auction' ? 'Auction / Rosters' : 'Schedule'}
          </button>
        ))}
      </div>

      {/* ── Auction / Rosters tab ── */}
      {activeTab === 'auction' && (
        <>
          {live.live && <div style={{ flexShrink: 0 }}><LiveBanner live={live} currency={currency} /></div>}
          <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flex: 1, overflow: 'hidden', paddingBottom: 8 }}>
            {members.map(m => (
              <TeamColumn
                key={m.user_id}
                member={m}
                rosters={rostersByMember(m.user_id)}
                currency={currency}
                memberCount={members.length}
                onSetLineup={() => openLineupModal(m)}
              />
            ))}
            {members.length === 0 && (
              <div style={{ color: '#9ca3af', padding: 40 }}>No members in this league yet.</div>
            )}
            <HistoryColumn history={live.auctionHistory ?? []} currency={currency} />
          </div>
        </>
      )}

      {/* ── Schedule tab ── */}
      {activeTab === 'schedule' && (
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <span style={{ color: '#6b7280', fontSize: 13 }}>
              {matchups.length} matchup{matchups.length !== 1 ? 's' : ''} across {[...new Set(matchups.map(m => m.week_num))].length} week{[...new Set(matchups.map(m => m.week_num))].length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              style={{
                marginLeft: 'auto', padding: '8px 18px', borderRadius: 8, border: '1px solid #d1d5db',
                background: 'white', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#374151',
              }}
            >
              {regenerating ? 'Regenerating…' : '↺ Regenerate Schedule'}
            </button>
          </div>

          {matchupsLoading ? (
            <div style={{ color: '#9ca3af', padding: 40 }}>Loading schedule…</div>
          ) : matchups.length === 0 ? (
            <div style={{
              background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
              padding: 40, textAlign: 'center', color: '#9ca3af',
            }}>
              No matchups yet. Schedule is generated automatically when the league becomes active,
              or click "Regenerate Schedule" above.
            </div>
          ) : (
            // Group by week
            [...new Set(matchups.map(m => m.week_num))].sort((a, b) => a - b).map(weekNum => {
              const weekMatchups = matchups.filter(m => m.week_num === weekNum)
              return (
                <div key={weekNum} style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', marginBottom: 8 }}>
                    Week {weekNum}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {weekMatchups.map(matchup => {
                      const edit = matchupEdits[matchup.id]
                      if (!edit) return null
                      const memberSelect = (value: string, onChange: (v: string) => void) => (
                        <select
                          value={value}
                          onChange={e => onChange(e.target.value)}
                          style={{
                            padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db',
                            fontSize: 13, background: 'white', minWidth: 160,
                          }}
                        >
                          {members.map(m => (
                            <option key={m.user_id} value={m.user_id}>
                              {m.display_name ?? m.username}
                            </option>
                          ))}
                        </select>
                      )
                      return (
                        <div
                          key={matchup.id}
                          style={{
                            background: 'white', border: '1px solid #e5e7eb', borderRadius: 10,
                            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                          }}
                        >
                          {/* Home */}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>HOME</div>
                            {memberSelect(edit.homeUserId, v =>
                              setMatchupEdits(prev => ({ ...prev, [matchup.id]: { ...prev[matchup.id], homeUserId: v } }))
                            )}
                          </div>

                          {/* Score / VS */}
                          <div style={{ textAlign: 'center', flexShrink: 0 }}>
                            {matchup.is_final ? (
                              <div>
                                <span style={{ fontWeight: 800, fontSize: 18, color: '#111827' }}>
                                  {matchup.home_points}
                                </span>
                                <span style={{ color: '#d1d5db', margin: '0 6px' }}>–</span>
                                <span style={{ fontWeight: 800, fontSize: 18, color: '#111827' }}>
                                  {matchup.away_points}
                                </span>
                                <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, marginTop: 2 }}>FINAL</div>
                              </div>
                            ) : (
                              <span style={{ color: '#d1d5db', fontWeight: 700, fontSize: 15 }}>VS</span>
                            )}
                          </div>

                          {/* Away */}
                          <div style={{ flex: 1, textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>AWAY</div>
                            {memberSelect(edit.awayUserId, v =>
                              setMatchupEdits(prev => ({ ...prev, [matchup.id]: { ...prev[matchup.id], awayUserId: v } }))
                            )}
                          </div>

                          {/* Save */}
                          <button
                            onClick={() => handleSaveMatchup(matchup.id)}
                            disabled={edit.saving || (edit.homeUserId === matchup.home_user && edit.awayUserId === matchup.away_user)}
                            style={{
                              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                              fontWeight: 600, fontSize: 13, flexShrink: 0,
                              background: edit.saved ? '#16a34a' : edit.saving ? '#9ca3af'
                                : (edit.homeUserId !== matchup.home_user || edit.awayUserId !== matchup.away_user) ? '#dc2626' : '#f3f4f6',
                              color: (edit.saved || edit.saving || edit.homeUserId !== matchup.home_user || edit.awayUserId !== matchup.away_user) ? 'white' : '#9ca3af',
                            }}
                          >
                            {edit.saving ? 'Saving…' : edit.saved ? '✓' : 'Save'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── Lineup Modal ── */}
      {lineupModal && (() => {
        const userRoster = rostersByMember(lineupModal.userId)
        const inp: React.CSSProperties = {
          padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8,
          fontSize: 13, background: 'white', width: '100%', boxSizing: 'border-box',
        }
        return (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}>
            <div style={{
              background: 'white', borderRadius: 16, width: 520, maxHeight: '90vh',
              display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{ padding: '18px 22px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#111827' }}>Set Lineup</div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{lineupModal.displayName}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Week</label>
                  <select
                    value={lineupWeek}
                    onChange={e => handleLineupWeekChange(parseInt(e.target.value, 10))}
                    style={{ ...inp, width: 90 }}
                  >
                    {availableWeeks.map(w => <option key={w} value={w}>Week {w}</option>)}
                  </select>
                </div>
                <button
                  onClick={() => setLineupModal(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#9ca3af', padding: '0 4px' }}
                >✕</button>
              </div>

              {/* Slot rows */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
                {lineupLoading ? (
                  <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', fontSize: 13 }}>Loading…</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, fontSize: 11, color: '#9ca3af', borderBottom: '1px solid #f3f4f6' }}>#</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, fontSize: 11, color: '#9ca3af', borderBottom: '1px solid #f3f4f6' }}>SLOT</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, fontSize: 11, color: '#9ca3af', borderBottom: '1px solid #f3f4f6' }}>PLAYER</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SLOTS.map((slot, idx) => {
                        const color = ROLE_COLORS[slot.slotRole] ?? '#7c3aed'
                        const label = ROLE_LABELS[slot.slotRole] ?? slot.slotRole
                        const current = lineupDraft[idx]?.playerId ?? ''

                        // Eligible players: right role (or any for flex), not used in another slot
                        const usedElsewhere = new Set(
                          lineupDraft.filter((_, i) => i !== idx).map(e => e.playerId).filter(Boolean)
                        )
                        const eligible = userRoster.filter(r => {
                          if (usedElsewhere.has(r.player_id)) return false
                          if (slot.slotRole === 'flex') return true
                          return r.role === slot.slotRole
                        })

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f9fafb' }}>
                            <td style={{ padding: '8px', color: '#9ca3af', fontSize: 11, fontWeight: 600 }}>{idx + 1}</td>
                            <td style={{ padding: '8px' }}>
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                                background: `${color}20`, color,
                              }}>{label}</span>
                            </td>
                            <td style={{ padding: '8px', minWidth: 240 }}>
                              <select
                                value={current}
                                onChange={e => setLineupDraft(prev => {
                                  const next = [...prev]
                                  next[idx] = { slotRole: slot.slotRole, playerId: e.target.value }
                                  return next
                                })}
                                style={{ ...inp }}
                              >
                                <option value="">— select —</option>
                                {eligible.map(r => (
                                  <option key={r.player_id} value={r.player_id}>
                                    {r.name} ({r.ipl_team})
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '14px 22px', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>
                  {lineupDraft.filter(e => e.playerId).length} / 11 filled
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setLineupModal(null)}
                    style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#374151' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveLineup}
                    disabled={lineupSaving}
                    style={{
                      padding: '9px 22px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', color: 'white',
                      background: lineupSaved ? '#16a34a' : lineupSaving ? '#9ca3af' : '#2563eb',
                    }}
                  >
                    {lineupSaving ? 'Saving…' : lineupSaved ? '✓ Saved' : 'Save Lineup'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
