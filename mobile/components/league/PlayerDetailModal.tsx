import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from 'react-native'
import { NavButton } from '../ui/NavButton'
import { PointsValue } from '../ui/PointsBreakdown'
import { formatCurrency, type Currency } from '../../lib/currency'
import { usePlayerStats, usePlayerUpcoming } from '../../hooks/useLineup'
import type { PlayerMatchStat, PlayerUpcomingMatch } from '../../hooks/useLineup'
import {
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, TEXT_PLACEHOLDER, TEXT_DISABLED,
  BORDER_DEFAULT, BORDER_MEDIUM,
  BG_PAGE, BG_CARD, BG_SUBTLE,
  PRIMARY, PRIMARY_BG, PRIMARY_BORDER,
  SUCCESS, SUCCESS_BG, SUCCESS_BORDER, SUCCESS_DARK,
  WARNING_DARK, WARNING_BG,
  INFO_DARK, INFO_BG, INFO_BORDER,
  roleColors,
  matchStatusColors,
} from '../../constants/colors'

const ROLE_SHORT: Record<string, string> = {
  batsman: 'BAT', bowler: 'BOW', all_rounder: 'AR', wicket_keeper: 'WK',
}
const ROLE_FULL: Record<string, string> = {
  batsman: 'Batsman', bowler: 'Bowler', all_rounder: 'All-Rounder', wicket_keeper: 'Wicket Keeper',
}
const ROLE_COLORS: Record<string, string> = roleColors

