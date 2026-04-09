import { useState, useRef, useEffect, ReactNode } from 'react'
import { View, Text, TouchableOpacity, Modal, ScrollView, Pressable, Dimensions, Animated } from 'react-native'
import { calcBreakdown, type BreakdownStats } from '../ui/PointsBreakdown'
import { PointsValue } from '../ui/PointsBreakdown'
import { PlayerDetailModal } from './PlayerDetailModal'
import type { PlayerDetailInfo } from './PlayerDetailModal'
import type { LineupEntry, GamePlayer, GameBreakdownData } from '../../hooks/useLineup'
import type { IplMatch } from '../../hooks/useMatchup'

// ── Shared helpers ────────────────────────────────────────────────────────────

export const TEAM_ABBREV: Record<string, string> = {
  'Chennai Super Kings': 'CSK',
  'Mumbai Indians': 'MI',
  'Royal Challengers Bengaluru': 'RCB',
  'Royal Challengers Bangalore': 'RCB',
  'Kolkata Knight Riders': 'KKR',
  'Delhi Capitals': 'DC',
  'Rajasthan Royals': 'RR',
  'Punjab Kings': 'PBKS',
  'Sunrisers Hyderabad': 'SRH',
  'Lucknow Super Giants': 'LSG',
  'Gujarat Titans': 'GT',
}

export const ROLE_ORDER: Record<string, number> = {
  batsman: 0, wicket_keeper: 1, all_rounder: 2, bowler: 3, flex: 4,
}

const ROLE_COLORS: Record<string, string> = {
  batsman: '#2563eb', bowler: '#dc2626', all_rounder: '#16a34a',
  wicket_keeper: '#d97706', flex: '#6b7280',
}
const ROLE_GROUP_LABELS: Record<string, string> = {
  batsman: 'Batsmen', bowler: 'Bowlers', all_rounder: 'All-Rounders',
  wicket_keeper: 'Wicket Keepers', flex: 'Flex',
}
const roleLabels: Record<string, string> = {
  batsman: 'BAT', bowler: 'BOW', all_rounder: 'AR', wicket_keeper: 'WK',
}

export function sortBySlotRole<T extends { slot_role?: string; playerRole?: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) =>
    (ROLE_ORDER[a.slot_role ?? a.playerRole ?? ''] ?? 5) -
    (ROLE_ORDER[b.slot_role ?? b.playerRole ?? ''] ?? 5)
  )
}

export function groupByRole<T>(items: T[], getRoleFn: (item: T) => string): Array<{ role: string; items: T[] }> {
  const groups: Array<{ role: string; items: T[] }> = []
  let currentRole = ''
  for (const item of items) {
    const role = getRoleFn(item)
    if (role !== currentRole) {
      groups.push({ role, items: [item] })
      currentRole = role
    } else {
      groups[groups.length - 1].items.push(item)
    }
  }
  return groups
}

export function RoleSectionHeader({ role, count }: { role: string; count: number }) {
  const roleColor = ROLE_COLORS[role] ?? '#6b7280'
  const roleShort = roleLabels[role] ?? role.toUpperCase()
  const groupLabel = ROLE_GROUP_LABELS[role] ?? role
  return (
    <View style={{ backgroundColor: '#f9fafb', paddingHorizontal: 16, paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#f3f4f6', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ backgroundColor: roleColor + '20', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
        <Text style={{ color: roleColor, fontSize: 10, fontWeight: '700' }}>{roleShort}</Text>
      </View>
      <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600' }}>{groupLabel}</Text>
      <Text style={{ color: '#9ca3af', fontSize: 11, marginLeft: 'auto' }}>{count}</Text>
    </View>
  )
}

export function statLine(p: GamePlayer): string {
  const parts: string[] = []
  if (p.ballsFaced > 0 || p.runsScored > 0) {
    parts.push(`${p.runsScored}(${p.ballsFaced})`)
    if (p.fours > 0) parts.push(`${p.fours}×4`)
    if (p.sixes > 0) parts.push(`${p.sixes}×6`)
  }
  if (p.ballsBowled > 0) {
    const overs = `${Math.floor(p.ballsBowled / 6)}.${p.ballsBowled % 6}`
    parts.push(`${p.wicketsTaken}/${p.runsConceded} (${overs}ov)`)
    if (p.maidens > 0) parts.push(`${p.maidens}m`)
  }
  if (p.catches > 0) parts.push(`${p.catches}c`)
  if (p.stumpings > 0) parts.push(`${p.stumpings}st`)
  if (p.runOutsDirect > 0 || p.runOutsIndirect > 0)
    parts.push(`${p.runOutsDirect + p.runOutsIndirect}ro`)
  return parts.join('  ')
}

export function formatMatchTime(m: { start_time_utc: string | null; match_date: string }): string {
  if (m.start_time_utc) {
    return new Date(m.start_time_utc).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
      timeZoneName: 'short',
    })
  }
  return m.match_date
}

