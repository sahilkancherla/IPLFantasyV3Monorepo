import { useState, useRef } from 'react'
import { View, Text, ScrollView, Alert, RefreshControl, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import { formatCurrency } from '../../../lib/currency'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { MemberList } from '../../../components/league/MemberList'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { useLeague, useLeaveLeague, useAdvanceLeagueStatus, useDeleteAuction, useDeleteLeague } from '../../../hooks/useLeague'
import { usePlayerInterests, useToggleInterest } from '../../../hooks/useAuctionInterests'
import { useAuthStore } from '../../../stores/authStore'
import { api } from '../../../lib/api'
import { useQuery } from '@tanstack/react-query'

const statusConfig: Record<string, { label: string; color: 'green' | 'yellow' | 'blue' | 'red' | 'gray' }> = {
  draft_pending:    { label: 'Draft Pending', color: 'gray' },
  draft_active:     { label: 'DRAFT LIVE', color: 'red' },
  league_active:    { label: 'Season Active', color: 'green' },
  league_complete:  { label: 'Complete', color: 'blue' },
}

interface PlayerRow {
  id: string
  name: string
  ipl_team: string
  role: string
  base_price: number
  nationality: string
}

const roleLabels: Record<string, string> = {
  batsman: 'BAT',
  bowler: 'BOW',
  all_rounder: 'AR',
  wicket_keeper: 'WK',
}

const wishlistRoleChips: { label: string; value: string | null }[] = [
  { label: 'All', value: null },
  { label: 'BAT', value: 'batsman' },
  { label: 'WK', value: 'wicket_keeper' },
  { label: 'AR', value: 'all_rounder' },
  { label: 'BOWL', value: 'bowler' },
]

const roleBadgeColors: Record<string, 'blue' | 'red' | 'green' | 'yellow'> = {
  batsman: 'blue',
  bowler: 'red',
  all_rounder: 'green',
  wicket_keeper: 'yellow',
}

export default function LeagueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuthStore()
  const { data, isLoading, refetch, isRefetching } = useLeague(id!)
  const leaveLeague = useLeaveLeague()
  const advanceStatus = useAdvanceLeagueStatus()
  const deleteAuction = useDeleteAuction()
  const deleteLeague = useDeleteLeague()
  const [playerSearch, setPlayerSearch] = useState('')
  const [playerRoleFilter, setPlayerRoleFilter] = useState<string | null>(null)
  const [playerTeamFilter, setPlayerTeamFilter] = useState<string | null>(null)
  const [allPlayersCollapsed, setAllPlayersCollapsed] = useState(false)
  const [interestedCollapsed, setInterestedCollapsed] = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  const [wishlistY, setWishlistY] = useState(0)

  const league = data?.league
  const members = data?.members ?? []
  const isAdmin = league?.admin_id === user?.id
  const statusInfo = league ? (statusConfig[league.status] ?? { label: league.status, color: 'gray' }) : null

  const isDraftPending = league?.status === 'draft_pending'
  const isDraftActive = league?.status === 'draft_active'
  const isActive = league?.status === 'league_active'
  const isComplete = league?.status === 'league_complete'

  const { data: playersData } = useQuery({
    queryKey: ['players-all'],
    queryFn: () => api.get<{ players: PlayerRow[] }>('/players'),
    enabled: isDraftPending,
    select: (d) => d.players,
  })
  const { data: interestData } = usePlayerInterests(isDraftPending ? id! : '')
  const toggleInterest = useToggleInterest(id!)

  const myInterests = new Set(interestData?.myInterests ?? [])
  const interestCounts = interestData?.counts ?? {}

  const filteredPlayers = (playersData ?? []).filter(p => {
    if (playerSearch.length > 0 &&
        !p.name.toLowerCase().includes(playerSearch.toLowerCase()) &&
        !p.ipl_team.toLowerCase().includes(playerSearch.toLowerCase())) return false
    if (playerRoleFilter && p.role !== playerRoleFilter) return false
    if (playerTeamFilter && p.ipl_team !== playerTeamFilter) return false
    return true
  })

  const interested = filteredPlayers.filter(p => myInterests.has(p.id))
  const others = filteredPlayers.filter(p => !myInterests.has(p.id))

  const renderPlayer = (item: PlayerRow, index: number, section: 'interested' | 'others') => {
    const isInterested = section === 'interested'
    const count = interestCounts[item.id] ?? 0
    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => toggleInterest.mutate(item.id)}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          paddingVertical: 12, paddingHorizontal: 16,
          borderTopWidth: index > 0 ? 1 : 0, borderTopColor: '#f3f4f6',
          backgroundColor: isInterested ? '#f0fdf4' : 'white',
        }}
      >
        <View style={{
          width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
          backgroundColor: isInterested ? '#16a34a' : '#f3f4f6',
          flexShrink: 0,
        }}>
          <Text style={{ fontSize: 13, color: isInterested ? 'white' : '#9ca3af' }}>
            {isInterested ? '★' : '☆'}
          </Text>
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: '#111827', fontWeight: '600', fontSize: 14 }}>{item.name}</Text>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <Text style={{ color: '#9ca3af', fontSize: 12 }}>{item.ipl_team}</Text>
            <Badge label={roleLabels[item.role] ?? item.role} color={roleBadgeColors[item.role] ?? 'gray'} />
            {item.nationality !== 'Indian' && <Badge label="OS" color="yellow" />}
            <Text style={{ color: '#9ca3af', fontSize: 12 }}>{formatCurrency(item.base_price, league!.currency)}</Text>
          </View>
        </View>

        {count > 1 && (
          <Text style={{ color: '#9ca3af', fontSize: 11 }}>{count} want</Text>
        )}
      </TouchableOpacity>
    )
  }

  const handleDeleteLeague = () => {
    Alert.alert(
      'Delete League',
      'This will permanently delete the league, all rosters, and all data. Every member will lose access. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete League',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLeague.mutateAsync(id!)
              router.replace('/(app)/home')
            } catch {
              Alert.alert('Error', 'Failed to delete league. Please try again.')
            }
          },
        },
      ]
    )
  }

  const handleDeleteAuction = () => {
    Alert.alert(
      'Reset Auction',
      'This will reset the draft and delete all rosters, bids, and matchups. Members will keep their spots but budgets will be restored. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAuction.mutateAsync(id!)
            } catch {
              Alert.alert('Error', 'Failed to delete auction. Please try again.')
            }
          },
        },
      ]
    )
  }

  const handleLeave = () => {
    Alert.alert('Leave League', 'Are you sure you want to leave this league?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await leaveLeague.mutateAsync(id!)
          router.replace('/(app)/home')
        },
      },
    ])
  }

  const handleStartDraft = () => {
    Alert.alert(
      'Start Draft',
      `Start the auction draft now? All ${members.length} member(s) currently in the league will participate.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Draft',
          onPress: () => advanceStatus.mutate({ leagueId: id!, status: 'draft_active' }),
        },
      ]
    )
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-400">Loading...</Text>
      </View>
    )
  }

  if (!league) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-red-500">League not found</Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollRef}
        className="flex-1 bg-gray-50"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#ef4444" />}
      >
        <View className="p-4 gap-4">
          {/* Header */}
          <View className="bg-white rounded-2xl p-4 gap-3 border border-gray-100 shadow-sm">
            <View className="flex-row items-start justify-between">
              <Text className="text-gray-900 text-2xl font-bold flex-1 mr-3">{league.name}</Text>
              {statusInfo && <Badge label={statusInfo.label} color={statusInfo.color} />}
            </View>

            <View className="flex-row gap-2 items-center">
              <Text className="text-gray-500 text-sm">Invite Code:</Text>
              <View className="bg-gray-100 rounded-lg px-3 py-1.5">
                <Text className="text-red-600 text-base font-mono font-bold tracking-widest">
                  {league.invite_code}
                </Text>
              </View>
            </View>

            <View className="flex-row flex-wrap gap-4">
              <View>
                <Text className="text-gray-400 text-xs">Budget</Text>
                <Text className="text-gray-900 font-medium">{formatCurrency(league.starting_budget, league.currency)}</Text>
              </View>
              <View>
                <Text className="text-gray-400 text-xs">Teams</Text>
                <Text className="text-gray-900 font-medium">{members.length}/{league.max_teams}</Text>
              </View>
              <View>
                <Text className="text-gray-400 text-xs">Roster Size</Text>
                <Text className="text-gray-900 font-medium">{league.roster_size}</Text>
              </View>
              <View>
                <Text className="text-gray-400 text-xs">Timer</Text>
                <Text className="text-gray-900 font-medium">{league.bid_timeout_secs}s</Text>
              </View>
            </View>
          </View>

          {/* Members */}
          <View className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <Text className="text-gray-900 font-bold text-lg mb-3">Members ({members.length})</Text>
            <MemberList
              members={members}
              adminId={league.admin_id}
              startingBudget={league.starting_budget}
              currency={league.currency}
            />
          </View>

          {/* Draft Wishlist card (draft_pending only) */}
          {isDraftPending && (
            <View
              onLayout={(e) => setWishlistY(e.nativeEvent.layout.y)}
              style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, overflow: 'hidden' }}
            >
              {/* Card header */}
              <View style={{ padding: 16, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, marginRight: 12, gap: 2 }}>
                    <Text style={{ color: '#111827', fontWeight: '700', fontSize: 17 }}>Draft Wishlist</Text>
                    <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                      Tap players you want — they'll be called up first in the draft.
                    </Text>
                  </View>
                  {myInterests.size > 0 && (
                    <View style={{ backgroundColor: '#16a34a', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, flexShrink: 0 }}>
                      <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>{myInterests.size} added</Text>
                    </View>
                  )}
                </View>
                <TextInput
                  value={playerSearch}
                  onChangeText={setPlayerSearch}
                  onFocus={() => scrollRef.current?.scrollTo({ y: wishlistY, animated: true })}
                  placeholder="Search by name or team..."
                  placeholderTextColor="#9ca3af"
                  style={{ backgroundColor: '#f3f4f6', color: '#111827', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, borderWidth: 1, borderColor: '#e5e7eb' }}
                />

                {/* Role filter chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row' }}>
                    {wishlistRoleChips.map(({ label, value }) => (
                      <TouchableOpacity
                        key={label}
                        onPress={() => setPlayerRoleFilter(value)}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: playerRoleFilter === value ? '#dc2626' : '#f3f4f6', borderWidth: 1, borderColor: playerRoleFilter === value ? '#dc2626' : '#e5e7eb', marginRight: 6 }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: playerRoleFilter === value ? '#ffffff' : '#6b7280' }}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Team filter chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity
                      onPress={() => setPlayerTeamFilter(null)}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: playerTeamFilter === null ? '#dc2626' : '#f3f4f6', borderWidth: 1, borderColor: playerTeamFilter === null ? '#dc2626' : '#e5e7eb', marginRight: 6 }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: playerTeamFilter === null ? '#ffffff' : '#6b7280' }}>All Teams</Text>
                    </TouchableOpacity>
                    {[...new Set((playersData ?? []).map(p => p.ipl_team))].sort().map(team => (
                      <TouchableOpacity
                        key={team}
                        onPress={() => setPlayerTeamFilter(team)}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: playerTeamFilter === team ? '#dc2626' : '#f3f4f6', borderWidth: 1, borderColor: playerTeamFilter === team ? '#dc2626' : '#e5e7eb', marginRight: 6 }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: playerTeamFilter === team ? '#ffffff' : '#6b7280' }}>{team}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Player content */}
              {!playersData ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Text style={{ color: '#9ca3af' }}>Loading players...</Text>
                </View>
              ) : filteredPlayers.length === 0 ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Text style={{ color: '#9ca3af' }}>No players found</Text>
                </View>
              ) : (
                <>
                  {/* Interested section */}
                  {interested.length > 0 && (
                    <>
                      <TouchableOpacity
                        onPress={() => setInterestedCollapsed(c => !c)}
                        activeOpacity={0.7}
                        style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6', borderBottomWidth: interestedCollapsed ? 0 : 1, borderBottomColor: '#bbf7d0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <Text style={{ color: '#16a34a', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
                          INTERESTED PLAYERS ({interested.length})
                        </Text>
                        <Text style={{ color: '#4ade80', fontSize: 12 }}>{interestedCollapsed ? '▼' : '▲'}</Text>
                      </TouchableOpacity>
                      {!interestedCollapsed && interested.map((p, i) => renderPlayer(p, i, 'interested'))}
                    </>
                  )}

                  {/* All players section */}
                  {others.length > 0 && (
                    <>
                      <TouchableOpacity
                        onPress={() => setAllPlayersCollapsed(c => !c)}
                        activeOpacity={0.7}
                        style={{ backgroundColor: '#f9fafb', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6', borderBottomWidth: allPlayersCollapsed ? 0 : 1, borderBottomColor: '#f3f4f6', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
                          ALL PLAYERS ({others.length})
                        </Text>
                        <Text style={{ color: '#9ca3af', fontSize: 12 }}>{allPlayersCollapsed ? '▼' : '▲'}</Text>
                      </TouchableOpacity>
                      {!allPlayersCollapsed && others.map((p, i) => renderPlayer(p, i, 'others'))}
                    </>
                  )}
                </>
              )}
            </View>
          )}

          {/* Navigation */}
          <View className="gap-2">
            {isDraftPending && isAdmin && (
              <Button
                label="Start Draft"
                variant="primary"
                size="lg"
                loading={advanceStatus.isPending}
                onPress={handleStartDraft}
              />
            )}

            {isDraftPending && !isAdmin && (
              <View className="bg-white rounded-xl p-3 items-center border border-gray-100">
                <Text className="text-gray-500 text-sm">Waiting for admin to start the draft...</Text>
              </View>
            )}

            {isDraftActive && (
              <Button
                label="Enter Draft Room"
                variant="primary"
                size="lg"
                onPress={() => router.push(`/(app)/auction/${id}`)}
              />
            )}

            {(isActive || isComplete) && (
              <>
                <Button label="My Squad" variant="primary" onPress={() => router.push(`/(app)/team/${id}`)} />
                <Button label="All Teams" variant="secondary" onPress={() => router.push(`/(app)/team/${id}?tab=all`)} />
              </>
            )}
          </View>

          {/* Leave */}
          {!isAdmin && (
            <Button label="Leave League" variant="danger" onPress={handleLeave} />
          )}

          {/* Delete Auction — admin only, only after draft has started */}
          {isAdmin && !isDraftPending && (
            <Button
              label="Reset Auction"
              variant="danger"
              loading={deleteAuction.isPending}
              onPress={handleDeleteAuction}
            />
          )}

          {/* Delete League — admin only */}
          {isAdmin && (
            <Button
              label="Delete League"
              variant="danger"
              loading={deleteLeague.isPending}
              onPress={handleDeleteLeague}
            />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
