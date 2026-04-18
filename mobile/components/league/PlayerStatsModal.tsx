import { View, Text, Modal, ScrollView, ActivityIndicator } from 'react-native'
import { NavButton } from '../ui/NavButton'
import { PointsValue } from '../ui/PointsBreakdown'
import { usePlayerStats } from '../../hooks/useLineup'
import type { PlayerMatchStat } from '../../hooks/useLineup'

interface Props {
  playerId: string | null
  playerName: string
  playerRole: string
  playerTeam: string
  onClose: () => void
}

const roleLabels: Record<string, string> = {
  batsman: 'BAT',
  bowler: 'BOW',
  all_rounder: 'AR',
  wicket_keeper: 'WK',
}

function statLine(s: PlayerMatchStat, _role: string): string {
  const parts: string[] = []

  if (s.ballsFaced > 0 || s.runsScored > 0) {
    parts.push(`${s.runsScored}(${s.ballsFaced})`)
    if (s.fours > 0) parts.push(`${s.fours}×4`)
    if (s.sixes > 0) parts.push(`${s.sixes}×6`)
  }
  if (s.ballsBowled > 0) {
    const overs = `${Math.floor(s.ballsBowled / 6)}.${s.ballsBowled % 6}`
    parts.push(`${s.wicketsTaken}/${s.runsConceded} (${overs}ov)`)
    if (s.maidens > 0) parts.push(`${s.maidens}m`)
  }
  if (s.catches > 0) parts.push(`${s.catches}c`)
  if (s.stumpings > 0) parts.push(`${s.stumpings}st`)
  if (s.runOutsDirect > 0 || s.runOutsIndirect > 0)
    parts.push(`${s.runOutsDirect + s.runOutsIndirect}ro`)

  return parts.join('  ') || 'Did not bat/bowl'
}

export function PlayerStatsModal({ playerId, playerName, playerRole, playerTeam, onClose }: Props) {
  const { data: stats, isLoading } = usePlayerStats(playerId)

  return (
    <Modal visible={!!playerId} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        {/* Header */}
        <View style={{
          backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
          paddingHorizontal: 16, paddingVertical: 14,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
        }}>
          <NavButton label="Close" onPress={onClose} />
        </View>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#dc2626" />
          </View>
        ) : !stats || stats.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#d1d5db', fontSize: 15 }}>No match history yet</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            <View style={{ gap: 2, marginBottom: 6 }}>
              <Text style={{ color: '#111827', fontWeight: '800', fontSize: 22 }} numberOfLines={1}>{playerName}</Text>
              <Text style={{ color: '#9ca3af', fontSize: 13 }}>
                {roleLabels[playerRole] ?? playerRole} · {playerTeam}
              </Text>
            </View>
            {stats.map((s, i) => {
              const opp = s.homeTeam === s.playerIplTeam ? s.awayTeam : s.homeTeam
              const isHome = s.homeTeam === s.playerIplTeam
              const dateStr = s.startTimeUtc
                ? new Date(s.startTimeUtc).toLocaleString('en-US', {
                    month: 'short', day: 'numeric',
                    hour: 'numeric', minute: '2-digit',
                    timeZoneName: 'short',
                  })
                : s.matchDate

              const statusColor = s.status === 'live' ? '#b45309' : s.status === 'completed' ? '#16a34a' : '#6b7280'
              const statusBg = s.status === 'live' ? '#fef9c3' : s.status === 'completed' ? '#f0fdf4' : '#f3f4f6'
              const statusLabel = s.status === 'live' ? 'LIVE' : s.status === 'completed' ? 'FINAL' : 'UPCOMING'

              return (
                <View key={`${s.matchId}-${i}`} style={{
                  backgroundColor: 'white', borderRadius: 14, borderWidth: 1,
                  borderColor: '#f3f4f6', padding: 14, gap: 8,
                }}>
                  {/* Match header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <View style={{ backgroundColor: statusBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700' }}>{statusLabel}</Text>
                      </View>
                      <Text style={{ color: '#111827', fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                        {isHome ? 'vs' : '@'} {opp}
                      </Text>
                    </View>
                    {s.matchNumber != null && (
                      <Text style={{ color: '#d1d5db', fontSize: 11 }}>M{s.matchNumber}</Text>
                    )}
                  </View>

                  <Text style={{ color: '#9ca3af', fontSize: 11 }}>{dateStr}</Text>

                  {/* Stats */}
                  {s.status !== 'upcoming' ? (
                    <View style={{ borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#374151', fontSize: 12 }}>{statLine(s, playerRole)}</Text>
                      <PointsValue
                        value={s.points}
                        stats={{ ...s, playerRole }}
                        style={{ color: s.points > 0 ? '#16a34a' : '#9ca3af', fontSize: 13, fontWeight: '700' }}
                      >
                        {s.points > 0 ? `+${Math.round(s.points)}` : '—'}
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
          </ScrollView>
        )}
      </View>
    </Modal>
  )
}
