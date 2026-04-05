import { View, Text, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from 'react-native'
import { PointsValue } from '../ui/PointsBreakdown'
import { formatCurrency, type Currency } from '../../lib/currency'
import { usePlayerStats } from '../../hooks/useLineup'
import type { PlayerMatchStat } from '../../hooks/useLineup'

const ROLE_SHORT: Record<string, string> = {
  batsman: 'BAT', bowler: 'BOW', all_rounder: 'AR', wicket_keeper: 'WK',
}
const ROLE_FULL: Record<string, string> = {
  batsman: 'Batsman', bowler: 'Bowler', all_rounder: 'All-Rounder', wicket_keeper: 'Wicket Keeper',
}
const ROLE_COLORS: Record<string, string> = {
  batsman: '#2563eb', bowler: '#dc2626', all_rounder: '#16a34a', wicket_keeper: '#d97706',
}

export interface PlayerDetailInfo {
  name: string
  ipl_team: string
  role: string
  nationality?: string
  /** Price the user paid (squad view) */
  price_paid?: number
  /** Base auction price (available players view) */
  base_price?: number
  /** Sold price if sold in auction */
  sold_price?: number | null
  /** Auction status: 'pending' | 'sold' | 'unsold' | 'live' */
  status?: string
}

interface Props {
  visible: boolean
  player: PlayerDetailInfo | null
  currency?: Currency
  onClose: () => void
  /** When provided, fetches and shows match-by-match stats history */
  playerId?: string | null
  /** Drop button shown (squad view) */
  onDrop?: () => void
  /** Add button shown (available players view) */
  onAdd?: () => void
  /** Override add button label */
  addLabel?: string
  /** True if player is already on user's squad */
  alreadyOnTeam?: boolean
}

function statLine(s: PlayerMatchStat, _role: string): string {
  const parts: string[] = []

  // Batting — show if faced a ball or scored runs
  if (s.ballsFaced > 0 || s.runsScored > 0) {
    const duck = s.isOut && s.runsScored === 0
    parts.push(`${s.runsScored}${duck ? ' duck' : ''}(${s.ballsFaced})`)
    if (s.fours > 0) parts.push(`${s.fours}×4`)
    if (s.sixes > 0) parts.push(`${s.sixes}×6`)
  }
  // Bowling — show if bowled at least one ball
  if (s.ballsBowled > 0) {
    const overs = `${Math.floor(s.ballsBowled / 6)}.${s.ballsBowled % 6}`
    parts.push(`${s.wicketsTaken}/${s.runsConceded} (${overs}ov)`)
    if (s.maidens > 0) parts.push(`${s.maidens}m`)
  }
  // Fielding — show each individually if non-zero
  if (s.catches > 0) parts.push(`${s.catches}c`)
  if (s.stumpings > 0) parts.push(`${s.stumpings}st`)
  if (s.runOutsDirect > 0 || s.runOutsIndirect > 0)
    parts.push(`${s.runOutsDirect + s.runOutsIndirect}ro`)

  return parts.join('  ') || 'Did not bat/bowl'
}

function MatchHistory({ playerId, role }: { playerId: string; role: string }) {
  const { data: stats, isLoading, isError } = usePlayerStats(playerId)

  if (isLoading) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
        <ActivityIndicator color="#dc2626" />
      </View>
    )
  }

  if (isError) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Text style={{ color: '#f87171', fontSize: 14 }}>Failed to load match history</Text>
      </View>
    )
  }

  if (!stats || stats.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Text style={{ color: '#d1d5db', fontSize: 14 }}>No match history yet</Text>
      </View>
    )
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: '#374151', fontSize: 13, fontWeight: '700', marginBottom: 2 }}>Match History</Text>
      {stats.map((s, i) => {
        const isHome = s.homeTeam === s.playerIplTeam
        const opp = s.homeTeam ? (isHome ? s.awayTeam : s.homeTeam) : null
        const dateStr = s.startTimeUtc
          ? new Date(s.startTimeUtc).toLocaleString('en-US', {
              month: 'short', day: 'numeric',
              hour: 'numeric', minute: '2-digit',
              timeZone: 'Asia/Kolkata',
            }) + ' IST'
          : s.matchDate

        const statusColor = s.status === 'live' ? '#b45309' : s.status === 'completed' ? '#16a34a' : '#6b7280'
        const statusBg = s.status === 'live' ? '#fef9c3' : s.status === 'completed' ? '#f0fdf4' : '#f3f4f6'
        const statusLabel = s.status === 'live' ? 'LIVE' : s.status === 'completed' ? 'FINAL' : 'UPCOMING'

        const matchLabel = s.homeTeam
          ? `${isHome ? 'vs' : '@'} ${opp}`
          : s.matchId

      return (
          <View key={`${s.matchId}-${i}`} style={{
            backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1,
            borderColor: '#f3f4f6', padding: 12, gap: 6,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View style={{ backgroundColor: statusBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700' }}>{statusLabel}</Text>
                </View>
                <Text style={{ color: '#111827', fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                  {matchLabel}
                </Text>
              </View>
              {s.matchNumber != null && (
                <Text style={{ color: '#d1d5db', fontSize: 11 }}>M{s.matchNumber}</Text>
              )}
            </View>

            <Text style={{ color: '#9ca3af', fontSize: 11 }}>{dateStr}</Text>

            {s.status !== 'upcoming' ? (
              <View style={{ borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: '#374151', fontSize: 12, flex: 1, marginRight: 8 }}>{statLine(s, role)}</Text>
                <PointsValue
                  value={s.points}
                  stats={{ ...s, playerRole: role }}
                  style={{ color: s.points > 0 ? '#16a34a' : '#9ca3af', fontSize: 13, fontWeight: '700' }}
                >
                  {s.points > 0 ? `+${parseFloat(s.points.toString()).toFixed(1)}` : '—'}
                </PointsValue>
              </View>
            ) : (
              <View style={{ borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 8 }}>
                <Text style={{ color: '#d1d5db', fontSize: 12 }}>Not played yet</Text>
              </View>
            )}
          </View>
        )
      })}
    </View>
  )
}

export function PlayerDetailModal({ visible, player, currency = 'INR', onClose, playerId, onDrop, onAdd, addLabel = 'Add to Squad', alreadyOnTeam }: Props) {
  if (!player) return null

  const roleColor = ROLE_COLORS[player.role] ?? '#6b7280'
  const roleShort = ROLE_SHORT[player.role] ?? player.role
  const roleFull  = ROLE_FULL[player.role]  ?? player.role
  const isSold    = player.status === 'sold'

  const displayPrice = player.price_paid != null
    ? formatCurrency(player.price_paid, currency)
    : player.base_price != null
    ? formatCurrency(player.base_price, currency)
    : null

  const priceLabel = player.price_paid != null ? 'Paid' : 'Base Price'

  const stats: { label: string; value: string }[] = [
    { label: 'Role', value: roleFull },
    ...(displayPrice ? [{ label: priceLabel, value: displayPrice }] : []),
    ...(player.status && player.status !== 'pending' ? [{ label: 'Status', value: player.status.charAt(0).toUpperCase() + player.status.slice(1) }] : []),
  ]

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        {/* Header */}
        <View style={{
          padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <Text style={{ fontWeight: '700', fontSize: 17, color: '#111827' }}>Player Details</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: '#dc2626', fontSize: 15, fontWeight: '600' }}>Close</Text>
          </TouchableOpacity>
        </View>

        {/* Body */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 20 }}>
          {/* Badges row */}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <View style={{ backgroundColor: roleColor + '20', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: roleColor, fontSize: 12, fontWeight: '700' }}>{roleShort}</Text>
            </View>
            {player.nationality && player.nationality !== 'Indian' && (
              <View style={{ backgroundColor: '#fef9c3', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: '#b45309', fontSize: 12, fontWeight: '700' }}>OVERSEAS</Text>
              </View>
            )}
          </View>

          {/* Name + team */}
          <View style={{ gap: 4 }}>
            <Text style={{ color: '#111827', fontSize: 26, fontWeight: '800' }}>{player.name}</Text>
            <Text style={{ color: '#6b7280', fontSize: 15 }}>{player.ipl_team}</Text>
          </View>

          {/* Stats card */}
          <View style={{
            backgroundColor: '#f9fafb', borderRadius: 14,
            borderWidth: 1, borderColor: '#f3f4f6',
            flexDirection: 'row',
          }}>
            {stats.map(({ label, value }, i) => (
              <View
                key={label}
                style={{
                  flex: 1, padding: 14, alignItems: 'center',
                  borderRightWidth: i < stats.length - 1 ? 1 : 0,
                  borderRightColor: '#f3f4f6',
                }}
              >
                <Text style={{ color: '#111827', fontWeight: '700', fontSize: 14 }} numberOfLines={1} adjustsFontSizeToFit>
                  {value}
                </Text>
                <Text style={{ color: '#9ca3af', fontSize: 11, marginTop: 3 }}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Sold price info */}
          {isSold && player.sold_price != null && (
            <View style={{ backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#bbf7d0' }}>
              <Text style={{ color: '#15803d', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
                Sold for {formatCurrency(player.sold_price, currency)}
              </Text>
            </View>
          )}

          {/* Already on team notice */}
          {alreadyOnTeam && (
            <View style={{ backgroundColor: '#eff6ff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#bfdbfe' }}>
              <Text style={{ color: '#1d4ed8', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
                Already on your squad
              </Text>
            </View>
          )}

          {/* Match history (shown when playerId is provided) */}
          {playerId && <MatchHistory playerId={playerId} role={player.role} />}
        </ScrollView>

        {/* Bottom action */}
        {onDrop && (
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
            <TouchableOpacity
              onPress={onDrop}
              style={{ backgroundColor: '#fef2f2', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#fecaca' }}
            >
              <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 15 }}>Drop Player</Text>
            </TouchableOpacity>
          </View>
        )}

        {onAdd && !alreadyOnTeam && !isSold && (
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
            <TouchableOpacity
              onPress={onAdd}
              style={{ backgroundColor: '#dc2626', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>{addLabel}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  )
}
