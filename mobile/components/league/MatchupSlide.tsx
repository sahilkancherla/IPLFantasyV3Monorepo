import { View, Text, ScrollView, Modal, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useRef, useEffect, useState, useCallback } from 'react'
import { useLineup, useUserLineup, useSetLineup, useGameBreakdown } from '../../hooks/useLineup'
import type { LineupEntry } from '../../hooks/useLineup'
import { GameBreakdownSection } from './GameBreakdownSection'
import { PlayerDetailModal } from './PlayerDetailModal'
import type { PlayerDetailInfo } from './PlayerDetailModal'
import type { Matchup, IplWeek } from '../../hooks/useMatchup'
import { useWeekMatches } from '../../hooks/useMatchup'
import { useMyTeam } from '../../hooks/useTeam'

const EMPTY_LINEUP: LineupEntry[] = []

interface Props {
  matchup: Matchup | null
  week: IplWeek
  leagueId: string
  userId: string
  width: number
}

const roleLabels: Record<string, string> = {
  batsman: 'BAT',
  bowler: 'BOW',
  all_rounder: 'AR',
  wicket_keeper: 'WK',
}

const ROLE_ORDER: Record<string, number> = {
  batsman: 0, wicket_keeper: 1, all_rounder: 2, bowler: 3, flex: 4,
}
function sortByRole<T extends { playerRole?: string; slot_role?: string; player_role?: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const ra = ROLE_ORDER[a.slot_role ?? a.playerRole ?? a.player_role ?? ''] ?? 5
    const rb = ROLE_ORDER[b.slot_role ?? b.playerRole ?? b.player_role ?? ''] ?? 5
    return ra - rb
  })
}

const ROLE_COLORS: Record<string, string> = {
  batsman: '#2563eb', bowler: '#dc2626', all_rounder: '#16a34a', wicket_keeper: '#d97706', flex: '#6b7280',
}
const ROLE_GROUP_LABELS: Record<string, string> = {
  batsman: 'Batsmen', bowler: 'Bowlers', all_rounder: 'All-Rounders', wicket_keeper: 'Wicket Keepers', flex: 'Flex',
}

