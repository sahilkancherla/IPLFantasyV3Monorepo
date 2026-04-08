import { useRef, useState, useCallback, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, NativeSyntheticEvent, NativeScrollEvent } from 'react-native'
import { useUserLineup, useMatchupBreakdown } from '../../hooks/useLineup'
import { useWeekMatches } from '../../hooks/useMatchup'
import { PointsValue } from '../ui/PointsBreakdown'
import type { Matchup, IplWeek } from '../../hooks/useMatchup'
import { LineupCard, ROLE_ORDER, statLine } from './LineupCard'

const roleLabels: Record<string, string> = {
  batsman: 'BAT', bowler: 'BOW', all_rounder: 'AR', wicket_keeper: 'WK',
}

function sortByRole<T extends { slot_role?: string; playerRole?: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) =>
    (ROLE_ORDER[a.slot_role ?? a.playerRole ?? ''] ?? 5) -
    (ROLE_ORDER[b.slot_role ?? b.playerRole ?? ''] ?? 5)
  )
}

interface Props {
  matchup: Matchup
  week: IplWeek
  leagueId: string
  width: number
}

export function OtherMatchupDetail({ matchup, week, leagueId, width }: Props) {
  const homeName = matchup.home_full_name || matchup.home_username
  const awayName = matchup.away_full_name || matchup.away_username
  const homePts = parseFloat(String(matchup.home_points)) || 0
  const awayPts = parseFloat(String(matchup.away_points)) || 0
  const homeWon = matchup.is_final && matchup.winner_id === matchup.home_user
  const awayWon = matchup.is_final && matchup.winner_id === matchup.away_user
  const hasPoints = homePts > 0 || awayPts > 0 || matchup.is_final
  const isCompleted = matchup.is_final || new Date(week.end_date) < new Date()
  const isLive = !isCompleted && hasPoints

  const { data: weekMatches } = useWeekMatches(week.week_num)
  const gameListRef = useRef<ScrollView>(null)
  const [activeGameIndex, setActiveGameIndex] = useState(0)

  // Jump to live game on load
  useEffect(() => {
    if (!weekMatches || weekMatches.length === 0) return
    const liveIdx = weekMatches.findIndex(m => m.status === 'live')
    const upcomingIdx = weekMatches.findIndex(m => m.status === 'upcoming')
    const target = liveIdx >= 0 ? liveIdx : upcomingIdx >= 0 ? upcomingIdx : 0
    setActiveGameIndex(target)
    if (target > 0) {
      setTimeout(() => gameListRef.current?.scrollTo({ x: target * (width - 64), animated: false }), 50)
    }
  }, [weekMatches, week.status])

  const onGameScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (width - 64))
    setActiveGameIndex(idx)
  }, [width])

  const { data: homeLineupData } = useUserLineup(leagueId, matchup.home_user, week.week_num)
  const { data: awayLineupData } = useUserLineup(leagueId, matchup.away_user, week.week_num)
  const homeLineup = sortByRole(homeLineupData?.lineup ?? [])
  const awayLineup = sortByRole(awayLineupData?.lineup ?? [])

  const { data: breakdownData } = useMatchupBreakdown(
    leagueId, week.week_num, matchup.home_user, matchup.away_user
  )
  const breakdownByMatchId = new Map(
    (breakdownData?.games ?? []).map(g => [g.matchId, g])
  )

  const statusLabel = isCompleted ? 'FINAL' : isLive ? 'LIVE' : 'UPCOMING'
  const statusStyle = isCompleted
    ? { bg: '#f0fdf4', color: '#16a34a' }
    : isLive
    ? { bg: '#fef9c3', color: '#b45309' }
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
        </View>
        <View style={{ backgroundColor: statusStyle.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 }}>
          <Text style={{ color: statusStyle.color, fontSize: 11, fontWeight: '700' }}>{statusLabel}</Text>
        </View>
      </View>

      {/* Overview */}
      <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}>
        <View style={{ backgroundColor: '#1f2937', paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>Overview</Text>
        </View>
        <View style={{ padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <Text style={{ color: '#111827', fontWeight: '700', fontSize: 14, textAlign: 'center' }} numberOfLines={1}>
                {homeName}
              </Text>
              <Text style={{ color: homeWon ? '#16a34a' : '#dc2626', fontWeight: '800', fontSize: 40, lineHeight: 44 }}>
                {hasPoints ? homePts.toFixed(1) : '—'}
              </Text>
              <Text style={{ color: '#9ca3af', fontSize: 12 }}>pts</Text>
            </View>
            <View style={{ alignItems: 'center', paddingHorizontal: 16 }}>
              <Text style={{ color: '#d1d5db', fontWeight: '700', fontSize: 18 }}>VS</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <Text style={{ color: '#111827', fontWeight: '600', fontSize: 14, textAlign: 'center' }} numberOfLines={1}>
                {awayName}
              </Text>
              <Text style={{ color: awayWon ? '#16a34a' : '#374151', fontWeight: '800', fontSize: 40, lineHeight: 44 }}>
                {hasPoints ? awayPts.toFixed(1) : '—'}
              </Text>
              <Text style={{ color: '#9ca3af', fontSize: 12 }}>pts</Text>
            </View>
          </View>
        </View>
      </View>

      {/* IPL Games This Week — carousel */}
      <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}>
        <View style={{ backgroundColor: '#1f2937', paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>
            IPL Games This Week{weekMatches && weekMatches.length > 0 ? ` · ${weekMatches.length}` : ''}
          </Text>
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
            {/* Dot indicators */}
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

            {/* Carousel */}
            <ScrollView
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
                  : matchStatus === 'upcoming' ? '#dbeafe'
                  : '#f3f4f6'
                const statusColor = matchStatus === 'live' ? '#b45309'
                  : matchStatus === 'completed' ? '#16a34a'
                  : matchStatus === 'upcoming' ? '#1d4ed8'
                  : '#6b7280'
                const sLabel = matchStatus === 'live' ? 'LIVE'
                  : matchStatus === 'completed' ? 'FINAL'
                  : matchStatus === 'upcoming' ? 'NEXT'
                  : 'UPCOMING'
                const dateStr = item.start_time_utc
                  ? new Date(item.start_time_utc).toLocaleString('en-US', {
                      month: 'short', day: 'numeric',
                      hour: 'numeric', minute: '2-digit',
                      timeZoneName: 'short',
                    })
                  : item.match_date

                const breakdown = breakdownByMatchId.get(item.match_id)
                const homePlayers = sortByRole(breakdown?.myPlayers ?? [])
                const awayPlayers = sortByRole(breakdown?.oppPlayers ?? [])
                const hasPlayers = homePlayers.length > 0 || awayPlayers.length > 0

                return (
                  <View key={item.id} style={{ width: width - 64 }}>
                    <View style={{
                      backgroundColor: 'white', borderRadius: 14,
                      borderWidth: 1, borderColor: '#f3f4f6',
                      padding: 14, gap: 10,
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
                        ) : (
                          [
                            { players: homePlayers, label: homeName, labelColor: '#dc2626' },
                            { players: awayPlayers, label: awayName, labelColor: '#6b7280' },
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
                                    <PointsValue
                                      value={p.points}
                                      stats={{ ...p, playerRole: p.playerRole }}
                                      playerName={p.playerName}
                                      style={{ color: p.points > 0 ? '#16a34a' : '#9ca3af', fontSize: 12, fontWeight: '700' }}
                                    >
                                      {p.points > 0 ? `+${p.points.toFixed(1)}` : '—'}
                                    </PointsValue>
                                  </View>
                                  {(matchStatus === 'live' || matchStatus === 'completed') && statLine(p) !== '' && (
                                    <Text style={{ color: '#9ca3af', fontSize: 11 }}>{statLine(p)}</Text>
                                  )}
                                </View>
                              ))}
                            </View>
                          ))
                        )}
                      </View>
                    </View>
                  </View>
                )
              })}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Starting Lineups */}
      <View style={{ gap: 10 }}>
        <LineupCard
          title={homeName}
          lineup={homeLineup}
          emptyMessage="No lineup selected"
          weekMatches={weekMatches ?? []}
          breakdownByMatchId={breakdownByMatchId}
          getPlayerStats={(matchId, playerId) =>
            breakdownByMatchId.get(matchId)?.myPlayers.find(p => p.playerId === playerId)}
        />
        <LineupCard
          title={awayName}
          headerColor="#374151"
          lineup={awayLineup}
          emptyMessage="No lineup selected"
          weekMatches={weekMatches ?? []}
          breakdownByMatchId={breakdownByMatchId}
          getPlayerStats={(matchId, playerId) =>
            breakdownByMatchId.get(matchId)?.oppPlayers.find(p => p.playerId === playerId)}
        />
      </View>
    </ScrollView>
  )
}