export interface PlayerDetailInfo {
  name: string
  ipl_team: string
  role: string
  nationality?: string
  /** Total fantasy points scored (squad view) */
  total_points?: number
  /** Number of games the player's IPL team has played (for avg calc) */
  team_games_played?: number
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

function UpcomingGames({ playerId }: { playerId: string }) {
  const { data: matches, isLoading } = usePlayerUpcoming(playerId)
  const [expanded, setExpanded] = useState(false)

  if (isLoading) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 16 }}>
        <ActivityIndicator color={PRIMARY} />
      </View>
    )
  }

  if (!matches || matches.length === 0) {
    return (
      <View style={{ gap: 8 }}>
        <Text style={{ color: TEXT_SECONDARY, fontSize: 13, fontWeight: '700' }}>Upcoming Games</Text>
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <Text style={{ color: TEXT_DISABLED, fontSize: 14 }}>No upcoming games scheduled</Text>
        </View>
      </View>
    )
  }

  const visible = expanded ? matches : matches.slice(0, 2)
  const hasMore = matches.length > 2

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: TEXT_SECONDARY, fontSize: 13, fontWeight: '700', marginBottom: 2 }}>Upcoming Games</Text>
      {visible.map((m: PlayerUpcomingMatch) => {
        const isHome = m.homeTeam === m.playerIplTeam
        const opp = isHome ? m.awayTeam : m.homeTeam
        const isNext = m.status === 'upcoming'
        const dateStr = m.startTimeUtc
          ? new Date(m.startTimeUtc).toLocaleString('en-US', {
              month: 'short', day: 'numeric',
              hour: 'numeric', minute: '2-digit',
              timeZoneName: 'short',
            })
          : new Date(m.matchDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        return (
          <View key={m.matchId} style={{
            backgroundColor: isNext ? INFO_BG : BG_PAGE,
            borderRadius: 12, borderWidth: 1,
            borderColor: isNext ? INFO_BORDER : BORDER_DEFAULT,
            padding: 12,
            flexDirection: 'row', alignItems: 'center', gap: 10,
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600' }}>
                {isHome ? 'vs' : '@'} {opp}
              </Text>
              <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, marginTop: 2 }}>{dateStr}</Text>
              {m.venue && <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11 }}>{m.venue}</Text>}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              {m.weekLabel && (
                <Text style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: '600' }}>{m.weekLabel}</Text>
              )}
              {m.matchNumber != null && (
                <Text style={{ color: TEXT_DISABLED, fontSize: 11 }}>M{m.matchNumber}</Text>
              )}
              {isNext && (
                <View style={{ backgroundColor: INFO_DARK, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>NEXT</Text>
                </View>
              )}
            </View>
          </View>
        )
      })}
      {hasMore && (
        <TouchableOpacity onPress={() => setExpanded(v => !v)} style={{ alignItems: 'center', paddingVertical: 6 }}>
          <Text style={{ color: PRIMARY, fontSize: 12, fontWeight: '600' }}>
            {expanded ? 'Show Less' : `See All (${matches.length})`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

function MatchHistory({ playerId, role }: { playerId: string; role: string }) {
  const { data: stats, isLoading, isError } = usePlayerStats(playerId)
  const [expanded, setExpanded] = useState(false)

  if (isLoading) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
        <ActivityIndicator color={PRIMARY} />
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
        <Text style={{ color: TEXT_DISABLED, fontSize: 14 }}>No match history yet</Text>
      </View>
    )
  }

  const visible = expanded ? stats : stats.slice(0, 2)
  const hasMore = stats.length > 2

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: TEXT_SECONDARY, fontSize: 13, fontWeight: '700', marginBottom: 2 }}>Match History</Text>
      {visible.map((s, i) => {
        const isHome = s.homeTeam === s.playerIplTeam
        const opp = s.homeTeam ? (isHome ? s.awayTeam : s.homeTeam) : null
        const dateStr = s.startTimeUtc
          ? new Date(s.startTimeUtc).toLocaleString('en-US', {
              month: 'short', day: 'numeric',
              hour: 'numeric', minute: '2-digit',
              timeZoneName: 'short',
            })
          : s.matchDate

        const { text: statusColor, bg: statusBg } = matchStatusColors(s.status)
        const statusLabel = s.status === 'live' ? 'LIVE' : s.status === 'completed' ? 'FINAL' : 'UPCOMING'

        const matchLabel = s.homeTeam
          ? `${isHome ? 'vs' : '@'} ${opp}`
          : s.matchId

      return (
          <View key={`${s.matchId}-${i}`} style={{
            backgroundColor: BG_PAGE, borderRadius: 12, borderWidth: 1,
            borderColor: BORDER_DEFAULT, padding: 12, gap: 6,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View style={{ backgroundColor: statusBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700' }}>{statusLabel}</Text>
                </View>
                <Text style={{ color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                  {matchLabel}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                {s.weekLabel && (
                  <Text style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: '600' }}>{s.weekLabel}</Text>
                )}
                {s.matchNumber != null && (
                  <Text style={{ color: TEXT_DISABLED, fontSize: 11 }}>M{s.matchNumber}</Text>
                )}
              </View>
            </View>

            <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11 }}>{dateStr}</Text>

            {s.status !== 'upcoming' ? (
              <View style={{ borderTopWidth: 1, borderTopColor: BORDER_DEFAULT, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: TEXT_SECONDARY, fontSize: 12, flex: 1, marginRight: 8 }}>{statLine(s, role)}</Text>
                <PointsValue
                  value={s.points}
                  stats={{ ...s, playerRole: role }}
                  style={{ color: s.points > 0 ? SUCCESS : TEXT_PLACEHOLDER, fontSize: 13, fontWeight: '700' }}
                >
                  {s.points > 0 ? `+${parseFloat(s.points.toString()).toFixed(1)}` : '—'}
                </PointsValue>
              </View>
            ) : (
              <View style={{ borderTopWidth: 1, borderTopColor: BORDER_DEFAULT, paddingTop: 8 }}>
                <Text style={{ color: TEXT_DISABLED, fontSize: 12 }}>Not played yet</Text>
              </View>
            )}
          </View>
        )
      })}
      {hasMore && (
        <TouchableOpacity onPress={() => setExpanded(v => !v)} style={{ alignItems: 'center', paddingVertical: 6 }}>
          <Text style={{ color: PRIMARY, fontSize: 12, fontWeight: '600' }}>
            {expanded ? 'Show Less' : `See All (${stats.length})`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export function PlayerDetailModal({ visible, player, currency = 'INR', onClose, playerId, onDrop, onAdd, addLabel = 'Add to Squad', alreadyOnTeam }: Props) {
  if (!player) return null

  const roleColor = ROLE_COLORS[player.role] ?? TEXT_MUTED
  const roleShort = ROLE_SHORT[player.role] ?? player.role
  const roleFull  = ROLE_FULL[player.role]  ?? player.role
  const isSold    = player.status === 'sold'

  const totalPts = player.total_points != null ? Number(player.total_points) : null
  const avgPts = (totalPts != null && player.team_games_played != null && player.team_games_played > 0)
    ? totalPts / player.team_games_played
    : null

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: BG_CARD }}>
        {/* Header */}
        <View style={{
          padding: 16, borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT,
          flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
        }}>
          <NavButton label="Close" onPress={onClose} />
        </View>

        {/* Body */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 20 }}>
          {/* Name + team */}
          <View style={{ gap: 4 }}>
            <Text style={{ color: TEXT_PRIMARY, fontSize: 26, fontWeight: '800' }}>{player.name}</Text>
            <Text style={{ color: TEXT_MUTED, fontSize: 15 }}>{player.ipl_team}</Text>
          </View>

          {/* Badges row */}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <View style={{ backgroundColor: roleColor + '20', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: roleColor, fontSize: 12, fontWeight: '700' }}>{roleShort}</Text>
            </View>
            {player.nationality && player.nationality !== 'Indian' && (
              <View style={{ backgroundColor: WARNING_BG, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: WARNING_DARK, fontSize: 12, fontWeight: '700' }}>OVERSEAS</Text>
              </View>
            )}
          </View>

          {/* Stats card */}
          <View style={{ backgroundColor: BG_PAGE, borderRadius: 14, borderWidth: 1, borderColor: BORDER_DEFAULT, flexDirection: 'row' }}>
            {[
              { label: 'Role', value: roleFull },
              { label: 'Total Pts', value: totalPts != null ? totalPts.toFixed(1) : '—' },
              { label: 'Avg Pts', value: avgPts != null ? avgPts.toFixed(1) : '—' },
            ].map(({ label, value }, i, arr) => (
              <View
                key={label}
                style={{
                  flex: 1, padding: 14, alignItems: 'center',
                  borderRightWidth: i < arr.length - 1 ? 1 : 0,
                  borderRightColor: BORDER_DEFAULT,
                }}
              >
                <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 14 }} numberOfLines={1} adjustsFontSizeToFit>
                  {value}
                </Text>
                <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, marginTop: 3 }}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Already on team notice */}
          {alreadyOnTeam && (
            <View style={{ backgroundColor: INFO_BG, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: INFO_BORDER }}>
              <Text style={{ color: INFO_DARK, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
                Already on your squad
              </Text>
            </View>
          )}

          {/* Upcoming games + match history (shown when playerId is provided) */}
          {playerId && <UpcomingGames playerId={playerId} />}
          {playerId && <MatchHistory playerId={playerId} role={player.role} />}
        </ScrollView>

        {/* Bottom action */}
        {onDrop && (
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: BORDER_DEFAULT }}>
            <TouchableOpacity
              onPress={onDrop}
              style={{ backgroundColor: PRIMARY_BG, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: PRIMARY_BORDER }}
            >
              <Text style={{ color: PRIMARY, fontWeight: '700', fontSize: 15 }}>Drop Player</Text>
            </TouchableOpacity>
          </View>
        )}

        {onAdd && !alreadyOnTeam && !isSold && (
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: BORDER_DEFAULT }}>
            <TouchableOpacity
              onPress={onAdd}
              style={{ backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>{addLabel}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  )
}
