import { View, Text, FlatList } from 'react-native'
import { Avatar } from '../ui/Avatar'
import type { BidHistoryEntry } from '../../stores/auctionStore'
import { formatCurrency, type Currency } from '../../lib/currency'

interface BidHistoryProps {
  history: BidHistoryEntry[]
  currency?: Currency
}

export function BidHistory({ history, currency = 'lakhs' }: BidHistoryProps) {
  if (history.length === 0) {
    return (
      <View className="py-3 items-center">
        <Text className="text-gray-400 text-sm">No bids yet — be the first!</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={history}
      keyExtractor={(_, i) => String(i)}
      scrollEnabled={false}
      renderItem={({ item, index }) => (
        <View className={`flex-row items-center gap-3 py-2 ${index > 0 ? 'border-t border-gray-100' : ''}`}>
          <Avatar uri={item.bidder.avatarUrl} name={item.bidder.displayName ?? item.bidder.username} size={32} />
          <View className="flex-1">
            <Text className="text-gray-900 text-sm font-medium">
              {item.bidder.displayName ?? item.bidder.username}
            </Text>
          </View>
          <Text className="text-green-600 font-bold">{formatCurrency(item.amount, currency)}</Text>
        </View>
      )}
    />
  )
}
