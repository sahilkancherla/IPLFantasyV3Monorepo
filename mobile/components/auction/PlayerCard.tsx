import { View, Text, Image, StyleSheet } from 'react-native'
import { Badge } from '../ui/Badge'
import type { Player } from '../../stores/auctionStore'
import { formatCurrency, type Currency } from '../../lib/currency'

interface PlayerCardProps {
  player: Player | null
  currency?: Currency
}

const roleColors: Record<string, 'green' | 'blue' | 'yellow' | 'red'> = {
  batsman: 'blue',
  bowler: 'red',
  all_rounder: 'green',
  wicket_keeper: 'yellow',
}

const roleLabels: Record<string, string> = {
  batsman: 'Batsman',
  bowler: 'Bowler',
  all_rounder: 'All-Rounder',
  wicket_keeper: 'Wicket Keeper',
}

export function PlayerCard({ player, currency = 'lakhs' }: PlayerCardProps) {
  if (!player) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Waiting for next player...</Text>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      {player.image_url ? (
        <Image
          source={{ uri: player.image_url }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderText}>🏏</Text>
        </View>
      )}

      <View style={styles.body}>
        <Text style={styles.name}>{player.name}</Text>
        <View style={styles.badges}>
          <Badge label={player.ipl_team} color="blue" />
          <Badge label={roleLabels[player.role] ?? player.role} color={roleColors[player.role] ?? 'gray'} />
          {player.nationality !== 'Indian' && (
            <Badge label={player.nationality} color="yellow" />
          )}
        </View>
        <Text style={styles.basePrice}>
          Base Price: <Text style={styles.basePriceValue}>{formatCurrency(player.base_price, currency)}</Text>
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  empty: {
    backgroundColor: '#f3f4f6',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 18,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  image: {
    width: '100%',
    height: 192,
    backgroundColor: '#e5e7eb',
  },
  imagePlaceholder: {
    width: '100%',
    height: 192,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    fontSize: 64,
  },
  body: {
    padding: 16,
    gap: 8,
  },
  name: {
    color: '#111827',
    fontSize: 24,
    fontWeight: 'bold',
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  basePrice: {
    color: '#6b7280',
    fontSize: 14,
  },
  basePriceValue: {
    color: '#16a34a',
    fontWeight: '600',
  },
})
