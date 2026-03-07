import { TouchableOpacity, View, Text } from 'react-native'
import type { LineupEntry } from '../../hooks/useLineup'

interface Props {
  slot: LineupEntry | null
  slotRole: 'batsman' | 'wicket_keeper' | 'all_rounder' | 'bowler'
  slotIndex: number
  isLocked: boolean
  onPress?: (slot: LineupEntry | null, role: string, index: number) => void
}

const ROLE_CONFIG = {
  batsman:       { label: 'BAT', color: 'bg-blue-500', abbr: 'B' },
  wicket_keeper: { label: 'WK',  color: 'bg-yellow-500', abbr: 'WK' },
  all_rounder:   { label: 'AR',  color: 'bg-green-500', abbr: 'AR' },
  bowler:        { label: 'BWL', color: 'bg-red-500', abbr: 'BW' },
}

export function LineupSlot({ slot, slotRole, slotIndex, isLocked, onPress }: Props) {
  const config = ROLE_CONFIG[slotRole]

  return (
    <TouchableOpacity
      className="flex-row items-center bg-gray-100 rounded-xl px-3 py-3 gap-3"
      onPress={() => !isLocked && onPress?.(slot, slotRole, slotIndex)}
      activeOpacity={isLocked ? 1 : 0.7}
    >
      {/* Role badge */}
      <View className={`w-9 h-9 rounded-lg items-center justify-center ${config.color}`}>
        <Text className="text-white text-xs font-bold">{config.abbr}</Text>
      </View>

      {slot ? (
        <View className="flex-1">
          <Text className="text-gray-900 font-semibold text-sm" numberOfLines={1}>{slot.player_name}</Text>
          <Text className="text-gray-500 text-xs">{slot.player_ipl_team}</Text>
        </View>
      ) : (
        <View className="flex-1">
          <Text className="text-gray-400 text-sm italic">
            {isLocked ? 'Empty' : `Tap to set ${config.label}`}
          </Text>
        </View>
      )}

      {isLocked && (
        <Text className="text-gray-400 text-xs">LOCKED</Text>
      )}
    </TouchableOpacity>
  )
}
