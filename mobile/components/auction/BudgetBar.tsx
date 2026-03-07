import { View, Text } from 'react-native'
import type { MemberState } from '../../stores/auctionStore'
import { formatCurrency, type Currency } from '../../lib/currency'

interface BudgetBarProps {
  member: MemberState | undefined
  startingBudget: number
  currency?: Currency
}

export function BudgetBar({ member, startingBudget, currency = 'lakhs' }: BudgetBarProps) {
  if (!member) return null

  const percentage = Math.max(0, Math.min(1, member.remainingBudget / startingBudget))
  const barColor = percentage > 0.5 ? 'bg-green-500' : percentage > 0.25 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <View className="gap-1.5">
      <View className="flex-row justify-between">
        <Text className="text-gray-500 text-xs">My Budget</Text>
        <Text className="text-gray-900 text-xs font-bold">
          {formatCurrency(member.remainingBudget, currency)} / {formatCurrency(startingBudget, currency)}
        </Text>
      </View>
      <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <View
          className={`h-full ${barColor} rounded-full`}
          style={{ width: `${percentage * 100}%` }}
        />
      </View>
      <Text className="text-gray-400 text-xs text-right">{member.rosterCount} players acquired</Text>
    </View>
  )
}
