import { useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import type { RosterEntry } from '../../hooks/useTeam'
import { formatCurrency, type Currency } from '../../lib/currency'
import { PlayerDetailModal } from '../league/PlayerDetailModal'
import {
  TEXT_PRIMARY, TEXT_MUTED, TEXT_PLACEHOLDER, TEXT_DISABLED,
  BORDER_DEFAULT,
  BG_CARD, BG_PAGE,
  roleColors,
} from '../../constants/colors'

interface SquadGridProps {
  roster: RosterEntry[]
  currency?: Currency
  onDrop?: (player: RosterEntry) => void
}

const ROLE_SHORT: Record<string, string> = {
  batsman: 'BAT', bowler: 'BOW', all_rounder: 'AR', wicket_keeper: 'WK',
}
const ROLE_COLORS: Record<string, string> = roleColors
const ROLE_ORDER = ['batsman', 'wicket_keeper', 'all_rounder', 'bowler']
const ROLE_GROUP_LABELS: Record<string, string> = {
  batsman: 'Batsmen', bowler: 'Bowlers', all_rounder: 'All-Rounders', wicket_keeper: 'Wicket Keepers',
}

export function SquadGrid({ roster, currency = 'lakhs', onDrop }: SquadGridProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<RosterEntry | null>(null)

  if (roster.length === 0) {
    return (
      <View style={{ paddingVertical: 48, alignItems: 'center' }}>
        <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 15 }}>No players acquired yet</Text>
      </View>
    )
  }

  const byRole = ROLE_ORDER.reduce<Record<string, RosterEntry[]>>((acc, role) => {
    acc[role] = roster.filter(r => r.player_role === role)
    return acc
  }, {})

  const otherRoles = [...new Set(roster.map(r => r.player_role).filter(r => !ROLE_ORDER.includes(r)))]
  const allGroups = [...ROLE_ORDER, ...otherRoles].filter(role => {
    const group = byRole[role] ?? roster.filter(r => r.player_role === role)
    return group.length > 0
  })

  return (
    <>
      <View style={{ backgroundColor: BG_CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER_DEFAULT, overflow: 'hidden' }}>
        {allGroups.map((role, groupIdx) => {
          const group = byRole[role] ?? roster.filter(r => r.player_role === role)
          const roleColor = ROLE_COLORS[role] ?? TEXT_MUTED
          const roleShort = ROLE_SHORT[role] ?? role.toUpperCase()
          const groupLabel = ROLE_GROUP_LABELS[role] ?? role

          return (
            <View key={role}>
              {/* Role group header */}
              <View style={{
                backgroundColor: BG_PAGE,
                paddingHorizontal: 16, paddingVertical: 7,
                borderTopWidth: groupIdx === 0 ? 0 : 1, borderTopColor: BORDER_DEFAULT,
                flexDirection: 'row', alignItems: 'center', gap: 8,
              }}>
                <View style={{ backgroundColor: roleColor + '20', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: roleColor, fontSize: 10, fontWeight: '700' }}>{roleShort}</Text>
                </View>
                <Text style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: '600' }}>{groupLabel}</Text>
                <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, marginLeft: 'auto' }}>
                  {group.length}
                </Text>
              </View>

              {group.map((item) => {
                const avgPts = item.team_games_played > 0 ? item.total_points / item.team_games_played : null
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setSelectedPlayer(item)}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingLeft: 16, paddingRight: 12,
                      borderTopWidth: 1, borderTopColor: BORDER_DEFAULT,
                    }}
                  >
                    <View style={{ flex: 1, paddingVertical: 11 }}>
                      <Text style={{ color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                        {item.player_name}
                      </Text>
                      <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, marginTop: 1 }}>{item.player_ipl_team}</Text>
                    </View>
                    {avgPts != null ? (
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 13 }}>{avgPts.toFixed(1)}</Text>
                        <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 9, fontWeight: '500' }}>avg pts</Text>
                      </View>
                    ) : (
                      <Text style={{ color: TEXT_DISABLED, fontSize: 12 }}>—</Text>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          )
        })}
      </View>

      <PlayerDetailModal
        visible={selectedPlayer !== null}
        player={selectedPlayer ? {
          name: selectedPlayer.player_name,
          ipl_team: selectedPlayer.player_ipl_team,
          role: selectedPlayer.player_role,
          total_points: selectedPlayer.total_points,
          team_games_played: selectedPlayer.team_games_played,
        } : null}
        playerId={selectedPlayer?.player_id}
        currency={currency}
        onClose={() => setSelectedPlayer(null)}
        onDrop={onDrop && selectedPlayer ? () => {
          const p = selectedPlayer
          setSelectedPlayer(null)
          setTimeout(() => onDrop(p), 300)
        } : undefined}
      />
    </>
  )
}
