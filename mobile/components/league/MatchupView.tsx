// Shared display component for both "my matchup" and "other matchup" views.
// Handles the week header, score overview, IPL games carousel, and DualLineupCard.
// Data fetching stays in the parent (MatchupSlide / OtherMatchupDetail).

import { useRef, useState, useCallback, useEffect, ReactNode } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Animated, Easing, ActivityIndicator, NativeSyntheticEvent, NativeScrollEvent } from 'react-native'
import type { IplMatch, IplWeek } from '../../hooks/useMatchup'
import type { LineupEntry, GameBreakdownData, GamePlayer } from '../../hooks/useLineup'
import { DualLineupCard, statLine, ROLE_ORDER } from './LineupCard'
import type { BenchEntry } from './LineupCard'
import { PointsValue } from '../ui/PointsBreakdown'
import {
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, TEXT_PLACEHOLDER, TEXT_DISABLED,
  BORDER_DEFAULT, BORDER_MEDIUM,
  BG_CARD, BG_SUBTLE, BG_DARK_HEADER,
  PRIMARY, PRIMARY_SOFT, PRIMARY_SUBTLE,
  SUCCESS, SUCCESS_BG,
  WARNING, WARNING_DARK, WARNING_DARKER, WARNING_URGENT, WARNING_BG, WARNING_BORDER, WARNING_SUBTLE, WARNING_URGENT_BG, WARNING_URGENT_BORDER,
  INFO_DARK, INFO_SUBTLE,
  STATUS_LIVE_TEXT, STATUS_LIVE_BG, STATUS_COMPLETED_TEXT, STATUS_COMPLETED_BG,
  STATUS_UPCOMING_TEXT, STATUS_UPCOMING_BG, STATUS_PENDING_TEXT, STATUS_PENDING_BG,
  matchStatusColors,
} from '../../constants/colors'

const roleLabels: Record<string, string> = {
  batsman: 'BAT', bowler: 'BOW', all_rounder: 'AR', wicket_keeper: 'WK',
}

function sortByRole<T extends { slot_role?: string; playerRole?: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) =>
    (ROLE_ORDER[a.slot_role ?? a.playerRole ?? ''] ?? 5) -
    (ROLE_ORDER[b.slot_role ?? b.playerRole ?? ''] ?? 5)
  )
}

function formatWeekDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function useCountdown(lockTime: string) {
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, new Date(lockTime).getTime() - Date.now()))
  useEffect(() => {
    if (timeLeft <= 0) return
    const id = setInterval(() => {
      setTimeLeft(Math.max(0, new Date(lockTime).getTime() - Date.now()))
    }, 1000)
    return () => clearInterval(id)
  }, [lockTime])
  return timeLeft
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Locked'
  const totalSecs = Math.floor(ms / 1000)
  const d = Math.floor(totalSecs / 86400)
  const h = Math.floor((totalSecs % 86400) / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

function LineupWarningBanner({ lockTime, onSetLineup }: { lockTime: string; onSetLineup: () => void }) {
  const timeLeft = useCountdown(lockTime)
  const countdown = formatCountdown(timeLeft)
  const urgent = timeLeft < 60 * 60 * 1000 // < 1 hour

  return (
    <View style={{
      backgroundColor: urgent ? WARNING_URGENT_BG : WARNING_SUBTLE,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: urgent ? WARNING_URGENT_BORDER : WARNING_BORDER,
      padding: 14,
      gap: 10,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ backgroundColor: urgent ? WARNING_URGENT : WARNING, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
          <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>LINEUP NOT SET</Text>
        </View>
        <Text style={{ color: urgent ? '#9a3412' : WARNING_DARKER, fontSize: 12, fontWeight: '600' }}>
          Locks in {countdown}
        </Text>
      </View>
      <Text style={{ color: urgent ? '#9a3412' : '#78350f', fontSize: 13 }}>
        You haven't set your lineup for this week. Set it before the lock time to earn points.
      </Text>
      <TouchableOpacity
        onPress={onSetLineup}
        style={{ backgroundColor: urgent ? WARNING_URGENT : WARNING, borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}
      >
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Set Lineup</Text>
      </TouchableOpacity>
    </View>
  )
}

// ── Game card content (shared between measurement layer and live carousel) ────

interface GameCardProps {
  item: IplMatch
  myName: string
  oppName: string
  myPlayers: GamePlayer[]
  oppPlayers: GamePlayer[]
}

function GameCard({ item, myName, oppName, myPlayers, oppPlayers }: GameCardProps) {
  const matchStatus = item.status
  const { bg: statusBg, text: statusColor } = matchStatusColors(matchStatus)
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
  const hasPlayers = myPlayers.length > 0 || oppPlayers.length > 0

  return (
    <View style={{ backgroundColor: BG_CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER_DEFAULT, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ backgroundColor: statusBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
          <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700' }}>{sLabel}</Text>
        </View>
        {item.match_number != null && (
          <Text style={{ color: TEXT_DISABLED, fontSize: 11 }}>Match {item.match_number}</Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ flex: 1, color: TEXT_PRIMARY, fontWeight: '700', fontSize: 13, textAlign: 'center' }} numberOfLines={2}>
          {item.home_team}
        </Text>
        <Text style={{ color: TEXT_DISABLED, fontWeight: '700', fontSize: 12 }}>vs</Text>
        <Text style={{ flex: 1, color: TEXT_PRIMARY, fontWeight: '700', fontSize: 13, textAlign: 'center' }} numberOfLines={2}>
          {item.away_team}
        </Text>
      </View>
      <View style={{ gap: 2 }}>
        <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, textAlign: 'center' }}>{dateStr}</Text>
        {item.venue != null && (
          <Text style={{ color: TEXT_DISABLED, fontSize: 10, textAlign: 'center' }} numberOfLines={1}>
            {item.venue}
          </Text>
        )}
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: BORDER_DEFAULT, paddingTop: 10, gap: 10 }}>
        {!hasPlayers ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }}>
            <Text style={{ color: TEXT_DISABLED, fontSize: 12 }}>No players in this game</Text>
          </View>
        ) : (
          [
            { players: myPlayers, label: myName, labelColor: PRIMARY },
            { players: oppPlayers, label: oppName, labelColor: TEXT_MUTED },
          ].map(({ players, label, labelColor }) => players.length > 0 && (
            <View key={label} style={{ gap: 6 }}>
              <Text style={{ color: labelColor, fontSize: 10, fontWeight: '700' }}>{label}</Text>
              {players.map(p => (
                <View key={p.playerId} style={{ gap: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: TEXT_MUTED, fontSize: 10, fontWeight: '700', width: 28 }}>
                      {roleLabels[p.playerRole] ?? p.playerRole}
                    </Text>
                    <Text style={{ flex: 1, color: TEXT_PRIMARY, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                      {p.playerName}
                    </Text>
                    <PointsValue
                      value={p.points}
                      stats={{ ...p, playerRole: p.playerRole }}
                      playerName={p.playerName}
                      style={{ color: p.points > 0 ? SUCCESS : TEXT_PLACEHOLDER, fontSize: 12, fontWeight: '700' }}
                    >
                      {p.points > 0 ? `+${Math.round(p.points)}` : '—'}
                    </PointsValue>
                  </View>
                  {(matchStatus === 'live' || matchStatus === 'completed') && statLine(p) !== '' && (
                    <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11 }}>{statLine(p)}</Text>
                  )}
                </View>
              ))}
            </View>
          ))
        )}
      </View>
    </View>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export interface MatchupViewProps {
  week: IplWeek
  myName: string
  myUsername?: string
  oppName: string
  oppUsername?: string
  myPoints: number | string
  oppPoints: number | string
  /** null = no badge shown (observer view). 'WIN'/'LOSS'/'TIE' from the perspective of myName. */
  result: 'WIN' | 'LOSS' | 'TIE' | null
  isCompleted: boolean
  isLive: boolean
  myLineup: LineupEntry[]
  oppLineup: LineupEntry[]
  /** undefined = hide lock time; false = unlocked (show it); true = locked (hide it) */
  lineupLocked?: boolean
  /** Rendered in the DualLineupCard header (e.g. Set/Edit button) */
  lineupHeaderAction?: ReactNode
  weekMatches: IplMatch[] | undefined
  breakdownByMatchId: Map<string, GameBreakdownData>
  getMyPlayerStats: (matchId: string, playerId: string) => GamePlayer | undefined
  getOppPlayerStats: (matchId: string, playerId: string) => GamePlayer | undefined
  myBench?: BenchEntry[]
  oppBench?: BenchEntry[]
  myOverridePoints?: number | null
  myOverrideNote?: string | null
  oppOverridePoints?: number | null
  oppOverrideNote?: string | null
  width: number
  refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl']
  /** If provided, shows an Expand button in the IPL Games header */
  onExpandGames?: () => void
  /** Bump this key to reset the carousel (e.g. after lineup modal dismisses) */
  carouselKey?: number
  /** Called when the "Set Lineup" button in the warning banner is tapped */
  onSetLineup?: () => void
  /** True while the user's lineup query is still loading — hides "Lineup not set" affordances */
  myLineupLoading?: boolean
  /** True while the opponent's lineup query is still loading */
  oppLineupLoading?: boolean
}

export function MatchupView({
  week, myName, myUsername, oppName, oppUsername, myPoints, oppPoints, result,
  isCompleted, isLive,
  myLineup, oppLineup, lineupLocked, lineupHeaderAction,
  weekMatches, breakdownByMatchId, getMyPlayerStats, getOppPlayerStats,
  myBench, oppBench,
  myOverridePoints, myOverrideNote, oppOverridePoints, oppOverrideNote,
  width, refreshControl, onExpandGames, carouselKey = 0, onSetLineup,
  myLineupLoading, oppLineupLoading,
}: MatchupViewProps) {
  const showLineupWarning = !isCompleted && lineupLocked === false && !myLineupLoading && myLineup.length === 0 && !!onSetLineup
  const isPending = !isCompleted && !isLive
  const [activeGameIndex, setActiveGameIndex] = useState(0)
  const gameListRef = useRef<ScrollView>(null)
  const [cardHeights, setCardHeights] = useState<Record<number, number>>({})
  // carouselReady gates between spinner and the Animated.View.
  // The Animated.View is only mounted after the first height is known, so it
  // appears at the correct height immediately (no 0→h animation on first load).
  const [carouselReady, setCarouselReady] = useState(false)
  const carouselHeight = useRef(new Animated.Value(0)).current
  const carouselInitialized = useRef(false)

  useEffect(() => {
    const h = cardHeights[activeGameIndex]
    if (!h) return
    if (!carouselInitialized.current) {
      // Set the Animated.Value before carouselReady → true so the Animated.View
      // mounts already at the correct height (freshly-mounted views read the
      // current value, not a transition from 0).
      carouselHeight.setValue(h)
      carouselInitialized.current = true
      setCarouselReady(true)
      return
    }
    Animated.timing(carouselHeight, {
      toValue: h,
      duration: 220,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start()
  }, [activeGameIndex, cardHeights])

  const targetGameIndex = useCallback((matches: IplMatch[]) => {
    const liveIdx = matches.findIndex(m => m.status === 'live')
    const upcomingIdx = matches.findIndex(m => m.status === 'upcoming')
    return liveIdx >= 0 ? liveIdx : upcomingIdx >= 0 ? upcomingIdx : 0
  }, [])

  useEffect(() => {
    if (!weekMatches || weekMatches.length === 0) return
    const target = targetGameIndex(weekMatches)
    setActiveGameIndex(target)
    // If carousel is already mounted (data arrived after first render), scroll now.
    // If not mounted yet, contentOffset on the ScrollView will handle the initial position.
    if (carouselReady && target > 0) {
      setTimeout(() => gameListRef.current?.scrollTo({ x: target * (width - 64), animated: false }), 50)
    }
  }, [weekMatches, week.status])

  // When the carousel first becomes ready, ensure it's at the correct position.
  // This handles the case where weekMatches was cached and activeGameIndex was
  // already set before the ScrollView mounted.
  useEffect(() => {
    if (!carouselReady || activeGameIndex === 0) return
    setTimeout(() => gameListRef.current?.scrollTo({ x: activeGameIndex * (width - 64), animated: false }), 50)
  }, [carouselReady])

  const onGameScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (width - 64))
    setActiveGameIndex(idx)
  }, [width])

  const statusLabel = isPending ? 'UPCOMING' : isLive ? 'LIVE' : 'FINAL'
  const statusStyle = isPending
    ? { bg: STATUS_PENDING_BG, color: STATUS_PENDING_TEXT }
    : isLive
    ? { bg: STATUS_LIVE_BG, color: STATUS_LIVE_TEXT }
    : { bg: STATUS_COMPLETED_BG, color: STATUS_COMPLETED_TEXT }
  const resultStyle = result === 'WIN'
    ? { bg: '#d1fae5', color: SUCCESS }
    : result === 'LOSS'
    ? { bg: PRIMARY_SUBTLE, color: PRIMARY }
    : { bg: BG_SUBTLE, color: TEXT_MUTED }

  // Build per-card props once so both the measurement layer and carousel share
  // the same derived data without duplicating the derivation logic.
  const cardProps = weekMatches?.map(item => {
    const bd = breakdownByMatchId.get(item.match_id)
    return {
      item,
      myPlayers: sortByRole((bd?.myPlayers ?? []).filter(p => p.slotRole !== 'bench')),
      oppPlayers: sortByRole((bd?.oppPlayers ?? []).filter(p => p.slotRole !== 'bench')),
    }
  }) ?? []

  const recordHeight = (idx: number) => (e: { nativeEvent: { layout: { height: number } } }) => {
    const h = e.nativeEvent.layout.height
    setCardHeights(prev => prev[idx] === h ? prev : { ...prev, [idx]: h })
  }

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 14 }}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {/* Week header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 17 }} numberOfLines={1}>
            {week.label}
          </Text>
          <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 12, marginTop: 2 }}>
            {formatWeekDate(week.window_start)} – {formatWeekDate(week.window_end)}
          </Text>
        </View>
        <View style={{ backgroundColor: statusStyle.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 }}>
          <Text style={{ color: statusStyle.color, fontSize: 11, fontWeight: '700' }}>{statusLabel}</Text>
        </View>
      </View>

      {/* Lineup warning banner */}
      {showLineupWarning && (
        <LineupWarningBanner lockTime={week.lock_time} onSetLineup={onSetLineup!} />
      )}

      {/* Score overview */}
      <View style={{ backgroundColor: BG_CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER_DEFAULT, overflow: 'hidden' }}>
        <View style={{ backgroundColor: BG_DARK_HEADER, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>Overview</Text>
          {result && (
            <View style={{ backgroundColor: resultStyle.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: resultStyle.color, fontSize: 11, fontWeight: '700' }}>{result}</Text>
            </View>
          )}
        </View>
        <View style={{ padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ alignItems: 'center', gap: 1, alignSelf: 'stretch' }}>
                <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 14, textAlign: 'center' }}>
                  {myName}
                </Text>
                <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, textAlign: 'center' }}>{myUsername || ' '}</Text>
              </View>
              <Text style={{ color: result === null ? TEXT_SECONDARY : PRIMARY, fontWeight: '800', fontSize: 40, lineHeight: 44, marginTop: 'auto' }}>
                {Math.round(Number(myPoints))}
              </Text>
              <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 12, marginTop: 6 }}>pts</Text>
            </View>
            <View style={{ alignSelf: 'center', alignItems: 'center', paddingHorizontal: 16 }}>
              <Text style={{ color: TEXT_DISABLED, fontWeight: '700', fontSize: 18 }}>VS</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ alignItems: 'center', gap: 1, alignSelf: 'stretch' }}>
                <Text style={{ color: TEXT_PRIMARY, fontWeight: '600', fontSize: 14, textAlign: 'center' }}>
                  {oppName}
                </Text>
                <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, textAlign: 'center' }}>{oppUsername || ' '}</Text>
              </View>
              <Text style={{ color: TEXT_SECONDARY, fontWeight: '800', fontSize: 40, lineHeight: 44, marginTop: 'auto' }}>
                {Math.round(Number(oppPoints))}
              </Text>
              <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 12, marginTop: 6 }}>pts</Text>
            </View>
          </View>
        </View>
      </View>

      {/* IPL Games carousel */}
      <View style={{ backgroundColor: BG_CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER_DEFAULT, overflow: 'hidden' }}>
        <View style={{ backgroundColor: BG_DARK_HEADER, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>
            IPL Games This Week{weekMatches && weekMatches.length > 0 ? ` · ${weekMatches.length}` : ''}
          </Text>
          {onExpandGames && weekMatches && weekMatches.length > 0 && (
            <TouchableOpacity
              onPress={onExpandGames}
              style={{ backgroundColor: PRIMARY, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}
            >
              <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>Expand</Text>
            </TouchableOpacity>
          )}
        </View>
        {!weekMatches ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: TEXT_DISABLED, fontSize: 13 }}>Loading…</Text>
          </View>
        ) : weekMatches.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: TEXT_DISABLED, fontSize: 13 }}>No games scheduled this week</Text>
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
                      backgroundColor: i === activeGameIndex ? PRIMARY : BORDER_MEDIUM,
                    }} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Hidden measurement layer — absolutely positioned so it doesn't
                affect layout. Cards measure their natural heights here, then
                the Animated.View mounts already at the correct height. */}
            {!carouselReady && (
              <View style={{ position: 'absolute', opacity: 0, width: width - 64 }} pointerEvents="none">
                {cardProps.map(({ item, myPlayers, oppPlayers }, idx) => (
                  <View key={item.id} style={{ width: width - 64 }} onLayout={recordHeight(idx)}>
                    <GameCard item={item} myName={myName} oppName={oppName} myPlayers={myPlayers} oppPlayers={oppPlayers} />
                  </View>
                ))}
              </View>
            )}

            {!carouselReady ? (
              <View style={{ height: 80, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={PRIMARY} />
              </View>
            ) : (
              <Animated.View style={{ height: carouselHeight, overflow: 'hidden' }}>
                <ScrollView
                  key={carouselKey}
                  ref={gameListRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  scrollEventThrottle={16}
                  onScroll={onGameScroll}
                  style={{ width: width - 64 }}
                  contentContainerStyle={{ alignItems: 'flex-start' }}
                >
                  {cardProps.map(({ item, myPlayers, oppPlayers }, idx) => (
                    <View key={item.id} style={{ width: width - 64 }} onLayout={recordHeight(idx)}>
                      <GameCard item={item} myName={myName} oppName={oppName} myPlayers={myPlayers} oppPlayers={oppPlayers} />
                    </View>
                  ))}
                </ScrollView>
              </Animated.View>
            )}
          </View>
        )}
      </View>

      {/* Lineup lock time — only shown when lineupLocked is explicitly false */}
      {lineupLocked === false && !myLineupLoading && (
        <View style={{ backgroundColor: BG_CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER_DEFAULT, padding: 14, alignItems: 'center' }}>
          <Text style={{ color: TEXT_MUTED, fontSize: 13 }}>
            Lineups lock {new Date(week.lock_time).toLocaleString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric',
              hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
            })}
          </Text>
        </View>
      )}

      {/* Starting lineups */}
      <DualLineupCard
        myName={myName}
        myLineup={myLineup}
        myHeaderAction={lineupHeaderAction}
        oppName={oppName}
        oppLineup={oppLineup}
        myBench={myBench}
        oppBench={oppBench}
        weekMatches={weekMatches ?? []}
        breakdownByMatchId={breakdownByMatchId}
        getMyPlayerStats={getMyPlayerStats}
        getOppPlayerStats={getOppPlayerStats}
        myOverridePoints={myOverridePoints}
        myOverrideNote={myOverrideNote}
        oppOverridePoints={oppOverridePoints}
        oppOverrideNote={oppOverrideNote}
        myLineupLoading={myLineupLoading}
        oppLineupLoading={oppLineupLoading}
      />
    </ScrollView>
  )
}
