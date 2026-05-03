import { View, Text, FlatList, RefreshControl } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Avatar } from '../../../components/ui/Avatar'
import { useLeaderboard } from '../../../hooks/useTeam'
import { useAuthStore } from '../../../stores/authStore'
import { LoadingScreen } from '../../../components/ui/Loading'
import {
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, TEXT_PLACEHOLDER, TEXT_DISABLED,
  BORDER_DEFAULT, BG_PAGE, BG_CARD, PRIMARY, PRIMARY_BG, PRIMARY_SOFT,
} from '../../../constants/colors'

const medals = ['🥇', '🥈', '🥉']

export default function LeaderboardScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>()
  const { user } = useAuthStore()
  const { data: leaderboard, isLoading, refetch, isRefetching } = useLeaderboard(leagueId!)

  if (isLoading) {
    return <LoadingScreen message="Loading leaderboard…" />
  }

  // Sort by wins desc, then total_points desc as tiebreaker
  const sorted = [...(leaderboard ?? [])].sort((a, b) => {
    const winDiff = (b.wins ?? 0) - (a.wins ?? 0)
    if (winDiff !== 0) return winDiff
    return Number(b.total_points) - Number(a.total_points)
  })

  return (
    <View style={{ flex: 1, backgroundColor: BG_PAGE }}>
      {/* Table header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 10, paddingHorizontal: 16,
        backgroundColor: BG_PAGE, borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT,
      }}>
        <Text style={{ width: 28, color: TEXT_PLACEHOLDER, fontSize: 11, fontWeight: '700' }}>#</Text>
        <Text style={{ flex: 1, color: TEXT_PLACEHOLDER, fontSize: 11, fontWeight: '700' }}>TEAM</Text>
        <Text style={{ width: 26, color: TEXT_PLACEHOLDER, fontSize: 11, fontWeight: '700', textAlign: 'right' }}>W</Text>
        <Text style={{ width: 26, color: TEXT_PLACEHOLDER, fontSize: 11, fontWeight: '700', textAlign: 'right' }}>L</Text>
        <Text style={{ width: 52, color: TEXT_PLACEHOLDER, fontSize: 11, fontWeight: '700', textAlign: 'right' }}>PTS</Text>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.user_id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={PRIMARY_SOFT} />
        }
        contentContainerStyle={{ paddingVertical: 4 }}
        ListEmptyComponent={
          <View style={{ paddingVertical: 64, alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 40 }}>📊</Text>
            <Text style={{ color: TEXT_MUTED }}>No leaderboard data yet</Text>
            <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 13, textAlign: 'center' }}>
              Points will appear here once match scores are synced
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const isMe = item.user_id === user?.id
          const rank = index + 1

          return (
            <View
              style={{
                flexDirection: 'row', alignItems: 'center',
                paddingVertical: 12, paddingHorizontal: 16,
                borderTopWidth: index === 0 ? 0 : 1, borderTopColor: BG_PAGE,
                backgroundColor: isMe ? PRIMARY_BG : BG_CARD,
              }}
            >
              {/* Rank */}
              <View style={{ width: 28 }}>
                {rank <= 3 ? (
                  <Text style={{ fontSize: 16 }}>{medals[rank - 1]}</Text>
                ) : (
                  <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 13, fontWeight: '700' }}>
                    {rank}
                  </Text>
                )}
              </View>

              {/* Team */}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Avatar
                  uri={item.avatar_url}
                  name={item.team_name || item.display_name || item.username}
                  size={28}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                    {item.team_name || item.display_name || item.username}{isMe ? ' ★' : ''}
                  </Text>
                  {item.team_name && (
                    <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11 }} numberOfLines={1}>
                      {item.display_name ?? item.username}
                    </Text>
                  )}
                </View>
              </View>

              {/* W */}
              <Text style={{ width: 26, color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700', textAlign: 'right' }}>
                {item.wins ?? 0}
              </Text>

              {/* L */}
              <Text style={{ width: 26, color: TEXT_MUTED, fontSize: 13, textAlign: 'right' }}>
                {item.losses ?? 0}
              </Text>

              {/* PTS */}
              <Text style={{ width: 52, color: TEXT_PRIMARY, fontSize: 14, fontWeight: '700', textAlign: 'right' }}>
                {Math.round(Number(item.total_points))}
              </Text>
            </View>
          )
        }}
      />
    </View>
  )
}
