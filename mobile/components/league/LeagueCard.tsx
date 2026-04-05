import { TouchableOpacity, View, Text } from 'react-native'
import type { League } from '../../stores/leagueStore'
import { formatCurrency } from '../../lib/currency'

interface LeagueCardProps {
  league: League
  onPress: () => void
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  draft_pending:   { label: 'Draft Pending', bg: '#f3f4f6', color: '#6b7280' },
  draft_active:    { label: 'DRAFT LIVE',    bg: '#fee2e2', color: '#dc2626' },
  league_active:   { label: 'Season Active', bg: '#f0fdf4', color: '#16a34a' },
  league_complete: { label: 'Complete',      bg: '#eff6ff', color: '#2563eb' },
}

export function LeagueCard({ league, onPress }: LeagueCardProps) {
  const s = STATUS_CONFIG[league.status] ?? { label: league.status, bg: '#f3f4f6', color: '#6b7280' }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}
    >
      {/* Dark header */}
      <View style={{
        backgroundColor: '#1f2937',
        paddingHorizontal: 16, paddingVertical: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 15, flex: 1, marginRight: 10 }} numberOfLines={1}>
          {league.name}
        </Text>
        <View style={{ backgroundColor: s.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ color: s.color, fontSize: 11, fontWeight: '700' }}>{s.label}</Text>
        </View>
      </View>

      {/* Body stats */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 20 }}>
        <View>
          <Text style={{ color: '#9ca3af', fontSize: 11 }}>Budget</Text>
          <Text style={{ color: '#111827', fontSize: 13, fontWeight: '600', marginTop: 2 }}>
            {formatCurrency(league.starting_budget, league.currency)}
          </Text>
        </View>
        <View>
          <Text style={{ color: '#9ca3af', fontSize: 11 }}>Squad</Text>
          <Text style={{ color: '#111827', fontSize: 13, fontWeight: '600', marginTop: 2 }}>
            {league.max_squad_size} players
          </Text>
        </View>
        <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View>
            <Text style={{ color: '#9ca3af', fontSize: 11 }}>Invite Code</Text>
            <Text style={{ color: '#dc2626', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 2 }}>
              {league.invite_code}
            </Text>
          </View>
          <Text style={{ color: '#d1d5db', fontSize: 18, fontWeight: '300' }}>›</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}