function RoleSectionHeader({ role, count }: { role: string; count: number }) {
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

function groupByRole<T>(items: T[], getRoleFn: (item: T) => string): Array<{ role: string; items: T[] }> {
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

// Parse YYYY-MM-DD (or full ISO) safely into a local date string
function formatWeekDate(d: string): string {
  const parts = d.slice(0, 10).split('-').map(Number)
  const dt = new Date(parts[0], parts[1] - 1, parts[2])
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function MatchupSlide({ matchup, week, leagueId, userId, width }: Props) {
  const isCompleted = matchup?.is_final ?? false

  const isHome = matchup?.home_user === userId
  const dbMyPoints = matchup ? (isHome ? matchup.home_points : matchup.away_points) : null
  const dbOppPoints = matchup ? (isHome ? matchup.away_points : matchup.home_points) : null
  const myName = matchup
    ? (isHome ? (matchup.home_full_name || matchup.home_username) : (matchup.away_full_name || matchup.away_username))
    : null
  const oppName = matchup
    ? (isHome ? (matchup.away_full_name || matchup.away_username) : (matchup.home_full_name || matchup.home_username))
    : null
  const oppId = matchup ? (isHome ? matchup.away_user : matchup.home_user) : null

  // Always fetch own lineup (needed for editor in pending weeks too)
  const { data: weekMatches } = useWeekMatches(week.week_num)
  const [activeGameIndex, setActiveGameIndex] = useState(0)
  const gameListRef = useRef<ScrollView>(null)

useEffect(() => {
    if (!weekMatches || weekMatches.length === 0) return
    const liveIndex = week.status === 'live'
      ? weekMatches.findIndex(m => m.status === 'live')
      : -1
    const target = liveIndex >= 0 ? liveIndex : 0
    setActiveGameIndex(target)
    if (target > 0) {
      setTimeout(() => {
        gameListRef.current?.scrollTo({ x: target * (width - 64), animated: false })
      }, 50)
    }
  }, [weekMatches, week.status])

  const { data: myLineupData } = useLineup(leagueId, week.week_num)
  const { data: oppLineupData } = useUserLineup(
    oppId ? leagueId : '',
    oppId ?? '',
    week.week_num
  )
  const myLineup = sortByRole(myLineupData?.lineup ?? EMPTY_LINEUP)
  const lineupLocked = myLineupData?.locked ?? false
  const oppLineup = sortByRole(oppLineupData?.lineup ?? [])

  // Per-game breakdown (players + points per match)
  const { data: gameBreakdown } = useGameBreakdown(leagueId, week.week_num, oppId ?? null)
  const breakdownByMatchId = new Map((gameBreakdown?.games ?? []).map((g) => [g.matchId, g]))

  // Compute live weekly totals from game breakdown data
  const liveMyPoints = (gameBreakdown?.games ?? []).reduce((s, g) => s + g.myPoints, 0)
  const liveOppPoints = (gameBreakdown?.games ?? []).reduce((s, g) => s + g.oppPoints, 0)
  const myPoints = gameBreakdown ? liveMyPoints : (dbMyPoints ?? 0) || 0
  const oppPoints = gameBreakdown ? liveOppPoints : (dbOppPoints ?? 0) || 0
  const hasPoints = ((myPoints ?? 0) + (oppPoints ?? 0)) > 0 || ((matchup?.home_points ?? 0) + (matchup?.away_points ?? 0)) > 0
  const isLive = !isCompleted && hasPoints
  const isPending = !isCompleted && !isLive

  // Set lineup modal state
  const [lineupModalOpen, setLineupModalOpen] = useState(false)
  const [carouselKey, setCarouselKey] = useState(0)
  const { data: myRoster } = useMyTeam(lineupModalOpen ? leagueId : '')
  const setLineupMutation = useSetLineup(leagueId)

  type SlotRole = 'batsman' | 'wicket_keeper' | 'all_rounder' | 'bowler' | 'flex'
  type PrimaryRole = 'batsman' | 'wicket_keeper' | 'all_rounder' | 'bowler'
  const PRIMARY_SLOTS: { role: PrimaryRole; label: string; shortLabel: string; count: number }[] = [
    { role: 'batsman', label: 'Batsmen', shortLabel: 'BAT', count: 3 },
    { role: 'wicket_keeper', label: 'Wicket Keepers', shortLabel: 'WK', count: 1 },
    { role: 'all_rounder', label: 'All-Rounders', shortLabel: 'AR', count: 1 },
    { role: 'bowler', label: 'Bowlers', shortLabel: 'BOW', count: 3 },
  ]
  const [selections, setSelections] = useState<Record<SlotRole, string[]>>({
    batsman: [], wicket_keeper: [], all_rounder: [], bowler: [], flex: [],
  })

  function openLineupModal() {
    const prefill: Record<SlotRole, string[]> = {
      batsman: [], wicket_keeper: [], all_rounder: [], bowler: [], flex: [],
    }
    for (const entry of myLineup) {
      prefill[entry.slot_role].push(entry.player_id)
    }
    setSelections(prefill)
    setLineupModalOpen(true)
  }

  function togglePlayer(role: PrimaryRole, playerId: string, maxCount: number) {
    setSelections(prev => {
      const inPrimary = prev[role].includes(playerId)
      const inFlex = prev.flex.includes(playerId)

      if (inPrimary) {
        const newPrimary = prev[role].filter(id => id !== playerId)
        // Promote first flex overflow of the same role back into primary
        const roster = myRoster ?? []
        const flexOfSameRole = prev.flex.find(id => roster.find(p => p.player_id === id)?.player_role === role)
        if (flexOfSameRole) {
          return {
            ...prev,
            [role]: [...newPrimary, flexOfSameRole],
            flex: prev.flex.filter(id => id !== flexOfSameRole),
          }
        }
        return { ...prev, [role]: newPrimary }
      }
      if (inFlex) {
        return { ...prev, flex: prev.flex.filter(id => id !== playerId) }
      }
      // Primary slot has room — add there
      if (prev[role].length < maxCount) {
        return { ...prev, [role]: [...prev[role], playerId] }
      }
      // Primary slot full — overflow to flex if room
      if (prev.flex.length < 3) {
        return { ...prev, flex: [...prev.flex, playerId] }
      }
      return prev
    })
  }

  async function submitLineup() {
    const entries: Array<{ playerId: string; slotRole: SlotRole }> = []
    for (const role of (['batsman', 'wicket_keeper', 'all_rounder', 'bowler', 'flex'] as SlotRole[])) {
      for (const playerId of selections[role]) {
        entries.push({ playerId, slotRole: role })
      }
    }
    try {
      await setLineupMutation.mutateAsync({ weekNum: week.week_num, entries })
      setLineupModalOpen(false)
    } catch { /* error shown below */ }
  }

  // Expanded player rows (lineup cards + modal use separate states)
  const [expandedLineup, setExpandedLineup] = useState<Set<string>>(new Set())
  const [gamesModalOpen, setGamesModalOpen] = useState(false)
  const [expandedModal, setExpandedModal] = useState<Set<string>>(new Set())

  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; info: PlayerDetailInfo } | null>(null)

  function gamesForTeam(iplTeam: string) {
    return (weekMatches ?? []).filter(m => m.home_team === iplTeam || m.away_team === iplTeam)
  }

  function statLine(p: import('../../hooks/useLineup').GamePlayer): string {
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
    return parts.join('  ') || '—'
  }

  function formatMatchTime(m: { start_time_utc: string | null; match_date: string }) {
    if (m.start_time_utc) {
      return new Date(m.start_time_utc).toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      }) + ' IST'
    }
    return m.match_date
  }

  const onGameScroll = useCallback((e: import('react-native').NativeSyntheticEvent<import('react-native').NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (width - 64))
    setActiveGameIndex(idx)
  }, [width])

  const result = isCompleted
    ? (matchup?.winner_id === userId ? 'WIN' : matchup?.winner_id ? 'LOSS' : 'TIE')
    : null

  const statusLabel = isPending ? 'UPCOMING' : isLive ? 'LIVE' : 'FINAL'
  const statusStyle = isPending
    ? { bg: '#f3f4f6', color: '#6b7280' }
    : isLive
    ? { bg: '#fef9c3', color: '#b45309' }
    : { bg: '#f0fdf4', color: '#16a34a' }
  const resultStyle = result === 'WIN'
    ? { bg: '#d1fae5', color: '#16a34a' }
    : result === 'LOSS'
    ? { bg: '#fee2e2', color: '#dc2626' }
    : { bg: '#f3f4f6', color: '#6b7280' }

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 14 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Week header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#111827', fontWeight: '700', fontSize: 17 }} numberOfLines={1}>
            {week.label}
          </Text>
          <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>
            {formatWeekDate(week.start_date)} – {formatWeekDate(week.end_date)}
          </Text>
        </View>
        <View style={{ backgroundColor: statusStyle.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 }}>
          <Text style={{ color: statusStyle.color, fontSize: 11, fontWeight: '700' }}>{statusLabel}</Text>
        </View>
      </View>

      {/* Score card */}
      {matchup ? (
        <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}>
          <View style={{ backgroundColor: '#1f2937', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>Overview</Text>
            {result && (
              <View style={{ backgroundColor: resultStyle.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: resultStyle.color, fontSize: 11, fontWeight: '700' }}>{result}</Text>
              </View>
            )}
          </View>
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <Text style={{ color: '#111827', fontWeight: '700', fontSize: 14, textAlign: 'center' }} numberOfLines={1}>
                  {myName} ★
                </Text>
                <Text style={{ color: '#dc2626', fontWeight: '800', fontSize: 40, lineHeight: 44 }}>
                  {Number(myPoints || 0).toFixed(1)}
                </Text>
                <Text style={{ color: '#9ca3af', fontSize: 12 }}>pts</Text>
              </View>

              <View style={{ alignItems: 'center', paddingHorizontal: 16 }}>
                <Text style={{ color: '#d1d5db', fontWeight: '700', fontSize: 18 }}>VS</Text>
              </View>

              <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <Text style={{ color: '#111827', fontWeight: '600', fontSize: 14, textAlign: 'center' }} numberOfLines={1}>
                  {oppName}
                </Text>
                <Text style={{ color: '#374151', fontWeight: '800', fontSize: 40, lineHeight: 44 }}>
                  {Number(oppPoints || 0).toFixed(1)}
                </Text>
                <Text style={{ color: '#9ca3af', fontSize: 12 }}>pts</Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}>
          <View style={{ backgroundColor: '#1f2937', paddingHorizontal: 16, paddingVertical: 10 }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>Matchup</Text>
          </View>
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ color: '#9ca3af', fontSize: 15 }}>Bye week — no matchup</Text>
          </View>
        </View>
      )}

      {/* IPL Games this week */}
      <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}>
        <View style={{ backgroundColor: '#1f2937', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>
            IPL Games This Week{weekMatches && weekMatches.length > 0 ? ` · ${weekMatches.length}` : ''}
          </Text>
          {weekMatches && weekMatches.length > 0 && (
            <TouchableOpacity
              onPress={() => setGamesModalOpen(true)}
              style={{ backgroundColor: '#dc2626', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}
            >
              <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>Expand</Text>
            </TouchableOpacity>
          )}
        </View>
        {!weekMatches ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: '#d1d5db', fontSize: 13 }}>Loading…</Text>
          </View>
        ) : weekMatches.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: '#d1d5db', fontSize: 13 }}>No games scheduled this week</Text>
          </View>
        ) : (
          <View style={{ padding: 12, gap: 8 }}>
            {weekMatches.length > 1 && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
                {weekMatches.map((m, i) => (
                  <TouchableOpacity key={m.id} onPress={() => {
                    setActiveGameIndex(i)
                    gameListRef.current?.scrollTo({ x: i * (width - 64), animated: true })
                  }}>
                    <View style={{
                      width: i === activeGameIndex ? 16 : 6,
                      height: 6, borderRadius: 3,
                      backgroundColor: i === activeGameIndex ? '#dc2626' : '#e5e7eb',
                    }} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <ScrollView
                key={carouselKey}
                ref={gameListRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={onGameScroll}
                style={{ width: width - 64 }}
              >
                {weekMatches.map(item => {
                  const matchStatus = item.status
                  const statusBg = matchStatus === 'live' ? '#fef9c3'
                    : matchStatus === 'completed' ? '#f0fdf4'
                    : '#f3f4f6'
                  const statusColor = matchStatus === 'live' ? '#b45309'
                    : matchStatus === 'completed' ? '#16a34a'
                    : '#6b7280'
                  const sLabel = matchStatus === 'live' ? 'LIVE'
                    : matchStatus === 'completed' ? 'FINAL'
                    : 'UPCOMING'
                  const dateStr = item.start_time_utc
                    ? new Date(item.start_time_utc).toLocaleString('en-US', {
                        month: 'short', day: 'numeric',
                        hour: 'numeric', minute: '2-digit',
                        timeZone: 'Asia/Kolkata',
                      }) + ' IST'
                    : item.match_date
                  const breakdown = breakdownByMatchId.get(item.match_id)
                  const myPlayers = sortByRole(breakdown?.myPlayers ?? [])
                  const oppPlayers = sortByRole(breakdown?.oppPlayers ?? [])
                  const hasPlayers = myPlayers.length > 0 || oppPlayers.length > 0

                  return (
                    <View
                      key={item.id}
                      style={{ width: width - 64 }}
                    >
                      <View style={{
                        backgroundColor: 'white',
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: '#f3f4f6',
                        padding: 14,
                        gap: 10,
                      }}>
                        {/* Status + match number */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ backgroundColor: statusBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                            <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700' }}>{sLabel}</Text>
                          </View>
                          {item.match_number != null && (
                            <Text style={{ color: '#d1d5db', fontSize: 11 }}>Match {item.match_number}</Text>
                          )}
                        </View>

                        {/* Teams */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ flex: 1, color: '#111827', fontWeight: '700', fontSize: 13, textAlign: 'center' }} numberOfLines={2}>
                            {item.home_team}
                          </Text>
                          <Text style={{ color: '#d1d5db', fontWeight: '700', fontSize: 12 }}>vs</Text>
                          <Text style={{ flex: 1, color: '#111827', fontWeight: '700', fontSize: 13, textAlign: 'center' }} numberOfLines={2}>
                            {item.away_team}
                          </Text>
                        </View>

                        {/* Date + venue */}
                        <View style={{ gap: 2 }}>
                          <Text style={{ color: '#9ca3af', fontSize: 11, textAlign: 'center' }}>{dateStr}</Text>
                          {item.venue != null && (
                            <Text style={{ color: '#d1d5db', fontSize: 10, textAlign: 'center' }} numberOfLines={1}>
                              {item.venue}
                            </Text>
                          )}
                        </View>

                        {/* Players in this game */}
                        <View style={{ borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 10, gap: 10 }}>
                          {!hasPlayers ? (
                            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }}>
                              <Text style={{ color: '#d1d5db', fontSize: 12 }}>No players in this game</Text>
                            </View>
                          ) : [
                            { players: myPlayers, label: myName ?? 'You', labelColor: '#dc2626' },
                            { players: oppPlayers, label: oppName ?? 'Opponent', labelColor: '#6b7280' },
                          ].map(({ players, label, labelColor }) => players.length > 0 && (
                            <View key={label} style={{ gap: 6 }}>
                              <Text style={{ color: labelColor, fontSize: 10, fontWeight: '700' }}>{label}</Text>
                              {players.map(p => (
                                <View key={p.playerId} style={{ gap: 1 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={{ color: '#6b7280', fontSize: 10, fontWeight: '700', width: 28 }}>
                                      {roleLabels[p.playerRole] ?? p.playerRole}
                                    </Text>
                                    <Text style={{ flex: 1, color: '#111827', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                                      {p.playerName}
                                    </Text>
                                    <Text style={{ color: p.points > 0 ? '#16a34a' : '#9ca3af', fontSize: 12, fontWeight: '700' }}>
                                      {p.points > 0 ? `+${p.points.toFixed(1)}` : '—'}
                                    </Text>
                                  </View>
                                  {(matchStatus === 'live' || matchStatus === 'completed') && statLine(p) !== '' && (
                                    <Text style={{ color: '#9ca3af', fontSize: 11 }}>{statLine(p)}</Text>
                                  )}
                                </View>
                              ))}
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>
                  )
                })}
              </ScrollView>
          </View>
        )}
      </View>

      {/* IPL Games Expand Modal */}
      <Modal visible={gamesModalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setGamesModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: '#111827', fontWeight: '700', fontSize: 17 }}>IPL Games This Week</Text>
            <TouchableOpacity onPress={() => setGamesModalOpen(false)}>
              <Text style={{ color: '#6b7280', fontSize: 15, fontWeight: '600' }}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {!isPending && matchup && oppId && (
              <GameBreakdownSection
                leagueId={leagueId}
                weekNum={week.week_num}
                opponentId={oppId}
                myName={myName ?? 'You'}
                oppName={oppName ?? 'Opponent'}
              />
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Lineup lock time */}
      {!lineupLocked && (
        <View style={{ backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#f3f4f6', padding: 14, alignItems: 'center' }}>
          <Text style={{ color: '#6b7280', fontSize: 13 }}>
            Lineups lock {new Date(week.lock_time).toLocaleString('en-US', {
              timeZone: 'America/Los_Angeles',
              weekday: 'short', month: 'short', day: 'numeric',
              hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
            })}
          </Text>
        </View>
      )}

      {/* Per-game breakdown for live / completed
      {!isPending && matchup && oppId && (
        <GameBreakdownSection
          leagueId={leagueId}
          weekNum={week.week_num}
          opponentId={oppId}
          myName={myName ?? 'You'}
          oppName={oppName ?? 'Opponent'}
        />
      )} */}

      {/* Starting lineups — always shown when there's a matchup */}
      {matchup && (
        <View style={{ gap: 10 }}>
          {/* My lineup */}
          <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}>
            <View style={{ backgroundColor: '#1f2937', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                {myName ?? 'You'} ★
              </Text>
              {!lineupLocked && (
                <TouchableOpacity
                  onPress={openLineupModal}
                  style={{ backgroundColor: '#dc2626', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}
                >
                  <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>
                    {myLineup.length === 0 ? 'Set Lineup' : 'Edit Lineup'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {myLineup.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: '#d1d5db', fontSize: 13 }}>You haven't set a lineup yet</Text>
              </View>
            ) : groupByRole(myLineup, e => e.slot_role).map(group => (
              <View key={group.role}>
                <RoleSectionHeader role={group.role} count={group.items.length} />
                {group.items.map(entry => {
                  const isExpanded = expandedLineup.has(entry.id)
                  const games = gamesForTeam(entry.player_ipl_team)
                  const weekPts = Array.from(breakdownByMatchId.values()).reduce((sum, bd) => {
                    const p = bd.myPlayers.find(p => p.playerId === entry.player_id)
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
                          <Text style={{ color: games.length > 0 ? '#dc2626' : '#9ca3af', fontSize: 11, fontWeight: '700' }}>{games.length} {games.length === 1 ? 'game' : 'games'}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setExpandedLineup(prev => { const s = new Set(prev); isExpanded ? s.delete(entry.id) : s.add(entry.id); return s })} style={{ padding: 8 }}>
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
                            const statusColor = m.status === 'live' ? '#b45309' : m.status === 'completed' ? '#16a34a' : '#6b7280'
                            const statusBg = m.status === 'live' ? '#fef9c3' : m.status === 'completed' ? '#f0fdf4' : '#f3f4f6'
                            const statusLabel = m.status === 'live' ? 'LIVE' : m.status === 'completed' ? 'FINAL' : 'UPCOMING'
                            const playerStats = breakdownByMatchId.get(m.match_id)?.myPlayers.find(p => p.playerId === entry.player_id)
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
                                    <Text style={{ color: playerStats.points > 0 ? '#16a34a' : '#9ca3af', fontSize: 12, fontWeight: '700' }}>
                                      {playerStats.points > 0 ? `+${playerStats.points.toFixed(1)}` : '0'}
                                    </Text>
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
            ))}
          </View>

          {/* Opponent lineup */}
          <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}>
            <View style={{ backgroundColor: '#374151', paddingHorizontal: 16, paddingVertical: 10 }}>
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                {oppName ?? 'Opponent'}
              </Text>
            </View>
            {oppLineup.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: '#d1d5db', fontSize: 13 }}>Opponent hasn't set a lineup yet</Text>
              </View>
            ) : groupByRole(oppLineup, e => e.slot_role).map(group => (
              <View key={group.role}>
                <RoleSectionHeader role={group.role} count={group.items.length} />
                {group.items.map(entry => {
                  const isExpanded = expandedLineup.has(entry.id)
                  const games = gamesForTeam(entry.player_ipl_team)
                  const weekPts = Array.from(breakdownByMatchId.values()).reduce((sum, bd) => {
                    const p = bd.oppPlayers.find(p => p.playerId === entry.player_id)
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
                          <Text style={{ color: games.length > 0 ? '#dc2626' : '#9ca3af', fontSize: 11, fontWeight: '700' }}>{games.length} {games.length === 1 ? 'game' : 'games'}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setExpandedLineup(prev => { const s = new Set(prev); isExpanded ? s.delete(entry.id) : s.add(entry.id); return s })} style={{ padding: 8 }}>
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
                            const statusColor = m.status === 'live' ? '#b45309' : m.status === 'completed' ? '#16a34a' : '#6b7280'
                            const statusBg = m.status === 'live' ? '#fef9c3' : m.status === 'completed' ? '#f0fdf4' : '#f3f4f6'
                            const statusLabel = m.status === 'live' ? 'LIVE' : m.status === 'completed' ? 'FINAL' : 'UPCOMING'
                            const playerStats = breakdownByMatchId.get(m.match_id)?.oppPlayers.find(p => p.playerId === entry.player_id)
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
                                    <Text style={{ color: playerStats.points > 0 ? '#16a34a' : '#9ca3af', fontSize: 12, fontWeight: '700' }}>
                                      {playerStats.points > 0 ? `+${playerStats.points.toFixed(1)}` : '0'}
                                    </Text>
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
            ))}
          </View>
        </View>
      )}

      {/* Player stats modal */}
      <PlayerDetailModal
        visible={!!selectedPlayer}
        player={selectedPlayer?.info ?? null}
        playerId={selectedPlayer?.id}
        onClose={() => setSelectedPlayer(null)}
      />

      {/* Set Lineup Modal */}
      <Modal
        visible={lineupModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLineupModalOpen(false)}
        onDismiss={() => setCarouselKey(k => k + 1)}
      >
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          {/* Modal header */}
          <View style={{ backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 }}>
            <View style={{ flexDirection: 'row', flex: 1 }}>
              <Text style={{ color: '#111827', fontWeight: '700', fontSize: 17, flex: 1 }}>Set Lineup — Week {week.week_num}</Text>
              <TouchableOpacity onPress={() => setLineupModalOpen(false)}>
                <Text style={{ color: '#6b7280', fontSize: 15, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </View>

            {/* Position count bar */}
            <View style={{ flexDirection: 'row', marginTop: 14, gap: 6 }}>
              {[
                ...PRIMARY_SLOTS.map(s => ({ label: s.shortLabel, filled: selections[s.role].length, total: s.count })),
                { label: 'FLEX', filled: selections.flex.length, total: 3 },
              ].map(({ label, filled, total }) => {
                const full = filled >= total
                return (
                  <View key={label} style={{ flex: 1, alignItems: 'center', backgroundColor: full ? '#fff5f5' : '#f9fafb', borderRadius: 8, paddingVertical: 6, borderWidth: 1, borderColor: full ? '#fecaca' : '#f3f4f6' }}>
                    <Text style={{ color: full ? '#dc2626' : '#9ca3af', fontSize: 10, fontWeight: '700' }}>{label}</Text>
                    <Text style={{ color: full ? '#dc2626' : '#374151', fontSize: 13, fontWeight: '700', marginTop: 2 }}>{filled}/{total}</Text>
                  </View>
                )
              })}
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}>
            {PRIMARY_SLOTS.map(slot => {
              const roster = myRoster ?? []
              const players = roster.filter(p => p.player_role === slot.role)
              const chosen = selections[slot.role]
              const atCap = chosen.length >= slot.count

              return (
                <View key={slot.role} style={{ backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}>
                  {/* Section header */}
                  <View style={{ backgroundColor: '#f9fafb', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: '#374151', fontWeight: '700', fontSize: 13 }}>{slot.label}</Text>
                    <Text style={{ color: atCap ? '#dc2626' : '#9ca3af', fontSize: 12, fontWeight: '600' }}>
                      {chosen.length}/{slot.count}
                    </Text>
                  </View>

                  {players.length === 0 ? (
                    <View style={{ padding: 16, alignItems: 'center' }}>
                      <Text style={{ color: '#d1d5db', fontSize: 13 }}>No players available</Text>
                    </View>
                  ) : players.map((p, i) => {
                    const isSelected = chosen.includes(p.player_id) || selections.flex.includes(p.player_id)
                    const isDisabled = !isSelected && selections.flex.length >= 3 && chosen.length >= slot.count
                    const isExpanded = expandedModal.has(p.player_id)
                    const games = gamesForTeam(p.player_ipl_team)
                    return (
                      <View key={p.player_id} style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#f3f4f6', opacity: isDisabled ? 0.4 : 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isSelected ? '#fff5f5' : 'white' }}>
                          {/* Checkbox + player info — entire left area toggles selection */}
                          <TouchableOpacity
                            onPress={() => togglePlayer(slot.role, p.player_id, slot.count)}
                            disabled={isDisabled}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingVertical: 12 }}
                          >
                            <View style={{
                              width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                              borderColor: isSelected ? '#dc2626' : '#d1d5db',
                              backgroundColor: isSelected ? '#dc2626' : 'white',
                              alignItems: 'center', justifyContent: 'center',
                              marginRight: 12,
                            }}>
                              {isSelected && <Text style={{ color: 'white', fontSize: 13, fontWeight: '800', lineHeight: 16 }}>✓</Text>}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: '#111827', fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                                {p.player_name}
                              </Text>
                              <Text style={{ color: '#9ca3af', fontSize: 12 }}>{p.player_ipl_team}</Text>
                            </View>
                          </TouchableOpacity>
                          {/* Chevron — only toggles dropdown */}
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingRight: 14, paddingLeft: 8 }}
                            onPress={() => setExpandedModal(prev => { const s = new Set(prev); isExpanded ? s.delete(p.player_id) : s.add(p.player_id); return s })}
                          >
                            <View style={{ backgroundColor: games.length > 0 ? '#fee2e2' : '#f3f4f6', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginRight: 6 }}>
                              <Text style={{ color: games.length > 0 ? '#dc2626' : '#9ca3af', fontSize: 11, fontWeight: '700' }}>{games.length}</Text>
                            </View>
                            <Text style={{ color: '#d1d5db', fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</Text>
                          </TouchableOpacity>
                        </View>

                        {isExpanded && (
                          <View style={{ backgroundColor: '#f9fafb', paddingHorizontal: 14, paddingBottom: 14, paddingTop: 8, gap: 10 }}>
                            {games.length === 0 ? (
                              <Text style={{ color: '#d1d5db', fontSize: 12 }}>No games this week</Text>
                            ) : games.map(m => {
                              const opp = m.home_team === p.player_ipl_team ? m.away_team : m.home_team
                              const isHome = m.home_team === p.player_ipl_team
                              const statusColor = m.status === 'live' ? '#b45309' : m.status === 'completed' ? '#16a34a' : '#6b7280'
                              const statusBg = m.status === 'live' ? '#fef9c3' : m.status === 'completed' ? '#f0fdf4' : '#f3f4f6'
                              const statusLabel = m.status === 'live' ? 'LIVE' : m.status === 'completed' ? 'FINAL' : 'UPCOMING'
                              return (
                                <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                  <View style={{ backgroundColor: statusBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 }}>
                                    <Text style={{ color: statusColor, fontSize: 9, fontWeight: '700' }}>{statusLabel}</Text>
                                  </View>
                                  <Text style={{ color: '#374151', fontSize: 12, fontWeight: '500', flex: 1 }}>
                                    {isHome ? 'vs' : '@'} {opp}
                                  </Text>
                                  <Text style={{ color: '#9ca3af', fontSize: 11 }}>{formatMatchTime(m)}</Text>
                                </View>
                              )
                            })}
                          </View>
                        )}
                      </View>
                    )
                  })}
                </View>
              )
            })}
          </ScrollView>

          {/* Submit button */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
            {setLineupMutation.isError && (
              <Text style={{ color: '#dc2626', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
                {(setLineupMutation.error as Error)?.message ?? 'Failed to save lineup'}
              </Text>
            )}
            <TouchableOpacity
              onPress={submitLineup}
              disabled={setLineupMutation.isPending}
              style={{ backgroundColor: '#dc2626', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
            >
              {setLineupMutation.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>Save Lineup</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}
