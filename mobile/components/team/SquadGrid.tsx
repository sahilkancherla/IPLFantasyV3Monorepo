import { View, Text, FlatList } from 'react-native'
import { Badge } from '../ui/Badge'
import type { RosterEntry } from '../../hooks/useTeam'
import { formatCurrency, type Currency } from '../../lib/currency'

interface SquadGridProps {
  roster: RosterEntry[]
  currency?: Currency
}

const roleColors: Record<string, 'green' | 'blue' | 'yellow' | 'red'> = {
  batsman: 'blue',
  bowler: 'red',
  all_rounder: 'green',
  wicket_keeper: 'yellow',
}

export function SquadGrid({ roster, currency = 'lakhs' }: SquadGridProps) {
  if (roster.length === 0) {
    return (
      <View className="py-12 items-center">
        <Text className="text-gray-400 text-base">No players acquired yet</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={roster}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={{ gap: 12 }}
      contentContainerStyle={{ gap: 12 }}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <View className="bg-white rounded-2xl p-3 flex-1 gap-2 border border-gray-100 shadow-sm">
          <Text className="text-gray-900 font-semibold text-sm" numberOfLines={1}>
            {item.player_name}
          </Text>
          <Text className="text-gray-400 text-xs" numberOfLines={1}>
            {item.player_ipl_team}
          </Text>
          <Badge
            label={item.player_role.replace('_', ' ')}
            color={roleColors[item.player_role] ?? 'gray'}
          />
          <Text className="text-green-600 text-xs font-bold">{formatCurrency(item.price_paid, currency)}</Text>
        </View>
      )}
    />
  )
}
