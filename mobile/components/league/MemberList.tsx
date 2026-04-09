import { View, Text, FlatList } from 'react-native'
import { Avatar } from '../ui/Avatar'
import { formatCurrency, type Currency } from '../../lib/currency'

interface Member {
  user_id: string
  team_name: string
  username: string
  display_name: string | null
  avatar_url: string | null
  remaining_budget: number
  roster_count: number
}

interface MemberListProps {
  members: Member[]
  adminId: string
  startingBudget: number
  currency?: Currency
}

export function MemberList({ members, adminId, startingBudget, currency = 'lakhs' }: MemberListProps) {
  return (
    <FlatList
      data={members}
      keyExtractor={(m) => m.user_id}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <View className="flex-row items-center gap-3 py-3 border-b border-gray-100">
          <Avatar uri={item.avatar_url} name={item.team_name || item.display_name || item.username} size={44} />
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-gray-900 font-semibold">
                {item.team_name || item.display_name || item.username}
              </Text>
              {item.user_id === adminId && (
                <Text className="text-yellow-600 text-xs">👑 Admin</Text>
              )}
            </View>
            <Text className="text-gray-400 text-xs">@{item.username}</Text>
          </View>
          <View className="items-end gap-0.5">
            <Text className="text-green-600 text-sm font-bold">{formatCurrency(item.remaining_budget, currency)}</Text>
            <Text className="text-gray-400 text-xs">{item.roster_count} players</Text>
          </View>
        </View>
      )}
    />
  )
}
