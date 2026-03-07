import { View, Text, ScrollView, Alert, RefreshControl } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { TradeCard } from '../../../components/trade/TradeCard'
import { Button } from '../../../components/ui/Button'
import { useMyTrades, useRespondToTrade, useCancelTrade } from '../../../hooks/useTrades'
import { useAuthStore } from '../../../stores/authStore'

export default function TradesScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>()
  const router = useRouter()
  const { user } = useAuthStore()

  const { data: trades, isLoading, refetch, isRefetching } = useMyTrades(leagueId!)
  const respondToTrade = useRespondToTrade(leagueId!)
  const cancelTrade = useCancelTrade(leagueId!)

  const incoming = (trades ?? []).filter(
    (t) => t.receiver_id === user?.id && t.status === 'pending'
  )
  const outgoing = (trades ?? []).filter(
    (t) => t.proposer_id === user?.id && t.status === 'pending'
  )
  const history = (trades ?? []).filter((t) => t.status !== 'pending')

  const handleAccept = (tradeId: string) => {
    Alert.alert('Accept Trade', 'Accept this trade? Rosters will swap immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: () =>
          respondToTrade.mutate(
            { tradeId, action: 'accept' },
            {
              onError: (err) =>
                Alert.alert('Error', err instanceof Error ? err.message : 'Failed to accept'),
            }
          ),
      },
    ])
  }

  const handleReject = (tradeId: string) => {
    respondToTrade.mutate(
      { tradeId, action: 'reject' },
      {
        onError: (err) =>
          Alert.alert('Error', err instanceof Error ? err.message : 'Failed to reject'),
      }
    )
  }

  const handleCancel = (tradeId: string) => {
    cancelTrade.mutate(tradeId, {
      onError: (err) =>
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to cancel'),
    })
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500">Loading...</Text>
      </View>
    )
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#ef4444" />}
    >
      <View className="p-4 gap-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-gray-900 text-2xl font-bold">Trades</Text>
          <Button
            label="Propose Trade"
            variant="primary"
            onPress={() => router.push(`/(app)/trades/propose/${leagueId}`)}
          />
        </View>

        {/* Incoming */}
        {incoming.length > 0 && (
          <View className="gap-2">
            <Text className="text-yellow-600 text-sm uppercase font-semibold tracking-wide">
              Incoming ({incoming.length})
            </Text>
            {incoming.map((trade) => (
              <View key={trade.id} className="gap-2">
                <TradeCard
                  trade={trade}
                  currentUserId={user?.id ?? ''}
                  onPress={() => router.push(`/(app)/trades/${leagueId}/${trade.id}` as any)}
                />
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Button
                      label="Accept"
                      variant="primary"
                      onPress={() => handleAccept(trade.id)}
                      loading={respondToTrade.isPending}
                    />
                  </View>
                  <View className="flex-1">
                    <Button
                      label="Reject"
                      variant="danger"
                      onPress={() => handleReject(trade.id)}
                      loading={respondToTrade.isPending}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Outgoing */}
        {outgoing.length > 0 && (
          <View className="gap-2">
            <Text className="text-gray-500 text-sm uppercase font-semibold tracking-wide">
              Sent ({outgoing.length})
            </Text>
            {outgoing.map((trade) => (
              <View key={trade.id} className="gap-2">
                <TradeCard
                  trade={trade}
                  currentUserId={user?.id ?? ''}
                />
                <Button
                  label="Cancel Trade"
                  variant="ghost"
                  onPress={() => handleCancel(trade.id)}
                  loading={cancelTrade.isPending}
                />
              </View>
            ))}
          </View>
        )}

        {/* History */}
        {history.length > 0 && (
          <View className="gap-2">
            <Text className="text-gray-400 text-sm uppercase font-semibold tracking-wide">
              History
            </Text>
            {history.map((trade) => (
              <TradeCard
                key={trade.id}
                trade={trade}
                currentUserId={user?.id ?? ''}
              />
            ))}
          </View>
        )}

        {trades?.length === 0 && (
          <View className="bg-white rounded-2xl p-8 items-center border border-gray-100 shadow-sm">
            <Text className="text-gray-500 text-center">No trades yet</Text>
            <Text className="text-gray-400 text-sm text-center mt-1">
              Propose a trade to swap players with other managers
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  )
}