// ── LineupCard ────────────────────────────────────────────────────────────────

interface LineupCardProps {
  title: string
  titleSuffix?: string           // e.g. ' ★' for own
  headerColor?: string           // default '#1f2937'
  headerAction?: ReactNode
  lineup: LineupEntry[]
  emptyMessage: string
  weekMatches: IplMatch[]
  breakdownByMatchId: Map<string, GameBreakdownData>
  /** Resolve a player's stats for a given match */
  getPlayerStats: (matchId: string, playerId: string) => GamePlayer | undefined
}

export function LineupCard({
  title,
  titleSuffix = '',
  headerColor = '#1f2937',
  headerAction,
  lineup,
  emptyMessage,
  weekMatches,
  breakdownByMatchId,
  getPlayerStats,
}: LineupCardProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; info: PlayerDetailInfo } | null>(null)

  function gamesForTeam(iplTeam: string) {
    return weekMatches.filter(m => m.home_team === iplTeam || m.away_team === iplTeam)
  }
  function gamesRemainingForTeam(iplTeam: string) {
    return weekMatches.filter(m => (m.home_team === iplTeam || m.away_team === iplTeam) && m.status !== 'completed')
  }

  return (
    <>
      <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}>
        <View style={{ backgroundColor: headerColor, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 13, flex: 1 }} numberOfLines={1}>
            {title}{titleSuffix}
          </Text>
          {headerAction}
        </View>

        {lineup.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: '#d1d5db', fontSize: 13 }}>{emptyMessage}</Text>
          </View>
        ) : (
          groupByRole(lineup, e => e.slot_role).map(group => (
            <View key={group.role}>
              <RoleSectionHeader role={group.role} count={group.items.length} />
              {group.items.map(entry => {
                const isExpanded = expanded.has(entry.id)
                const games = gamesForTeam(entry.player_ipl_team)
                const gamesRemaining = gamesRemainingForTeam(entry.player_ipl_team)
                const weekPts = Array.from(breakdownByMatchId.values()).reduce((sum, bd) => {
                  const p = getPlayerStats(bd.matchId, entry.player_id)
                  return sum + (p?.points ?? 0)
                }, 0)

                return (
                  <View key={entry.id} style={{ borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8 }}>
                      <TouchableOpacity
                        onPress={() => setSelectedPlayer({ id: entry.player_id, info: { name: entry.player_name, ipl_team: entry.player_ipl_team, role: entry.player_role } })}
                        style={{ flex: 1, paddingVertical: 11, paddingLeft: 4 }}
                      >
                        <Text style={{ color: '#111827', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                          {entry.player_name}
                        </Text>
                        <Text style={{ color: '#9ca3af', fontSize: 11 }}>{entry.player_ipl_team}</Text>
                      </TouchableOpacity>
                      {weekPts > 0 && (
                        <Text style={{ color: '#16a34a', fontSize: 12, fontWeight: '700', marginRight: 6 }}>
                          +{weekPts.toFixed(1)}
                        </Text>
                      )}
                      {gamesRemaining.length > 0 && (
                        <View style={{ backgroundColor: '#fee2e2', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginRight: 6 }}>
                          <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '700' }}>
                            {gamesRemaining.length} {gamesRemaining.length === 1 ? 'game left' : 'games left'}
                          </Text>
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={() => setExpanded(prev => { const s = new Set(prev); isExpanded ? s.delete(entry.id) : s.add(entry.id); return s })}
                        style={{ padding: 8 }}
                      >
                        <Text style={{ color: '#d1d5db', fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</Text>
                      </TouchableOpacity>
                    </View>

                    {isExpanded && (
                      <View style={{ backgroundColor: '#f9fafb', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12, gap: 10 }}>
                        {games.length === 0 ? (
                          <Text style={{ color: '#d1d5db', fontSize: 12 }}>No games this week</Text>
                        ) : games.map(m => {
                          const opp = m.home_team === entry.player_ipl_team ? m.away_team : m.home_team
                          const isHome = m.home_team === entry.player_ipl_team
                          const statusColor = m.status === 'live' ? '#b45309' : m.status === 'completed' ? '#16a34a' : m.status === 'upcoming' ? '#1d4ed8' : '#6b7280'
                          const statusBg = m.status === 'live' ? '#fef9c3' : m.status === 'completed' ? '#f0fdf4' : m.status === 'upcoming' ? '#dbeafe' : '#f3f4f6'
                          const statusLabel = m.status === 'live' ? 'LIVE' : m.status === 'completed' ? 'FINAL' : m.status === 'upcoming' ? 'NEXT' : 'UPCOMING'
                          const playerStats = getPlayerStats(m.match_id, entry.player_id)
                          return (
                            <View key={m.id} style={{ gap: 4 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ backgroundColor: statusBg, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                                  <Text style={{ color: statusColor, fontSize: 9, fontWeight: '700' }}>{statusLabel}</Text>
                                </View>
                                <Text style={{ color: '#374151', fontSize: 12, fontWeight: '500', flex: 1 }}>
                                  {isHome ? 'vs' : '@'} {opp}
                                </Text>
                                {playerStats && (m.status === 'completed' || m.status === 'live') ? (
                                  <PointsValue
                                    value={playerStats.points}
                                    stats={{ ...playerStats, playerRole: entry.player_role }}
                                    playerName={entry.player_name}
                                    style={{ color: playerStats.points > 0 ? '#16a34a' : '#9ca3af', fontSize: 12, fontWeight: '700' }}
                                  >
                                    {playerStats.points > 0 ? `+${playerStats.points.toFixed(1)}` : '0'}
                                  </PointsValue>
                                ) : (
                                  <Text style={{ color: '#9ca3af', fontSize: 11 }}>{formatMatchTime(m)}</Text>
                                )}
                              </View>
                              {playerStats && (m.status === 'completed' || m.status === 'live') && (
                                <Text style={{ color: '#9ca3af', fontSize: 11, paddingLeft: 2 }}>{statLine(playerStats)}</Text>
                              )}
                            </View>
                          )
                        })}
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
          ))
        )}
      </View>

      {selectedPlayer && (
        <PlayerDetailModal
          visible={!!selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          playerId={selectedPlayer.id}
          player={selectedPlayer.info}
        />
      )}
    </>
  )
}

// ── DualLineupCard ─────────────────────────────────────────────────────────────
// Shows two lineups side by side inside a single card.

export interface BenchEntry {
  player_id: string
  player_name: string
  player_ipl_team: string
  player_role: string
}

interface DualLineupCardProps {
  myName: string
  myLineup: LineupEntry[]
  myHeaderAction?: ReactNode
  oppName: string
  oppLineup: LineupEntry[]
  myBench?: BenchEntry[]
  oppBench?: BenchEntry[]
  weekMatches: IplMatch[]
  breakdownByMatchId: Map<string, GameBreakdownData>
  getMyPlayerStats: (matchId: string, playerId: string) => GamePlayer | undefined
  getOppPlayerStats: (matchId: string, playerId: string) => GamePlayer | undefined
}

export function DualLineupCard({
  myName, myLineup, myHeaderAction,
  oppName, oppLineup,
  myBench = [], oppBench = [],
  weekMatches, breakdownByMatchId,
  getMyPlayerStats, getOppPlayerStats,
}: DualLineupCardProps) {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window')
  type WeekModal = { entry: BenchEntry; getStats: (matchId: string, playerId: string) => GamePlayer | undefined; isBench?: boolean }
  const [weekModal, setWeekModal] = useState<WeekModal | null>(null)
  const [breakdown, setBreakdown] = useState<{ stats: BreakdownStats; total: number; matchDesc: string } | null>(null)
  const [activePage, setActivePage] = useState<'games' | 'breakdown'>('games')
  const backdropOpacity = useRef(new Animated.Value(0)).current
  const sheetTranslateY = useRef(new Animated.Value(500)).current

  useEffect(() => {
    if (weekModal) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200, mass: 0.8 }),
      ]).start()
    } else {
      backdropOpacity.setValue(0)
      sheetTranslateY.setValue(500)
      setActivePage('games')
    }
  }, [weekModal])

  function openBreakdown(stats: BreakdownStats, total: number, matchDesc: string) {
    setBreakdown({ stats, total, matchDesc })
    setActivePage('breakdown')
  }
  function closeBreakdown() {
    setActivePage('games')
    setBreakdown(null)
  }
  function closeWeekModal() {
    setWeekModal(null)
    setBreakdown(null)
    setActivePage('games')
  }

  function gamesRemainingForTeam(iplTeam: string) {
    return weekMatches.filter(m => (m.home_team === iplTeam || m.away_team === iplTeam) && m.status !== 'completed')
  }

  function weekPts(entry: BenchEntry, getStats: (matchId: string, playerId: string) => GamePlayer | undefined) {
    return Array.from(breakdownByMatchId.values()).reduce((sum, bd) => {
      const p = getStats(bd.matchId, entry.player_id)
      return sum + (p?.points ?? 0)
    }, 0)
  }

  // Pair both lineups by role — zip entries, padding shorter side with nulls
  const allRoles = [...new Set([
    ...groupByRole(myLineup, e => e.slot_role).map(g => g.role),
    ...groupByRole(oppLineup, e => e.slot_role).map(g => g.role),
  ])].sort((a, b) => (ROLE_ORDER[a] ?? 5) - (ROLE_ORDER[b] ?? 5))

  const myByRole = new Map(groupByRole(myLineup, e => e.slot_role).map(g => [g.role, g.items]))
  const oppByRole = new Map(groupByRole(oppLineup, e => e.slot_role).map(g => [g.role, g.items]))

  function PlayerCell({ entry, getStats, side, isBench = false }: { entry: BenchEntry | null; getStats: (matchId: string, playerId: string) => GamePlayer | undefined; side: 'left' | 'right'; isBench?: boolean }) {
    if (!entry) return <View style={{ flex: 1 }} />
    const pts = weekPts(entry, getStats)
    const gamesLeft = isBench ? [] : gamesRemainingForTeam(entry.player_ipl_team)
    const isRight = side === 'right'
    const hasPlayedGame = weekMatches.some(
      m => (m.home_team === entry.player_ipl_team || m.away_team === entry.player_ipl_team)
        && (m.status === 'completed' || m.status === 'live')
    )

    const ptsBg = isBench ? '#f3f4f6' : pts > 0 ? '#f0fdf4' : pts < 0 ? '#fee2e2' : '#f3f4f6'
    const ptsColor = isBench ? '#9ca3af' : pts > 0 ? '#16a34a' : pts < 0 ? '#dc2626' : '#9ca3af'
    const ptsLabel = isBench ? pts.toFixed(1) : pts > 0 ? `+${pts.toFixed(1)}` : pts < 0 ? pts.toFixed(1) : '0.0'

    const badges = (
      <View style={{ alignItems: isRight ? 'flex-start' : 'flex-end', gap: 3 }}>
        {hasPlayedGame && (
          <View style={{ backgroundColor: ptsBg, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
            <Text style={{ color: ptsColor, fontSize: 10, fontWeight: '700' }}>{ptsLabel}</Text>
          </View>
        )}
      </View>
    )

    const abbrev = TEAM_ABBREV[entry.player_ipl_team] ?? entry.player_ipl_team
    const teamLine = gamesLeft.length > 0 ? `${abbrev} · ${gamesLeft.length} left` : abbrev

    const nameBlock = (
      <View style={{ flex: 1, alignItems: isRight ? 'flex-end' : 'flex-start' }}>
        <Text style={{ color: '#111827', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
          {entry.player_name}
        </Text>
        <Text style={{ color: '#9ca3af', fontSize: 10 }} numberOfLines={1}>
          {teamLine}
        </Text>
      </View>
    )

    return (
      <TouchableOpacity
        onPress={() => setWeekModal({ entry, getStats, isBench })}
        style={{ flex: 1, flexDirection: isRight ? 'row-reverse' : 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 8, gap: 6 }}
      >
        {nameBlock}
        {badges}
      </TouchableOpacity>
    )
  }

  return (
    <>
      <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}>
        {/* Split header */}
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, backgroundColor: '#1f2937', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 12, flex: 1 }} numberOfLines={1}>
              {myName} ★
            </Text>
            {myHeaderAction}
          </View>
          <View style={{ width: 1, backgroundColor: '#374151' }} />
          <View style={{ flex: 1, backgroundColor: '#374151', paddingHorizontal: 12, paddingVertical: 10 }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }} numberOfLines={1}>
              {oppName}
            </Text>
          </View>
        </View>

        {/* Rows by role */}
        {allRoles.map(role => {
          const myEntries = myByRole.get(role) ?? []
          const oppEntries = oppByRole.get(role) ?? []
          const rowCount = Math.max(myEntries.length, oppEntries.length)
          return (
            <View key={role}>
              <RoleSectionHeader role={role} count={Math.max(myEntries.length, oppEntries.length)} />
              {Array.from({ length: rowCount }).map((_, i) => (
                <View key={i} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
                  <PlayerCell entry={myEntries[i] ?? null} getStats={getMyPlayerStats} side="left" />
                  <View style={{ width: 1, backgroundColor: '#f3f4f6' }} />
                  <PlayerCell entry={oppEntries[i] ?? null} getStats={getOppPlayerStats} side="right" />
                </View>
              ))}
            </View>
          )
        })}

        {/* Bench */}
        {(myBench.length > 0 || oppBench.length > 0) && (
          <View>
            <View style={{ backgroundColor: '#f9fafb', paddingHorizontal: 16, paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#f3f4f6', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>BENCH</Text>
              <Text style={{ color: '#d1d5db', fontSize: 11, marginLeft: 'auto' }}>
                {Math.max(myBench.length, oppBench.length)}
              </Text>
            </View>
            {Array.from({ length: Math.max(myBench.length, oppBench.length) }).map((_, i) => (
              <View key={i} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
                <PlayerCell entry={myBench[i] ?? null} getStats={getMyPlayerStats} side="left" isBench />
                <View style={{ width: 1, backgroundColor: '#f3f4f6' }} />
                <PlayerCell entry={oppBench[i] ?? null} getStats={getOppPlayerStats} side="right" isBench />
              </View>
            ))}
          </View>
        )}

        {myLineup.length === 0 && oppLineup.length === 0 && (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: '#d1d5db', fontSize: 13 }}>No lineups set yet</Text>
          </View>
        )}
      </View>

      {/* Week games modal */}
      <Modal
        visible={!!weekModal}
        transparent
        animationType="none"
        onRequestClose={closeWeekModal}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', opacity: backdropOpacity }}
          >
            <Pressable style={{ flex: 1 }} onPress={closeWeekModal} />
          </Animated.View>
          <Animated.View style={{ transform: [{ translateY: sheetTranslateY }] }}>
          <View>
            <View style={{ backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 36, ...(activePage === 'breakdown' ? { height: screenHeight * 0.5 } : {}) }}>
              {/* Handle */}
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb' }} />
              </View>
              {/* Header — changes per page */}
              <View style={{ paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {breakdown && (
                  <TouchableOpacity onPress={closeBreakdown} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={{ fontSize: 18, color: '#6b7280' }}>‹</Text>
                  </TouchableOpacity>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
                    {breakdown ? 'Points Breakdown' : weekModal?.entry.player_name}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                    {breakdown
                      ? `${weekModal?.entry.player_name} · ${breakdown.matchDesc}`
                      : `${TEAM_ABBREV[weekModal?.entry.player_ipl_team ?? ''] ?? weekModal?.entry.player_ipl_team} · This week`}
                  </Text>
                </View>
              </View>

              {/* Page 1 — games (auto height, no scroll) */}
              {activePage === 'games' && weekModal && (() => {
                const { entry, getStats } = weekModal
                const games = weekMatches.filter(m => m.home_team === entry.player_ipl_team || m.away_team === entry.player_ipl_team)
                return (
                  <View style={{ padding: 16, gap: 12 }}>
                    {games.length === 0 ? (
                      <Text style={{ color: '#d1d5db', fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>No games this week</Text>
                    ) : games.map(m => {
                      const opp = m.home_team === entry.player_ipl_team ? m.away_team : m.home_team
                      const isHome = m.home_team === entry.player_ipl_team
                      const statusColor = m.status === 'live' ? '#b45309' : m.status === 'completed' ? '#16a34a' : m.status === 'upcoming' ? '#1d4ed8' : '#6b7280'
                      const statusBg = m.status === 'live' ? '#fef9c3' : m.status === 'completed' ? '#f0fdf4' : m.status === 'upcoming' ? '#dbeafe' : '#f3f4f6'
                      const statusLabel = m.status === 'live' ? 'LIVE' : m.status === 'completed' ? 'FINAL' : m.status === 'upcoming' ? 'NEXT' : 'UPCOMING'
                      const playerStats = getStats(m.match_id, entry.player_id)
                      const hasStats = playerStats && (m.status === 'completed' || m.status === 'live')
                      return (
                        <View key={m.id} style={{ gap: 4 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ backgroundColor: statusBg, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                              <Text style={{ color: statusColor, fontSize: 9, fontWeight: '700' }}>{statusLabel}</Text>
                            </View>
                            <Text style={{ color: '#374151', fontSize: 13, fontWeight: '500', flex: 1 }}>
                              {isHome ? 'vs' : '@'} {opp}
                            </Text>
                            {hasStats ? (
                              <TouchableOpacity onPress={() => openBreakdown({ ...playerStats, playerRole: entry.player_role }, playerStats.points, `${isHome ? 'vs' : '@'} ${opp}`)}>
                                <Text style={{ color: playerStats.points > 0 ? '#16a34a' : '#9ca3af', fontSize: 13, fontWeight: '700' }}>
                                  {playerStats.points > 0 ? `+${playerStats.points.toFixed(1)}` : '0'} ›
                                </Text>
                              </TouchableOpacity>
                            ) : (
                              <Text style={{ color: '#9ca3af', fontSize: 12 }}>{formatMatchTime(m)}</Text>
                            )}
                          </View>
                          {hasStats && (
                            <Text style={{ color: '#9ca3af', fontSize: 11, paddingLeft: 2 }}>{statLine(playerStats)}</Text>
                          )}
                        </View>
                      )
                    })}
                  </View>
                )
              })()}

              {/* Page 2 — breakdown (scrollable, slides in from right) */}
              {activePage === 'breakdown' && breakdown && (
                <View style={{ flex: 1 }}>
                  <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {(() => {
                      const items = calcBreakdown(breakdown.stats)
                      const sections = (['General', 'Batting', 'Bowling', 'Fielding'] as const).filter(sec => items.some(i => i.section === sec))
                      if (items.length === 0) return (
                        <Text style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', paddingVertical: 24 }}>No stats recorded</Text>
                      )
                      return (
                        <>
                          {sections.map(sec => (
                            <View key={sec} style={{ marginBottom: 14 }}>
                              <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 }}>{sec.toUpperCase()}</Text>
                              {items.filter(i => i.section === sec).map((item, idx) => (
                                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f9fafb' }}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#374151', fontSize: 13, fontWeight: '500' }}>{item.label}</Text>
                                    <Text style={{ color: '#9ca3af', fontSize: 11, marginTop: 1 }}>{item.detail}</Text>
                                  </View>
                                  <Text style={{ fontSize: 13, fontWeight: '700', minWidth: 36, textAlign: 'right', color: item.pts > 0 ? '#16a34a' : item.pts < 0 ? '#dc2626' : '#9ca3af' }}>
                                    {item.pts > 0 ? `+${item.pts}` : item.pts}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ))}
                          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: 2, borderTopColor: '#f3f4f6' }}>
                            <Text style={{ flex: 1, color: '#111827', fontSize: 14, fontWeight: '700' }}>Total</Text>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: breakdown.total > 0 ? '#16a34a' : '#9ca3af' }}>
                              {breakdown.total > 0 ? `+${breakdown.total.toFixed(1)}` : breakdown.total.toFixed(1)}
                            </Text>
                          </View>
                        </>
                      )
                    })()}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  )
}
