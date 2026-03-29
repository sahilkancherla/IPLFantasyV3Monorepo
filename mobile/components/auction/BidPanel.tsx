import { useState } from 'react'
import { View, Text, Alert } from 'react-native'
import { TextInput } from '../ui/TextInput'
import { Button } from '../ui/Button'
import { formatCurrency, type Currency } from '../../lib/currency'

interface BidPanelProps {
  currentBid: number | null
  basePrice: number
  remainingBudget: number
  onBid: (amount: number) => void
  disabled?: boolean
  currency?: Currency
}

export function BidPanel({ currentBid, basePrice, remainingBudget, onBid, disabled, currency = 'lakhs' }: BidPanelProps) {
  const [bidInput, setBidInput] = useState('')

  const minBid = (currentBid ?? basePrice - 1) + 1
  const roundTo10 = (n: number) => Math.round(n / 10) * 10
  const rawQuickBids = currentBid === null
    ? [basePrice, basePrice + 5, basePrice + 10]
    : [minBid, roundTo10(minBid + 5), roundTo10(minBid + 10)]
  const quickBids = [...new Set(rawQuickBids)].filter(b => b >= minBid && b <= remainingBudget)

  const handleBid = (amount: number) => {
    if (amount < minBid) {
      Alert.alert('Invalid bid', `Minimum bid is ${formatCurrency(minBid, currency)}`)
      return
    }
    if (amount > remainingBudget) {
      Alert.alert('Insufficient budget', `You only have ${formatCurrency(remainingBudget, currency)} remaining`)
      return
    }
    onBid(amount)
    setBidInput('')
  }

  return (
    <View className="gap-3">
      <View className="flex-row gap-2">
        {quickBids.slice(0, 3).map((b) => (
          <Button
            key={b}
            label={formatCurrency(b, currency)}
            variant="secondary"
            size="sm"
            onPress={() => handleBid(b)}
            disabled={disabled}
            className="flex-1"
          />
        ))}
      </View>

      <View className="flex-row gap-2 items-end">
        <View className="flex-1">
          <TextInput
            label={`Custom bid (min ${formatCurrency(minBid, currency)})`}
            value={bidInput}
            onChangeText={setBidInput}
            keyboardType="numeric"
            placeholder={String(minBid)}
          />
        </View>
        <Button
          label="BID"
          variant="primary"
          size="lg"
          onPress={() => handleBid(parseInt(bidInput, 10))}
          disabled={disabled || !bidInput || isNaN(parseInt(bidInput, 10))}
        />
      </View>
    </View>
  )
}
