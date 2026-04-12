import { useState } from 'react'
import { View, Text, ScrollView, Alert, RefreshControl, Modal, TouchableOpacity, FlatList } from 'react-native'
import { NavButton } from '../../../components/ui/NavButton'
import { LoadingScreen } from '../../../components/ui/Loading'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { FormationGrid } from '../../../components/lineup/FormationGrid'
import { Button } from '../../../components/ui/Button'
import { useLineup, useSetLineup, useAutoSetLineup, type LineupEntry } from '../../../hooks/useLineup'
import { useTeam } from '../../../hooks/useTeam'
import { useAuthStore } from '../../../stores/authStore'
import { useLeague } from '../../../hooks/useLeague'
import { formatCurrency } from '../../../lib/currency'

type SlotRole = 'batsman' | 'wicket_keeper' | 'all_rounder' | 'bowler' | 'flex'

const ROLE_MAP: Record<string, SlotRole> = {
  batsman:       'batsman',
  wicket_keeper: 'wicket_keeper',
  all_rounder:   'all_rounder',
  bowler:        'bowler',
  flex:          'flex',
}

export default function LineupScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>()
  const router = useRouter()
  const { user } = useAuthStore()

  const { data, isLoading, refetch, isRefetching } = useLineup(leagueId!)
  const { data: myRosterData } = useTeam(leagueId!)
  const { data: leagueData } = useLeague(leagueId!)
  const currency = leagueData?.league.currency ?? 'lakhs'
  const setLineup = useSetLineup(leagueId!)
  const autoSet = useAutoSetLineup(leagueId!)

  // Local draft state (entries the user is building)
  const [draftEntries, setDraftEntries] = useState<Array<{ playerId: string; slotRole: SlotRole }>>([])
  const [isDirty, setIsDirty] = useState(false)
  const [pickerVisible, setPickerVisible] = useState(false)
  const [pickerRole, setPickerRole] = useState<SlotRole>('batsman')

  const lineup = data?.lineup ?? []
  const weekNum = data?.weekNum
  const locked = data?.locked ?? false
  const roster = myRosterData ?? []

  // Use draft if dirty, else use server lineup
  const displayEntries: LineupEntry[] = isDirty
    ? draftEntries.map((e, i) => {
        const player = roster.find((r: any) => r.player_id === e.playerId)
        return {
          id: `draft-${i}`,
          league_id: leagueId!,
          user_id: user?.id ?? '',
          week_num: weekNum ?? 0,
          player_id: e.playerId,
          slot_role: e.slotRole,
          is_locked: false,
          set_at: new Date().toISOString(),
          player_name: player?.player_name ?? 'Unknown',
          player_role: player?.player_role ?? e.slotRole,
          player_ipl_team: player?.player_ipl_team ?? '',
        }
      })
    : lineup

  const handleSlotPress = (slot: LineupEntry | null, role: string, index: number) => {
    setPickerRole(role as SlotRole)
    setPickerVisible(true)
  }

  const handlePickPlayer = (playerId: string) => {
    setPickerVisible(false)
    const player = roster.find((r: any) => r.player_id === playerId)
    if (!player) return

    // Build new entries based on current display
    const base = isDirty ? [...draftEntries] : lineup.map((e) => ({ playerId: e.player_id, slotRole: e.slot_role }))

    // Count how many of this role we already have
    const roleSlots = base.filter((e) => e.slotRole === pickerRole)
    const ROLE_COUNTS: Record<SlotRole, number> = { batsman: 3, wicket_keeper: 1, all_rounder: 1, bowler: 3, flex: 3 }

    // Remove existing assignment if player already in lineup
    const filtered = base.filter((e) => e.playerId !== playerId)

    if (roleSlots.length < ROLE_COUNTS[pickerRole]) {
      filtered.push({ playerId, slotRole: pickerRole })
    } else {
      // Replace first slot of that role
      const firstIdx = filtered.findIndex((e) => e.slotRole === pickerRole)
      if (firstIdx !== -1) {
        filtered[firstIdx] = { playerId, slotRole: pickerRole }
      } else {
        filtered.push({ playerId, slotRole: pickerRole })
      }
    }

    setDraftEntries(filtered)
    setIsDirty(true)
  }

  const handleSave = async () => {
    if (!weekNum) return
    if (draftEntries.length !== 11) {
      Alert.alert('Incomplete Lineup', 'You need exactly 11 players in your lineup')
      return
    }

    try {
      await setLineup.mutateAsync({ weekNum, entries: draftEntries })
      setIsDirty(false)
      Alert.alert('Saved', 'Your lineup has been saved')
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save lineup')
    }
  }

  const handleAutoSet = async () => {
    try {
      await autoSet.mutateAsync()
      setIsDirty(false)
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to auto-set lineup')
    }
  }

  // Players eligible for picker role
  const eligiblePlayers = roster.filter((r: any) => {
    const mappedRole = ROLE_MAP[r.player_role]
    return mappedRole === pickerRole
  })

  if (isLoading) {
    return <LoadingScreen message="Loading lineup…" />
  }

  return (
    <>
      <ScrollView
        className="flex-1 bg-gray-50"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#ef4444" />}
      >
        <View className="p-4 gap-4">
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-gray-900 text-2xl font-bold">My Lineup</Text>
              {weekNum && <Text className="text-gray-500 text-sm">Week {weekNum}</Text>}
            </View>
            {locked && (
              <View className="bg-red-500/20 rounded-lg px-3 py-1.5">
                <Text className="text-red-500 text-sm font-semibold">LOCKED</Text>
              </View>
            )}
          </View>

          {/* Formation */}
          <View className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <FormationGrid
              lineup={displayEntries}
              isLocked={locked}
              onSlotPress={handleSlotPress}
            />
          </View>

          {/* Actions */}
          {!locked && (
            <View className="gap-2">
              {isDirty && (
                <Button
                  label={`Save Lineup (${draftEntries.length}/11)`}
                  variant="primary"
                  onPress={handleSave}
                  loading={setLineup.isPending}
                />
              )}
              <Button
                label="Auto-fill from Last Week"
                variant="secondary"
                onPress={handleAutoSet}
                loading={autoSet.isPending}
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Player Picker Modal */}
      <Modal visible={pickerVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[70%] border border-gray-100 shadow-sm">
            <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
              <NavButton label="Cancel" onPress={() => setPickerVisible(false)} />
            </View>

            <Text style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, fontWeight: '800', fontSize: 22, color: '#111827' }}>
              Pick {pickerRole.replace('_', ' ')}
            </Text>

            <FlatList
              data={eligiblePlayers}
              keyExtractor={(item: any) => item.player_id}
              renderItem={({ item }: { item: any }) => (
                <TouchableOpacity
                  className="flex-row items-center justify-between py-3 border-b border-gray-200"
                  onPress={() => handlePickPlayer(item.player_id)}
                >
                  <View>
                    <Text className="text-gray-900 font-medium">{item.player_name}</Text>
                    <Text className="text-gray-500 text-sm">{item.player_ipl_team}</Text>
                  </View>
                  <Text className="text-gray-500 text-sm">{formatCurrency(item.price_paid, currency)}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text className="text-gray-400 text-center py-8">
                  No eligible {pickerRole.replace('_', ' ')}s on roster
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  )
}
