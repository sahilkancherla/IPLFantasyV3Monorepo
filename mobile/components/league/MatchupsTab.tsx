import { useEffect, useRef, useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, useWindowDimensions, ViewToken, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MatchupSlide } from './MatchupSlide'
import { OtherMatchupDetail } from './OtherMatchupDetail'
import type { Matchup, IplWeek } from '../../hooks/useMatchup'
import {
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, TEXT_PLACEHOLDER, TEXT_DISABLED,
  BORDER_DEFAULT, BORDER_MEDIUM,
  BG_PAGE, BG_CARD, BG_SUBTLE,
  PRIMARY, PRIMARY_SOFT, PRIMARY_TINT,
} from '../../constants/colors'

interface Props {
  leagueId: string
  userId: string
  matchups: Matchup[]
  weeks: IplWeek[]
  currentWeekNum: number | null
  isLoading?: boolean
  overrides?: Array<{ user_id: string; week_num: number; points: number; note: string | null }>
  onRefreshMatchups?: () => void
}

// ── Small card in the horizontal strip ───────────────────────────────────────

function MatchupChip({
  matchup,
  userId,
  selected,
  onPress,
}: {
  matchup: Matchup
  userId: string
  selected: boolean
  onPress: () => void
}) {
  const isMine = matchup.home_user === userId || matchup.away_user === userId
  const leftFirst = matchup.home_team_name || (matchup.home_full_name || matchup.home_username).split(' ')[0]
  const rightFirst = matchup.away_team_name || (matchup.away_full_name || matchup.away_username).split(' ')[0]

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        marginRight: 10,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 14,
        borderWidth: selected ? 2 : 1.5,
        borderColor: selected ? PRIMARY_SOFT : BORDER_MEDIUM,
        backgroundColor: selected ? PRIMARY_TINT : BG_CARD,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
      }}
    >
      {isMine && (
        <Text style={{ fontSize: 9, fontWeight: '700', color: PRIMARY_SOFT, letterSpacing: 0.4 }}>
          YOUR MATCHUP
        </Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'center', width: 58 }} numberOfLines={2}>
          {leftFirst}
        </Text>
        <Text style={{ fontSize: 10, color: TEXT_PLACEHOLDER }}>vs</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'center', width: 58 }} numberOfLines={2}>
          {rightFirst}
        </Text>
      </View>
      {(() => {
        const hp = parseFloat(String(matchup.home_points)) || 0
        const ap = parseFloat(String(matchup.away_points)) || 0
        return (hp > 0 || ap > 0 || matchup.is_final || !isMine) ? (
          <Text style={{ fontSize: 10, color: TEXT_MUTED, textAlign: 'center' }}>
            {Math.round(hp)}–{Math.round(ap)}
          </Text>
        ) : null
      })()}
    </TouchableOpacity>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function MatchupsTab({ leagueId, userId, matchups, weeks, currentWeekNum, isLoading, overrides, onRefreshMatchups }: Props) {
  const { width: screenWidth } = useWindowDimensions()
  const { bottom: bottomInset } = useSafeAreaInsets()
  const listRef = useRef<FlatList>(null)
  const stripRef = useRef<ScrollView>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  // null = viewing own matchup; non-null = viewing another matchup's detail
  const [viewingOther, setViewingOther] = useState<{ matchup: Matchup; week: IplWeek } | null>(null)

  const myMatchups = matchups.filter(m => m.home_user === userId || m.away_user === userId)

  const slides = myMatchups
    .map(m => ({ matchup: m, week: weeks.find(w => w.week_num === m.week_num) ?? null }))
    .filter((s): s is { matchup: Matchup; week: IplWeek } => s.week !== null)
    .sort((a, b) => a.week.week_num - b.week.week_num)

  const targetIndex = currentWeekNum
    ? Math.max(0, slides.findIndex(s => s.week.week_num === currentWeekNum))
    : 0

  // Sync to current week when data arrives
  useEffect(() => {
    if (slides.length === 0) return
    setCurrentIndex(targetIndex)
  }, [targetIndex, slides.length])

  // Clear "viewing other" when week changes (prev/next navigation)
  useEffect(() => {
    setViewingOther(null)
  }, [currentIndex])

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index)
    }
  }, [])

  const goTo = (index: number) => {
    if (index < 0 || index >= slides.length) return
    setViewingOther(null)
    setCurrentIndex(index)
    listRef.current?.scrollToIndex({ index, animated: true })
  }

  // All matchups for the week currently on screen, own matchup always first
  const visibleWeekNum = slides[currentIndex]?.week.week_num ?? null
  const weekAllMatchups = visibleWeekNum
    ? matchups
        .filter(m => m.week_num === visibleWeekNum)
        .sort((a, b) => {
          const aIsMine = a.home_user === userId || a.away_user === userId ? 0 : 1
          const bIsMine = b.home_user === userId || b.away_user === userId ? 0 : 1
          return aIsMine - bIsMine
        })
    : []

  if (isLoading) {
    return (
      <View style={{ flex: 1 }}>
        {/* Skeleton strip */}
        <View style={{ paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT, backgroundColor: BG_CARD, flexDirection: 'row', paddingHorizontal: 16, gap: 10 }}>
          {[0, 1, 2].map(i => (
            <View key={i} style={{ width: 130, height: 60, borderRadius: 14, backgroundColor: BG_SUBTLE }} />
          ))}
        </View>
        {/* Skeleton content */}
        <View style={{ flex: 1, padding: 20, gap: 14 }}>
          <View style={{ height: 28, width: 160, borderRadius: 8, backgroundColor: BG_SUBTLE }} />
          <View style={{ height: 140, borderRadius: 16, backgroundColor: BG_SUBTLE }} />
          <View style={{ height: 80, borderRadius: 16, backgroundColor: BG_SUBTLE }} />
          <View style={{ height: 200, borderRadius: 16, backgroundColor: BG_SUBTLE }} />
        </View>
        {/* Skeleton nav */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: BORDER_DEFAULT, backgroundColor: BG_CARD, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 8 }}>
          <View style={{ width: 80, height: 36, borderRadius: 20, backgroundColor: BG_SUBTLE }} />
          <View style={{ width: 80, height: 20, borderRadius: 8, backgroundColor: BG_SUBTLE }} />
          <View style={{ width: 80, height: 36, borderRadius: 20, backgroundColor: BG_SUBTLE }} />
        </View>
      </View>
    )
  }

  if (slides.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Text style={{ fontSize: 40 }}>📅</Text>
        <Text style={{ color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' }}>No schedule yet</Text>
        <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 14 }}>Generate the schedule from the Admin tab</Text>
      </View>
    )
  }

  const isFirst = currentIndex === 0
  const isLast = currentIndex === slides.length - 1

  return (
    <View style={{ flex: 1 }}>
      {/* ── Horizontal matchup strip ── */}
      {weekAllMatchups.length > 0 && (
        <View style={{ paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT, backgroundColor: BG_CARD }}>
          <ScrollView
            ref={stripRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingRight: 20 }}
          >
            {weekAllMatchups.map(m => {
              const isMine = m.home_user === userId || m.away_user === userId
              const isSelected = viewingOther ? viewingOther.matchup.id === m.id : isMine
              return (
                <MatchupChip
                  key={m.id}
                  matchup={m}
                  userId={userId}
                  selected={isSelected}
                  onPress={() => {
                    if (isMine) {
                      setViewingOther(null) // switch back to own matchup
                    } else {
                      const week = weeks.find(w => w.week_num === m.week_num)
                      if (week) setViewingOther({ matchup: m, week })
                    }
                  }}
                />
              )
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Content area: own matchup FlatList or other matchup detail ── */}
      {viewingOther ? (
        <OtherMatchupDetail
          matchup={viewingOther.matchup}
          week={viewingOther.week}
          leagueId={leagueId}
          width={screenWidth}
        />
      ) : (
        <FlatList
          ref={listRef}
          data={slides}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          keyExtractor={s => String(s.week.week_num)}
          getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
          initialScrollIndex={targetIndex}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          renderItem={({ item }) => (
            <MatchupSlide
              matchup={item.matchup}
              week={item.week}
              leagueId={leagueId}
              userId={userId}
              width={screenWidth}
              overrides={overrides}
              onRefreshMatchups={onRefreshMatchups}
            />
          )}
        />
      )}

      {/* ── Navigation row ── */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 + bottomInset,
        borderTopWidth: 1, borderTopColor: BORDER_DEFAULT, backgroundColor: BG_CARD,
        shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.06, shadowRadius: 6,
        elevation: 8,
      }}>
        <TouchableOpacity
          onPress={() => goTo(currentIndex - 1)}
          disabled={isFirst}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
            backgroundColor: isFirst ? BG_PAGE : BG_SUBTLE,
          }}
        >
          <Text style={{ color: isFirst ? TEXT_DISABLED : TEXT_SECONDARY, fontWeight: '600', fontSize: 14 }}>← Prev</Text>
        </TouchableOpacity>

        <Text style={{ color: TEXT_MUTED, fontSize: 13, fontWeight: '500' }}>
          Week {slides[currentIndex]?.week.week_num} of {slides[slides.length - 1]?.week.week_num}
        </Text>

        <TouchableOpacity
          onPress={() => goTo(currentIndex + 1)}
          disabled={isLast}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
            backgroundColor: isLast ? BG_PAGE : BG_SUBTLE,
          }}
        >
          <Text style={{ color: isLast ? TEXT_DISABLED : TEXT_SECONDARY, fontWeight: '600', fontSize: 14 }}>Next →</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
