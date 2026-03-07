import { View, Text } from 'react-native'
import { LineupSlot } from './LineupSlot'
import type { LineupEntry } from '../../hooks/useLineup'

interface Props {
  lineup: LineupEntry[]
  isLocked: boolean
  onSlotPress?: (slot: LineupEntry | null, role: string, index: number) => void
}

type SlotRole = 'batsman' | 'wicket_keeper' | 'all_rounder' | 'bowler'

const FORMATION: Array<{ role: SlotRole; count: number; label: string }> = [
  { role: 'wicket_keeper', count: 1, label: 'Wicket Keeper' },
  { role: 'batsman',       count: 5, label: 'Batsmen' },
  { role: 'all_rounder',   count: 2, label: 'All-Rounders' },
  { role: 'bowler',        count: 3, label: 'Bowlers' },
]

export function FormationGrid({ lineup, isLocked, onSlotPress }: Props) {
  // Build slot index for each role
  let globalIndex = 0

  return (
    <View className="gap-4">
      {FORMATION.map(({ role, count, label }) => {
        const slotsForRole = lineup.filter((e) => e.slot_role === role)
        const sections = []

        sections.push(
          <View key={role} className="gap-2">
            <Text className="text-gray-500 text-xs uppercase font-semibold tracking-wide">
              {label}
            </Text>
            {Array.from({ length: count }).map((_, i) => {
              const slot = slotsForRole[i] ?? null
              const idx = globalIndex++
              return (
                <LineupSlot
                  key={`${role}-${i}`}
                  slot={slot}
                  slotRole={role}
                  slotIndex={idx}
                  isLocked={isLocked}
                  onPress={onSlotPress}
                />
              )
            })}
          </View>
        )

        return sections
      })}
    </View>
  )
}
