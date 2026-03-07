import { View, Text, TouchableOpacity } from 'react-native'
import type { TradeProposal } from '../../hooks/useTrades'
import { Badge } from '../ui/Badge'

interface Props {
  trade: TradeProposal
  currentUserId: string
  onPress?: (trade: TradeProposal) => void
}

const STATUS_COLOR: Record<string, 'green' | 'yellow' | 'red' | 'blue' | 'gray'> = {
  pending:   'yellow',
  accepted:  'green',
  rejected:  'red',
  vetoed:    'red',
  cancelled: 'gray',
  expired:   'gray',
}

export function TradeCard({ trade, currentUserId, onPress }: Props) {
  const isProposer = trade.proposer_id === currentUserId
  const other = isProposer
    ? trade.receiver_full_name || trade.receiver_username
    : trade.proposer_full_name || trade.proposer_username

  const direction = isProposer ? 'Sent to' : 'From'

  const vetoDeadline = trade.veto_deadline ? new Date(trade.veto_deadline) : null
  const canStillVeto = vetoDeadline && vetoDeadline > new Date()

  return (
    <TouchableOpacity
      className="bg-white rounded-2xl p-4 gap-3 border border-gray-100 shadow-sm"
      onPress={() => onPress?.(trade)}
      activeOpacity={0.8}
    >
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-gray-500 text-xs">{direction}</Text>
          <Text className="text-gray-900 font-semibold">{other}</Text>
        </View>
        <Badge label={trade.status.toUpperCase()} color={STATUS_COLOR[trade.status] ?? 'gray'} />
      </View>

      {trade.note && (
        <Text className="text-gray-500 text-sm italic" numberOfLines={2}>
          "{trade.note}"
        </Text>
      )}

      <View className="flex-row justify-between items-center">
        <Text className="text-gray-400 text-xs">
          {new Date(trade.created_at).toLocaleDateString()}
        </Text>
        {trade.status === 'accepted' && canStillVeto && (
          <Text className="text-yellow-600 text-xs">Veto window open</Text>
        )}
      </View>
    </TouchableOpacity>
  )
}
