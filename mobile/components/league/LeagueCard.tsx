import { TouchableOpacity, View, Text } from 'react-native'
import { Badge } from '../ui/Badge'
import type { League } from '../../stores/leagueStore'
import { formatCurrency } from '../../lib/currency'

interface LeagueCardProps {
  league: League
  onPress: () => void
}

const statusConfig: Record<string, { label: string; color: 'green' | 'yellow' | 'blue' | 'red' | 'gray' }> = {
  draft_pending:   { label: 'Draft Pending', color: 'gray' },
  draft_active:    { label: 'DRAFT LIVE', color: 'red' },
  league_active:   { label: 'Season Active', color: 'green' },
  league_complete: { label: 'Complete', color: 'blue' },
}

export function LeagueCard({ league, onPress }: LeagueCardProps) {
  const statusInfo = statusConfig[league.status] ?? { label: league.status, color: 'gray' }

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white rounded-2xl p-4 gap-3 active:opacity-80 border border-gray-100 shadow-sm"
    >
      <View className="flex-row items-start justify-between">
        <Text className="text-gray-900 text-lg font-bold flex-1 mr-3">{league.name}</Text>
        <Badge label={statusInfo.label} color={statusInfo.color} />
      </View>

      <View className="flex-row gap-4">
        <View>
          <Text className="text-gray-400 text-xs">Budget</Text>
          <Text className="text-gray-900 text-sm font-medium">{formatCurrency(league.starting_budget, league.currency)}</Text>
        </View>
        <View>
          <Text className="text-gray-400 text-xs">Squad Size</Text>
          <Text className="text-gray-900 text-sm font-medium">{league.max_squad_size}</Text>
        </View>
        <View>
          <Text className="text-gray-400 text-xs">Invite Code</Text>
          <Text className="text-red-600 text-sm font-mono font-bold">{league.invite_code}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}
