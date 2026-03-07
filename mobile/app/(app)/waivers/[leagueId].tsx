import { useState } from 'react'
import { View, Text, ScrollView, Alert, RefreshControl, Modal, FlatList, TouchableOpacity } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { WaiverPlayerCard } from '../../../components/waiver/WaiverPlayerCard'
import { Button } from '../../../components/ui/Button'
import { useFreeAgents, useMyClaims, useSubmitClaim, useCancelClaim, type FreeAgent } from '../../../hooks/useWaivers'
import { useTeam } from '../../../hooks/useTeam'
import { useLeague } from '../../../hooks/useLeague'

export default function WaiversScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>()

  const { data: freeAgents, isLoading, refetch, isRefetching } = useFreeAgents(leagueId!)
  const { data: myClaims } = useMyClaims(leagueId!)
  const { data: rosterData } = useTeam(leagueId!)
  const { data: leagueData } = useLeague(leagueId!)
  const currency = leagueData?.league.currency ?? 'lakhs'
  const submitClaim = useSubmitClaim(leagueId!)
  const cancelClaim = useCancelClaim(leagueId!)

  const [claimPlayer, setClaimPlayer] = useState<FreeAgent | null>(null)
  const [dropPlayerId, setDropPlayerId] = useState<string>('')
  const [dropPickerVisible, setDropPickerVisible] = useState(false)

  const roster = rosterData ?? []
  const pendingClaims = (myClaims ?? []).filter((c) => c.status === 'pending')

  const handleClaim = (player: FreeAgent) => {
    setClaimPlayer(player)
    setDropPlayerId('')
    setDropPickerVisible(true)
  }

  const handleConfirmClaim = async () => {
    if (!claimPlayer || !dropPlayerId) {
      Alert.alert('Select a player to drop')
      return
    }

    try {
      await submitClaim.mutateAsync({
        claimPlayerId: claimPlayer.id,
        dropPlayerId,
      })
      setDropPickerVisible(false)
      setClaimPlayer(null)
      Alert.alert('Claim submitted', 'Your waiver claim is pending')
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit claim')
    }
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500">Loading...</Text>
      </View>
    )
  }

  return (
    <>
      <ScrollView
        className="flex-1 bg-gray-50"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#ef4444" />}
      >
        <View className="p-4 gap-4">
          <Text className="text-gray-900 text-2xl font-bold">Waivers</Text>

          {/* Pending claims */}
          {pendingClaims.length > 0 && (
            <View className="bg-white rounded-2xl p-4 gap-3 border border-gray-100 shadow-sm">
              <Text className="text-gray-900 font-bold">My Pending Claims ({pendingClaims.length})</Text>
              {pendingClaims.map((claim) => (
                <View key={claim.id} className="flex-row items-center justify-between py-2 border-b border-gray-200">
                  <View>
                    <Text className="text-gray-900 text-sm">+ {claim.claim_player_name}</Text>
                    <Text className="text-gray-500 text-xs">— {claim.drop_player_name}</Text>
                  </View>
                  <TouchableOpacity
                    className="bg-red-500/20 rounded-lg px-3 py-1.5"
                    onPress={() => cancelClaim.mutate(claim.id)}
                  >
                    <Text className="text-red-500 text-xs">Cancel</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Free agents */}
          <View className="gap-2">
            <Text className="text-gray-500 text-sm uppercase font-semibold tracking-wide">
              Free Agents ({freeAgents?.length ?? 0})
            </Text>
            {(freeAgents ?? []).length === 0 ? (
              <View className="bg-white rounded-2xl p-8 items-center border border-gray-100 shadow-sm">
                <Text className="text-gray-500">No free agents available</Text>
              </View>
            ) : (
              (freeAgents ?? []).map((player) => (
                <WaiverPlayerCard
                  key={player.id}
                  player={player}
                  onClaim={handleClaim}
                  currency={currency}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Drop player picker */}
      <Modal visible={dropPickerVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end">
          <View className="bg-white rounded-t-3xl p-4 gap-4 max-h-[70%] border border-gray-100 shadow-sm">
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-gray-900 font-bold text-lg">Claim {claimPlayer?.name}</Text>
                <Text className="text-gray-500 text-sm">Select a player to drop</Text>
              </View>
              <TouchableOpacity onPress={() => setDropPickerVisible(false)}>
                <Text className="text-red-500 font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={roster}
              keyExtractor={(item: any) => item.player_id}
              renderItem={({ item }: { item: any }) => (
                <TouchableOpacity
                  className={`flex-row items-center justify-between py-3 border-b border-gray-200 ${dropPlayerId === item.player_id ? 'bg-red-500/10' : ''}`}
                  onPress={() => setDropPlayerId(item.player_id)}
                >
                  <View>
                    <Text className="text-gray-900 font-medium">{item.player_name}</Text>
                    <Text className="text-gray-500 text-sm">{item.player_ipl_team}</Text>
                  </View>
                  {dropPlayerId === item.player_id && (
                    <Text className="text-red-500 text-sm font-semibold">Drop</Text>
                  )}
                </TouchableOpacity>
              )}
            />

            <Button
              label="Confirm Claim"
              variant="primary"
              onPress={handleConfirmClaim}
              loading={submitClaim.isPending}
            />
          </View>
        </View>
      </Modal>
    </>
  )
}
