import { View, Text, TouchableOpacity } from 'react-native'
import type { FreeAgent } from '../../hooks/useWaivers'

const ROLE_COLOR: Record<string, string> = {
  batsman:       'text-blue-600',
  wicket_keeper: 'text-yellow-600',
  all_rounder:   'text-green-600',
  bowler:        'text-red-600',
}

interface Props {
  player: FreeAgent
  onClaim?: (player: FreeAgent) => void
}

export function WaiverPlayerCard({ player, onClaim }: Props) {
  const roleColor = ROLE_COLOR[player.role] ?? 'text-gray-500'

  return (
    <View className="bg-white rounded-xl p-3 flex-row items-center justify-between border border-gray-100 shadow-sm">
      <View className="flex-1 gap-0.5">
        <Text className="text-gray-900 font-semibold">{player.name}</Text>
        <View className="flex-row items-center gap-2">
          <Text className={`text-xs font-medium ${roleColor}`}>
            {player.role.replace('_', ' ').toUpperCase()}
          </Text>
          <Text className="text-gray-400 text-xs">{player.ipl_team}</Text>
        </View>
      </View>

      {onClaim && (
        <TouchableOpacity
          className="bg-red-500 rounded-lg px-3 py-1.5"
          onPress={() => onClaim(player)}
        >
          <Text className="text-white text-xs font-semibold">Claim</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}
