import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SquadGrid } from '../../../components/team/SquadGrid'
import { useMyTeam, useAllTeams } from '../../../hooks/useTeam'
import { useLeague } from '../../../hooks/useLeague'
import { useAuthStore } from '../../../stores/authStore'
import { formatCurrency } from '../../../lib/currency'

type Tab = 'my' | 'all'

export default function TeamScreen() {
  const { leagueId, tab: initialTab } = useLocalSearchParams<{ leagueId: string; tab?: string }>()
  const router = useRouter()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>(initialTab === 'all' ? 'all' : 'my')

  const { data: roster, isLoading: myLoading, refetch: refetchMy, isRefetching: myRefetching } = useMyTeam(leagueId!)
  const { data: allRosters, isLoading: allLoading, refetch: refetchAll, isRefetching: allRefetching } = useAllTeams(leagueId!)
  const { data: leagueData, refetch: refetchLeague, isRefetching: leagueRefetching } = useLeague(leagueId!)

  const league = leagueData?.league
  const members = leagueData?.members ?? []
  const myMember = members.find((m) => m.user_id === user?.id)
  const currency = league?.currency ?? 'lakhs'

  const isRefetching = myRefetching || allRefetching || leagueRefetching
  const refetch = () => { refetchMy(); refetchAll(); refetchLeague() }

  // Group all rosters by user_id
  const rostersByUser = (allRosters ?? []).reduce<Record<string, NonNullable<typeof allRosters>>>((acc, entry) => {
    if (!acc[entry.user_id]) acc[entry.user_id] = []
    acc[entry.user_id]!.push(entry)
    return acc
  }, {})

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#ef4444" />}
    >
      <View className="p-4 gap-4">
        {/* Tab switcher */}
        <View style={{ flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 12, padding: 4 }}>
          {(['my', 'all'] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setActiveTab(t)}
              style={{
                flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
                backgroundColor: activeTab === t ? '#ffffff' : 'transparent',
              }}
            >
              <Text style={{ fontWeight: '600', color: activeTab === t ? '#111827' : '#9ca3af', fontSize: 14 }}>
                {t === 'my' ? 'My Squad' : 'All Teams'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── My Squad ── */}
        {activeTab === 'my' && (
          <>
            {myMember && league && (
              <View className="bg-white rounded-2xl p-4 gap-1 border border-gray-100 shadow-sm">
                <Text className="text-gray-500 text-sm">Remaining Budget</Text>
                <Text className="text-gray-900 text-3xl font-bold">
                  {formatCurrency(myMember.remaining_budget, currency)}
                </Text>
                <Text className="text-gray-400 text-sm">
                  {myMember.roster_count} / {league.roster_size} players acquired
                </Text>
              </View>
            )}
            {myLoading ? (
              <Text className="text-gray-400 text-center py-8">Loading...</Text>
            ) : (
              <SquadGrid roster={roster ?? []} currency={currency} />
            )}
          </>
        )}

        {/* ── All Teams ── */}
        {activeTab === 'all' && (
          allLoading ? (
            <Text className="text-gray-400 text-center py-8">Loading...</Text>
          ) : (
            <>
              {members.map((member) => {
                const memberRoster = rostersByUser[member.user_id] ?? []
                const displayName = member.display_name ?? member.username
                const isMe = member.user_id === user?.id
                const memberInfo = members.find(m => m.user_id === member.user_id)

                return (
                  <View key={member.user_id} style={{ gap: 10 }}>
                    {/* Member header */}
                    <View className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm" style={{ gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#111827', fontWeight: '700', fontSize: 16 }}>
                          {displayName}{isMe ? ' (You)' : ''}
                        </Text>
                        <Text style={{ color: '#9ca3af', fontSize: 13 }}>
                          {memberRoster.length} players
                        </Text>
                      </View>
                      {memberInfo && league && (
                        <Text style={{ color: '#6b7280', fontSize: 13 }}>
                          {formatCurrency(memberInfo.remaining_budget, currency)} remaining
                        </Text>
                      )}
                    </View>

                    {memberRoster.length === 0 ? (
                      <View className="bg-white rounded-2xl p-6 items-center border border-gray-100">
                        <Text className="text-gray-400 text-sm">No players acquired</Text>
                      </View>
                    ) : (
                      <SquadGrid roster={memberRoster} currency={currency} />
                    )}
                  </View>
                )
              })}
            </>
          )
        )}
      </View>
    </ScrollView>
  )
}
