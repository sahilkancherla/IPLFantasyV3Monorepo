import { useState, useRef, useEffect, ReactNode } from 'react'
import { NavButton } from '../ui/NavButton'
import { View, Text, TouchableOpacity, Modal, ScrollView, Pressable, Dimensions, Animated } from 'react-native'
import { type BreakdownStats, PointsBreakdownContent } from '../ui/PointsBreakdown'
import { PointsValue } from '../ui/PointsBreakdown'
import { PlayerDetailModal } from './PlayerDetailModal'
import type { PlayerDetailInfo } from './PlayerDetailModal'
import type { LineupEntry, GamePlayer, GameBreakdownData } from '../../hooks/useLineup'
import type { IplMatch } from '../../hooks/useMatchup'
import {
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, TEXT_PLACEHOLDER, TEXT_DISABLED,
  BORDER_DEFAULT, BORDER_MEDIUM,
  BG_CARD, BG_SUBTLE, BG_PAGE, BG_DARK_HEADER,
  PRIMARY, PRIMARY_SUBTLE,
  SUCCESS, SUCCESS_BG,
  roleColors,
  matchStatusColors,
} from '../../constants/colors'

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
  ...roleColors,
  flex: TEXT_MUTED,
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
  const roleColor = ROLE_COLORS[role] ?? TEXT_MUTED
  const roleShort = roleLabels[role] ?? role.toUpperCase()
  const groupLabel = ROLE_GROUP_LABELS[role] ?? role
  return (
    <View style={{ backgroundColor: BG_PAGE, paddingHorizontal: 16, paddingVertical: 7, borderTopWidth: 1, borderTopColor: BORDER_DEFAULT, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ backgroundColor: roleColor + '20', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
        <Text style={{ color: roleColor, fontSize: 10, fontWeight: '700' }}>{roleShort}</Text>
      </View>
      <Text style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: '600' }}>{groupLabel}</Text>
      <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, marginLeft: 'auto' }}>{count}</Text>
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
  headerColor?: string           // default BG_DARK_HEADER
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
  headerColor = BG_DARK_HEADER,
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
      <View style={{ backgroundColor: BG_CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER_DEFAULT, overflow: 'hidden' }}>
        <View style={{ backgroundColor: headerColor, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 13, flex: 1 }} numberOfLines={1}>
            {title}{titleSuffix}
          </Text>
          {headerAction}
        </View>

        {lineup.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: TEXT_DISABLED, fontSize: 13 }}>{emptyMessage}</Text>
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
                  <View key={entry.id} style={{ borderTopWidth: 1, borderTopColor: BORDER_DEFAULT }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8 }}>
                      <TouchableOpacity
                        onPress={() => setSelectedPlayer({ id: entry.player_id, info: { name: entry.player_name, ipl_team: entry.player_ipl_team, role: entry.player_role } })}
                        style={{ flex: 1, paddingVertical: 11, paddingLeft: 4 }}
                      >
                        <Text style={{ color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                          {entry.player_name}
                        </Text>
                        <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11 }}>{entry.player_ipl_team}</Text>
                      </TouchableOpacity>
                      {weekPts > 0 && (
                        <Text style={{ color: SUCCESS, fontSize: 12, fontWeight: '700', marginRight: 6 }}>
                          +{weekPts.toFixed(1)}
                        </Text>
                      )}
                      {gamesRemaining.length > 0 && (
                        <View style={{ backgroundColor: PRIMARY_SUBTLE, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginRight: 6 }}>
                          <Text style={{ color: PRIMARY, fontSize: 11, fontWeight: '700' }}>
                            {gamesRemaining.length} {gamesRemaining.length === 1 ? 'game left' : 'games left'}
                          </Text>
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={() => setExpanded(prev => { const s = new Set(prev); isExpanded ? s.delete(entry.id) : s.add(entry.id); return s })}
                        style={{ padding: 8 }}
                      >
                        <Text style={{ color: TEXT_DISABLED, fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</Text>
                      </TouchableOpacity>
                    </View>

                    {isExpanded && (
                      <View style={{ backgroundColor: BG_PAGE, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12, gap: 10 }}>
                        {games.length === 0 ? (
                          <Text style={{ color: TEXT_DISABLED, fontSize: 12 }}>No games this week</Text>
                        ) : games.map(m => {
                          const opp = m.home_team === entry.player_ipl_team ? m.away_team : m.home_team
                          const isHome = m.home_team === entry.player_ipl_team
                          const { text: statusColor, bg: statusBg } = matchStatusColors(m.status)
                          const statusLabel = m.status === 'live' ? 'LIVE' : m.status === 'completed' ? 'FINAL' : m.status === 'upcoming' ? 'NEXT' : 'UPCOMING'
                          const playerStats = getPlayerStats(m.match_id, entry.player_id)
                          return (
                            <View key={m.id} style={{ gap: 4 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ backgroundColor: statusBg, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                                  <Text style={{ color: statusColor, fontSize: 9, fontWeight: '700' }}>{statusLabel}</Text>
                                </View>
                                <Text style={{ color: TEXT_SECONDARY, fontSize: 12, fontWeight: '500', flex: 1 }}>
                                  {isHome ? 'vs' : '@'} {opp}
                                </Text>
                                {playerStats && (m.status === 'completed' || m.status === 'live') ? (
                                  <PointsValue
                                    value={playerStats.points}
                                    stats={{ ...playerStats, playerRole: entry.player_role }}
                                    playerName={entry.player_name}
                                    style={{ color: playerStats.points > 0 ? SUCCESS : TEXT_PLACEHOLDER, fontSize: 12, fontWeight: '700' }}
                                  >
                                    {playerStats.points > 0 ? `+${playerStats.points.toFixed(1)}` : '0'}
                                  </PointsValue>
                                ) : (
                                  <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11 }}>{formatMatchTime(m)}</Text>
                                )}
                              </View>
                              {playerStats && (m.status === 'completed' || m.status === 'live') && (
                                <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, paddingLeft: 2 }}>{statLine(playerStats)}</Text>
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
  myOverridePoints?: number | null
  myOverrideNote?: string | null
  oppOverridePoints?: number | null
  oppOverrideNote?: string | null
}

export function DualLineupCard({
  myName, myLineup, myHeaderAction,
  oppName, oppLineup,
  myBench = [], oppBench = [],
  weekMatches, breakdownByMatchId,
  getMyPlayerStats, getOppPlayerStats,
  myOverridePoints, myOverrideNote,
  oppOverridePoints, oppOverrideNote,
}: DualLineupCardProps) {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window')
  type WeekModal = { entry: BenchEntry; getStats: (matchId: string, playerId: string) => GamePlayer | undefined; isBench?: boolean }
  const [weekModal, setWeekModal] = useState<WeekModal | null>(null)
  const [breakdown, setBreakdown] = useState<{ stats: BreakdownStats; total: number; matchDesc: string } | null>(null)
  const [activePage, setActivePage] = useState<'games' | 'breakdown'>('games')
  const sheetTranslateY = useRef(new Animated.Value(500)).current

  useEffect(() => {
    if (weekModal) {
      Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200, mass: 0.8 }).start()
    } else {
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

    const ptsBg = isBench ? BG_SUBTLE : pts > 0 ? SUCCESS_BG : pts < 0 ? PRIMARY_SUBTLE : BG_SUBTLE
    const ptsColor = isBench ? TEXT_PLACEHOLDER : pts > 0 ? SUCCESS : pts < 0 ? PRIMARY : TEXT_PLACEHOLDER
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
        <Text style={{ color: TEXT_PRIMARY, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
          {entry.player_name}
        </Text>
        <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 10 }} numberOfLines={1}>
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
      <View style={{ backgroundColor: BG_CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER_DEFAULT, overflow: 'hidden' }}>
        {/* Split header */}
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, backgroundColor: BG_DARK_HEADER, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }} numberOfLines={1}>
                {myName} ★
              </Text>
              {myLineup.length === 0 && (
                <Text style={{ color: '#f87171', fontSize: 10, marginTop: 2 }}>Lineup not set</Text>
              )}
            </View>
            {myHeaderAction}
          </View>
          <View style={{ width: 1, backgroundColor: TEXT_SECONDARY }} />
          <View style={{ flex: 1, backgroundColor: TEXT_SECONDARY, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }} numberOfLines={1}>
              {oppName}
            </Text>
            {oppLineup.length === 0 && (
              <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 10, marginTop: 2 }}>Lineup not set</Text>
            )}
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
                <View key={i} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: BORDER_DEFAULT }}>
                  <PlayerCell entry={myEntries[i] ?? null} getStats={getMyPlayerStats} side="left" />
                  <View style={{ width: 1, backgroundColor: BORDER_DEFAULT }} />
                  <PlayerCell entry={oppEntries[i] ?? null} getStats={getOppPlayerStats} side="right" />
                </View>
              ))}
            </View>
          )
        })}

        {/* Starters total row */}
        {(myLineup.length > 0 || oppLineup.length > 0) && (() => {
          const myTotal = myLineup.reduce((sum, e) => sum + weekPts(e, getMyPlayerStats), 0)
          const oppTotal = oppLineup.reduce((sum, e) => sum + weekPts(e, getOppPlayerStats), 0)
          const anyPoints = myTotal !== 0 || oppTotal !== 0
          if (!anyPoints) return null
          return (
            <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: BORDER_MEDIUM, backgroundColor: BG_PAGE, paddingVertical: 9 }}>
              <View style={{ flex: 1, paddingHorizontal: 12, alignItems: 'flex-start', justifyContent: 'center' }}>
                <Text style={{ color: myTotal !== 0 ? (myTotal > 0 ? SUCCESS : PRIMARY) : TEXT_PLACEHOLDER, fontWeight: '800', fontSize: 13 }}>
                  {myTotal !== 0 ? (myTotal > 0 ? `+${myTotal.toFixed(1)}` : myTotal.toFixed(1)) : '—'}
                </Text>
              </View>
              <Text style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 0.2, alignSelf: 'center' }}>TOTAL</Text>
              <View style={{ flex: 1, paddingHorizontal: 12, alignItems: 'flex-end', justifyContent: 'center' }}>
                <Text style={{ color: oppTotal !== 0 ? (oppTotal > 0 ? SUCCESS : PRIMARY) : TEXT_PLACEHOLDER, fontWeight: '800', fontSize: 13 }}>
                  {oppTotal !== 0 ? (oppTotal > 0 ? `+${oppTotal.toFixed(1)}` : oppTotal.toFixed(1)) : '—'}
                </Text>
              </View>
            </View>
          )
        })()}

        {/* Bench */}
        {(myBench.length > 0 || oppBench.length > 0) && (
          <View>
            <View style={{ backgroundColor: BG_PAGE, paddingHorizontal: 16, paddingVertical: 7, borderTopWidth: 1, borderTopColor: BORDER_DEFAULT, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>BENCH</Text>
              <Text style={{ color: TEXT_DISABLED, fontSize: 11, marginLeft: 'auto' }}>
                {Math.max(myBench.length, oppBench.length)}
              </Text>
            </View>
            {Array.from({ length: Math.max(myBench.length, oppBench.length) }).map((_, i) => (
              <View key={i} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: BORDER_DEFAULT }}>
                <PlayerCell entry={myBench[i] ?? null} getStats={getMyPlayerStats} side="left" isBench />
                <View style={{ width: 1, backgroundColor: BORDER_DEFAULT }} />
                <PlayerCell entry={oppBench[i] ?? null} getStats={getOppPlayerStats} side="right" isBench />
              </View>
            ))}
          </View>
        )}

        {/* Admin points override row */}
        {(myOverridePoints != null || oppOverridePoints != null) && (() => {
          const myPts = myOverridePoints != null ? parseFloat(String(myOverridePoints)) : null
          const oppPts = oppOverridePoints != null ? parseFloat(String(oppOverridePoints)) : null
          return (
          <View style={{ borderTopWidth: 1, borderTopColor: BORDER_DEFAULT }}>
            <View style={{ backgroundColor: BG_PAGE, paddingHorizontal: 16, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>BONUS</Text>
            </View>
            <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: BORDER_DEFAULT }}>
              {/* My override */}
              <View style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 10 }}>
                {myPts != null ? (
                  <>
                    <Text style={{ color: myPts >= 0 ? SUCCESS : PRIMARY, fontWeight: '700', fontSize: 13 }}>
                      {myPts >= 0 ? '+' : ''}{myPts.toFixed(1)} pts
                    </Text>
                    {myOverrideNote ? <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, marginTop: 2 }} numberOfLines={2}>{myOverrideNote}</Text> : null}
                  </>
                ) : null}
              </View>
              <View style={{ width: 1, backgroundColor: BORDER_DEFAULT }} />
              {/* Opp override */}
              <View style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 10, alignItems: 'flex-end' }}>
                {oppPts != null ? (
                  <>
                    <Text style={{ color: oppPts >= 0 ? SUCCESS : PRIMARY, fontWeight: '700', fontSize: 13 }}>
                      {oppPts >= 0 ? '+' : ''}{oppPts.toFixed(1)} pts
                    </Text>
                    {oppOverrideNote ? <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, marginTop: 2, textAlign: 'right' }} numberOfLines={2}>{oppOverrideNote}</Text> : null}
                  </>
                ) : null}
              </View>
            </View>
          </View>
          )
        })()}

        {myLineup.length === 0 && oppLineup.length === 0 && (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: TEXT_DISABLED, fontSize: 13 }}>No lineups set yet</Text>
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
          <View
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' }}
          >
            <Pressable style={{ flex: 1 }} onPress={closeWeekModal} />
          </View>
          <Animated.View style={{ transform: [{ translateY: sheetTranslateY }] }}>
          <View>
            <View style={{ backgroundColor: BG_CARD, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 36, ...(activePage === 'breakdown' ? { height: screenHeight * 0.5 } : {}) }}>
              {/* Handle */}
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: BORDER_MEDIUM }} />
              </View>
              {/* Header — changes per page */}
              <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT, flexDirection: 'row', alignItems: 'center' }}>
                {breakdown
                  ? <NavButton label="← Back" onPress={closeBreakdown} />
                  : <View style={{ flex: 1 }} />
                }
                <View style={{ flex: 1 }} />
                <NavButton label="Close" onPress={closeWeekModal} />
              </View>

              {/* Page 1 — games (auto height, no scroll) */}
              {activePage === 'games' && weekModal && (() => {
                const { entry, getStats } = weekModal
                const games = weekMatches.filter(m => m.home_team === entry.player_ipl_team || m.away_team === entry.player_ipl_team)
                return (
                  <View style={{ padding: 16, gap: 12 }}>
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY }}>{entry.player_name}</Text>
                      <Text style={{ fontSize: 12, color: TEXT_PLACEHOLDER, marginTop: 2 }}>
                        {TEAM_ABBREV[entry.player_ipl_team] ?? entry.player_ipl_team} · This week
                      </Text>
                    </View>
                    {games.length === 0 ? (
                      <Text style={{ color: TEXT_DISABLED, fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>No games this week</Text>
                    ) : games.map(m => {
                      const opp = m.home_team === entry.player_ipl_team ? m.away_team : m.home_team
                      const isHome = m.home_team === entry.player_ipl_team
                      const { text: statusColor, bg: statusBg } = matchStatusColors(m.status)
                      const statusLabel = m.status === 'live' ? 'LIVE' : m.status === 'completed' ? 'FINAL' : m.status === 'upcoming' ? 'NEXT' : 'UPCOMING'
                      const playerStats = getStats(m.match_id, entry.player_id)
                      const hasStats = playerStats && (m.status === 'completed' || m.status === 'live')
                      return (
                        <View key={m.id} style={{ gap: 4 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ backgroundColor: statusBg, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                              <Text style={{ color: statusColor, fontSize: 9, fontWeight: '700' }}>{statusLabel}</Text>
                            </View>
                            <Text style={{ color: TEXT_SECONDARY, fontSize: 13, fontWeight: '500', flex: 1 }}>
                              {isHome ? 'vs' : '@'} {opp}
                            </Text>
                            {hasStats ? (
                              <TouchableOpacity onPress={() => openBreakdown({ ...playerStats, playerRole: entry.player_role }, playerStats.points, `${isHome ? 'vs' : '@'} ${opp}`)}>
                                <Text style={{ color: playerStats.points > 0 ? SUCCESS : TEXT_PLACEHOLDER, fontSize: 13, fontWeight: '700' }}>
                                  {playerStats.points > 0 ? `+${playerStats.points.toFixed(1)}` : '0'} ›
                                </Text>
                              </TouchableOpacity>
                            ) : (
                              <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 12 }}>{formatMatchTime(m)}</Text>
                            )}
                          </View>
                          {hasStats && (
                            <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, paddingLeft: 2 }}>{statLine(playerStats)}</Text>
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
                    <PointsBreakdownContent
                      stats={breakdown.stats}
                      total={breakdown.total}
                      playerName={weekModal?.entry.player_name}
                      subtitle={breakdown.matchDesc}
                    />
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
