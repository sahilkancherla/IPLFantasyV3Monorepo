import { useEffect, useRef, useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, useWindowDimensions, ViewToken } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MatchupSlide } from './MatchupSlide'
import type { Matchup, IplWeek } from '../../hooks/useMatchup'
import { LoadingScreen } from '../ui/Loading'

interface Props {
  leagueId: string
  userId: string
  matchups: Matchup[]
  weeks: IplWeek[]
  currentWeekNum: number | null
  isLoading?: boolean
}

export function MatchupsTab({ leagueId, userId, matchups, weeks, currentWeekNum, isLoading }: Props) {
  const { width: screenWidth } = useWindowDimensions()
  const { bottom: bottomInset } = useSafeAreaInsets()
  const listRef = useRef<FlatList>(null)
  const [currentIndex, setCurrentIndex] = useState(0) // updated below once slides are known

  const myMatchups = matchups.filter(m => m.home_user === userId || m.away_user === userId)

  const slides = myMatchups
    .map(m => ({ matchup: m, week: weeks.find(w => w.week_num === m.week_num) ?? null }))
    .filter((s): s is { matchup: Matchup; week: IplWeek } => s.week !== null)
    .sort((a, b) => a.week.week_num - b.week.week_num)

  const targetIndex = currentWeekNum
    ? Math.max(0, slides.findIndex(s => s.week.week_num === currentWeekNum))
    : 0

  // Sync state if currentWeekNum or slides arrive after first render
  useEffect(() => {
    if (slides.length === 0) return
    setCurrentIndex(targetIndex)
  }, [targetIndex, slides.length])

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index)
    }
  }, [])

  const goTo = (index: number) => {
    if (index < 0 || index >= slides.length) return
    setCurrentIndex(index)
    listRef.current?.scrollToIndex({ index, animated: true })
  }

  if (isLoading) {
    return <LoadingScreen message="Loading schedule…" />
  }

  if (slides.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Text style={{ fontSize: 40 }}>📅</Text>
        <Text style={{ color: '#111827', fontSize: 17, fontWeight: '700' }}>No schedule yet</Text>
        <Text style={{ color: '#9ca3af', fontSize: 14 }}>Generate the schedule from the Admin tab</Text>
      </View>
    )
  }

  const isFirst = currentIndex === 0
  const isLast = currentIndex === slides.length - 1

  return (
    <View style={{ flex: 1 }}>
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
          />
        )}
      />

      {/* Navigation row */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 + bottomInset,
        borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: 'white',
      }}>
        <TouchableOpacity
          onPress={() => goTo(currentIndex - 1)}
          disabled={isFirst}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
            backgroundColor: isFirst ? '#f9fafb' : '#f3f4f6',
          }}
        >
          <Text style={{ color: isFirst ? '#d1d5db' : '#374151', fontWeight: '600', fontSize: 14 }}>← Prev</Text>
        </TouchableOpacity>

        <Text style={{ color: '#6b7280', fontSize: 13, fontWeight: '500' }}>
          Week {slides[currentIndex]?.week.week_num} of {slides[slides.length - 1]?.week.week_num}
        </Text>

        <TouchableOpacity
          onPress={() => goTo(currentIndex + 1)}
          disabled={isLast}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
            backgroundColor: isLast ? '#f9fafb' : '#f3f4f6',
          }}
        >
          <Text style={{ color: isLast ? '#d1d5db' : '#374151', fontWeight: '600', fontSize: 14 }}>Next →</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
