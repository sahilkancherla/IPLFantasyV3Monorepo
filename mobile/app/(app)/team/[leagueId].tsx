import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Modal, FlatList, Alert, ActivityIndicator, TextInput } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { SquadGrid } from '../../../components/team/SquadGrid'
import { useMyTeam, useAllTeams, useDropPlayer, useAddPlayer, type RosterEntry } from '../../../hooks/useTeam'
import { useFreeAgents, type FreeAgent } from '../../../hooks/useWaivers'
import { useLeague } from '../../../hooks/useLeague'
import { useAuthStore } from '../../../stores/authStore'
import { formatCurrency } from '../../../lib/currency'

type Tab = 'my' | 'all'

const ROLE_LABELS: Record<string, string> = {
  batsman: 'BAT', bowler: 'BOW', all_rounder: 'AR', wicket_keeper: 'WK',
}
const ROLE_COLORS: Record<string, string> = {
  batsman: '#2563eb', bowler: '#dc2626', all_rounder: '#16a34a', wicket_keeper: '#d97706',
}

export default function TeamScreen() {
  const { leagueId, tab: initialTab } = useLocalSearchParams<{ leagueId: string; tab?: string }>()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>(initialTab === 'all' ? 'all' : 'my')

  const { data: roster, isLoading: myLoading, refetch: refetchMy, isRefetching: myRefetching } = useMyTeam(leagueId!)
  const { data: allRosters, isLoading: allLoading, refetch: refetchAll, isRefetching: allRefetching } = useAllTeams(leagueId!)
  const { data: leagueData, refetch: refetchLeague, isRefetching: leagueRefetching } = useLeague(leagueId!)
  const { data: freeAgents, isLoading: faLoading } = useFreeAgents(leagueId!)
  const dropPlayer = useDropPlayer(leagueId!)
  const addPlayer = useAddPlayer(leagueId!)

  const league = leagueData?.league
  const members = leagueData?.members ?? []
  const myMember = members.find((m) => m.user_id === user?.id)
  const currency = league?.currency ?? 'lakhs'

  const isRefetching = myRefetching || allRefetching || leagueRefetching
  const refetch = () => { refetchMy(); refetchAll(); refetchLeague() }

  const canAddDrop = true
  const currentRoster = roster ?? []
  const rosterFull = currentRoster.length >= (league?.roster_size ?? 16)

  // Group all rosters by user_id
  const rostersByUser = (allRosters ?? []).reduce<Record<string, NonNullable<typeof allRosters>>>((acc, entry) => {
    if (!acc[entry.user_id]) acc[entry.user_id] = []
    acc[entry.user_id]!.push(entry)
    return acc
  }, {})

  // --- Add player flow ---
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [selectedFreeAgent, setSelectedFreeAgent] = useState<FreeAgent | null>(null)
  // Drop picker (shown when roster is full)
  const [dropPickerVisible, setDropPickerVisible] = useState(false)

  const filteredFreeAgents = (freeAgents ?? []).filter(p =>
    p.name.toLowerCase().includes(searchText.toLowerCase()) ||
    p.ipl_team.toLowerCase().includes(searchText.toLowerCase())
  )

  const handleDropPlayer = (player: RosterEntry) => {
    Alert.alert(
      'Drop Player',
      `Drop ${player.player_name} from your squad?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Drop',
          style: 'destructive',
          onPress: async () => {
            try {
              await dropPlayer.mutateAsync(player.player_id)
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to drop player')
            }
          },
        },
      ]
    )
  }

  const handleSelectFreeAgent = (player: FreeAgent) => {
    setSelectedFreeAgent(player)
    setAddModalVisible(false)

    if (rosterFull) {
      // Need to drop someone first
      setDropPickerVisible(true)
    } else {
      // Add directly
      confirmAdd(player.id, undefined)
    }
  }

  const confirmAdd = async (playerId: string, dropPlayerId: string | undefined) => {
    try {
      await addPlayer.mutateAsync({ playerId, dropPlayerId })
      setSelectedFreeAgent(null)
      setDropPickerVisible(false)
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to add player')
    }
  }

  const handleDropAndAdd = (dropRosterEntry: RosterEntry) => {
    if (!selectedFreeAgent) return
    confirmAdd(selectedFreeAgent.id, dropRosterEntry.player_id)
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: '#f9fafb' }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#dc2626" />}
      >
        <View style={{ padding: 16, gap: 14 }}>
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
                <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', padding: 16, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={{ color: '#6b7280', fontSize: 13 }}>Remaining Budget</Text>
                      <Text style={{ color: '#111827', fontSize: 28, fontWeight: '800', marginTop: 2 }}>
                        {formatCurrency(myMember.remaining_budget, currency)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: '#9ca3af', fontSize: 13 }}>
                        {currentRoster.length} / {league.roster_size} players
                      </Text>
                      {rosterFull && (
                        <View style={{ backgroundColor: '#fef2f2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 }}>
                          <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '700' }}>ROSTER FULL</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              )}

              {/* Add Player button (only during active season) */}
              {canAddDrop && (
                <TouchableOpacity
                  onPress={() => { setSearchText(''); setAddModalVisible(true) }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                    backgroundColor: '#dc2626', borderRadius: 12, paddingVertical: 12,
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>+ Add Free Agent</Text>
                </TouchableOpacity>
              )}

              {myLoading ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <ActivityIndicator color="#dc2626" />
                </View>
              ) : (
                <SquadGrid
                  roster={currentRoster}
                  currency={currency}
                  onDrop={canAddDrop ? handleDropPlayer : undefined}
                />
              )}
            </>
          )}

          {/* ── All Teams ── */}
          {activeTab === 'all' && (
            allLoading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator color="#dc2626" />
              </View>
            ) : (
              <>
                {members.map((member) => {
                  const memberRoster = rostersByUser[member.user_id] ?? []
                  const displayName = member.display_name ?? member.username
                  const isMe = member.user_id === user?.id
                  const memberInfo = members.find(m => m.user_id === member.user_id)

                  return (
                    <View key={member.user_id} style={{ gap: 10 }}>
                      <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', padding: 16, gap: 4 }}>
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
                        <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6' }}>
                          <Text style={{ color: '#9ca3af', fontSize: 14 }}>No players acquired</Text>
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

      {/* Free Agent Picker Modal */}
      <Modal visible={addModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: 'white' }}>
          {/* Header */}
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontWeight: '700', fontSize: 17, color: '#111827' }}>Add Free Agent</Text>
              <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 2 }}>
                {rosterFull ? 'You must also drop a player' : `${currentRoster.length} / ${league?.roster_size ?? 16} roster spots used`}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setAddModalVisible(false)}>
              <Text style={{ color: '#dc2626', fontSize: 15, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search by name or team…"
              placeholderTextColor="#9ca3af"
              style={{
                backgroundColor: '#f9fafb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
                fontSize: 14, color: '#111827', borderWidth: 1, borderColor: '#f3f4f6',
              }}
              autoCapitalize="none"
            />
          </View>

          {faLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#dc2626" />
            </View>
          ) : (
            <FlatList
              data={filteredFreeAgents}
              keyExtractor={p => p.id}
              renderItem={({ item }) => {
                const roleColor = ROLE_COLORS[item.role] ?? '#6b7280'
                const roleLabel = ROLE_LABELS[item.role] ?? item.role
                return (
                  <TouchableOpacity
                    onPress={() => handleSelectFreeAgent(item)}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: 16, paddingVertical: 14,
                      borderBottomWidth: 1, borderBottomColor: '#f9fafb',
                    }}
                  >
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: roleColor, marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#111827', fontWeight: '600', fontSize: 15 }}>{item.name}</Text>
                      <Text style={{ color: '#9ca3af', fontSize: 13 }}>{item.ipl_team}</Text>
                    </View>
                    <View style={{ backgroundColor: '#f3f4f6', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginRight: 10 }}>
                      <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700' }}>{roleLabel}</Text>
                    </View>
                    <Text style={{ color: '#374151', fontSize: 13, fontWeight: '600' }}>
                      {formatCurrency(item.base_price, currency)}
                    </Text>
                  </TouchableOpacity>
                )
              }}
              ListEmptyComponent={
                <View style={{ padding: 48, alignItems: 'center' }}>
                  <Text style={{ color: '#9ca3af', fontSize: 15 }}>
                    {searchText ? 'No players match your search' : 'No free agents available'}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </Modal>

      {/* Drop Picker (when roster is full and user selected a free agent) */}
      <Modal visible={dropPickerVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: 'white' }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontWeight: '700', fontSize: 17, color: '#111827' }}>Drop a Player</Text>
              <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 2 }}>
                To add {selectedFreeAgent?.name}, select who to drop
              </Text>
            </View>
            <TouchableOpacity onPress={() => { setDropPickerVisible(false); setSelectedFreeAgent(null) }}>
              <Text style={{ color: '#dc2626', fontSize: 15, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={currentRoster}
            keyExtractor={p => p.player_id}
            renderItem={({ item }) => {
              const roleColor = ROLE_COLORS[item.player_role] ?? '#6b7280'
              const roleLabel = ROLE_LABELS[item.player_role] ?? item.player_role
              return (
                <TouchableOpacity
                  onPress={() => handleDropAndAdd(item)}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 14,
                    borderBottomWidth: 1, borderBottomColor: '#f9fafb',
                  }}
                >
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: roleColor, marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#111827', fontWeight: '600', fontSize: 15 }}>{item.player_name}</Text>
                    <Text style={{ color: '#9ca3af', fontSize: 13 }}>{item.player_ipl_team}</Text>
                  </View>
                  <View style={{ backgroundColor: '#f3f4f6', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginRight: 10 }}>
                    <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700' }}>{roleLabel}</Text>
                  </View>
                  <Text style={{ color: '#dc2626', fontSize: 13, fontWeight: '700' }}>Drop</Text>
                </TouchableOpacity>
              )
            }}
          />

          {addPlayer.isPending && (
            <View style={{ padding: 20, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
              <ActivityIndicator color="#dc2626" />
              <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 8 }}>Processing…</Text>
            </View>
          )}
        </View>
      </Modal>
    </>
  )
}
