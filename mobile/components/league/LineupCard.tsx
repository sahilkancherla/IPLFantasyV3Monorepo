import { useState } from 'react'
import { View, Text, TouchableOpacity, ReactNode } from 'react-native'
import { PointsValue } from '../ui/PointsBreakdown'
import { PlayerDetailModal } from './PlayerDetailModal'
import type { PlayerDetailInfo } from './PlayerDetailModal'
import type { LineupEntry, GamePlayer, GameBreakdownData } from '../../hooks/useLineup'
import type { IplMatch } from '../../hooks/useMatchup'

// ── Shared helpers ────────────────────────────────────────────────────────────

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
                      <View style={{ backgroundColor: games.length > 0 ? '#fee2e2' : '#f3f4f6', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginRight: 6 }}>
                        <Text style={{ color: games.length > 0 ? '#dc2626' : '#9ca3af', fontSize: 11, fontWeight: '700' }}>
                          {games.length} {games.length === 1 ? 'game' : 'games'}
                        </Text>
                      </View>
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
          playerInfo={selectedPlayer.info}
        />
      )}
    </>
  )
}
