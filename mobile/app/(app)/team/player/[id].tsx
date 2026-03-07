import { View, Text, ScrollView, Image } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../../lib/api'
import { Badge } from '../../../../components/ui/Badge'
import { formatCurrency, type Currency } from '../../../../lib/currency'

interface PlayerDetail {
  id: string
  name: string
  ipl_team: string
  role: string
  base_price: number
  nationality: string
  image_url: string | null
}

const roleColors: Record<string, 'green' | 'blue' | 'yellow' | 'red'> = {
  batsman: 'blue',
  bowler: 'red',
  all_rounder: 'green',
  wicket_keeper: 'yellow',
}

export default function PlayerDetailScreen() {
  const { id, currency } = useLocalSearchParams<{ id: string; currency?: Currency }>()

  const { data, isLoading } = useQuery({
    queryKey: ['player', id],
    queryFn: () => api.get<{ player: PlayerDetail }>(`/players/${id}`),
    enabled: !!id,
  })

  const player = data?.player

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500">Loading...</Text>
      </View>
    )
  }

  if (!player) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-red-500">Player not found</Text>
      </View>
    )
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {player.image_url ? (
        <Image
          source={{ uri: player.image_url }}
          className="w-full h-64 bg-gray-100"
          resizeMode="cover"
        />
      ) : (
        <View className="w-full h-64 bg-white items-center justify-center border border-gray-100 shadow-sm">
          <Text className="text-8xl">🏏</Text>
        </View>
      )}

      <View className="p-4 gap-4">
        <View className="gap-2">
          <Text className="text-gray-900 text-3xl font-bold">{player.name}</Text>
          <View className="flex-row gap-2 flex-wrap">
            <Badge label={player.ipl_team} color="blue" />
            <Badge label={player.role.replace('_', ' ')} color={roleColors[player.role] ?? 'gray'} />
            {player.nationality !== 'Indian' && (
              <Badge label={player.nationality} color="yellow" />
            )}
          </View>
        </View>

        <View className="bg-white rounded-2xl p-4 gap-3 border border-gray-100 shadow-sm">
          <Text className="text-gray-500 font-medium">Player Details</Text>
          <View className="flex-row justify-between">
            <Text className="text-gray-500">Base Price</Text>
            <Text className="text-green-600 font-bold">{formatCurrency(player.base_price, currency ?? 'lakhs')}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-500">IPL Team</Text>
            <Text className="text-gray-900">{player.ipl_team}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-500">Role</Text>
            <Text className="text-gray-900">{player.role.replace(/_/g, ' ')}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-500">Nationality</Text>
            <Text className="text-gray-900">{player.nationality}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}
