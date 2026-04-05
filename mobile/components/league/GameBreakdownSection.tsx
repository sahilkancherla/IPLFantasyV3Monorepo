import { View, Text } from 'react-native'
import { useGameBreakdown } from '../../hooks/useLineup'
import type { GameBreakdownData, GamePlayer } from '../../hooks/useLineup'

const ROLE_SHORT: Record<string, string> = {
  batsman: 'BAT', wicket_keeper: 'WK', all_rounder: 'AR', bowler: 'BOW', flex: 'FLX',
}

function abbrevName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return name
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
}

interface Props {
  leagueId: string
  weekNum: number
  opponentId: string
  myName: string
  oppName: string
}

function PlayerRow({ player }: { player: GamePlayer }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}>
      <View style={{
        width: 26, height: 16, borderRadius: 3,
        backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center',
        marginRight: 6, flexShrink: 0,
      }}>
        <Text style={{ color: '#9ca3af', fontSize: 8, fontWeight: '700' }}>
          {ROLE_SHORT[player.slotRole] ?? player.slotRole}
        </Text>
      </View>
      <Text style={{ flex: 1, color: '#374151', fontSize: 12, fontWeight: '500' }} numberOfLines={1}>
        {abbrevName(player.playerName)}
      </Text>
      <Text style={{
        color: player.points > 0 ? '#111827' : '#d1d5db',
        fontSize: 12, fontWeight: player.points > 0 ? '700' : '400',
        marginLeft: 6, minWidth: 32, textAlign: 'right',
      }}>
        {player.points > 0 ? player.points.toFixed(1) : '—'}
      </Text>
    </View>
  )
}

function formatMatchTime(isoStr: string | null, matchDate: string): string {
  const src = isoStr ?? matchDate
  const d = new Date(src)
  if (isNaN(d.getTime())) return matchDate
  if (isoStr) {
    return d.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
      timeZoneName: 'short',
    })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function GameCard({ game, myName, oppName }: { game: GameBreakdownData; myName: string; oppName: string }) {
  const myWins = game.isCompleted && game.myPoints > game.oppPoints
  const oppWins = game.isCompleted && game.oppPoints > game.myPoints

  return (
    <View style={{
      backgroundColor: 'white', borderRadius: 14,
      borderWidth: 1, borderColor: game.isCompleted ? '#e5e7eb' : '#dbeafe',
      overflow: 'hidden', marginBottom: 10,
    }}>
      {/* Match header */}
      <View style={{
        backgroundColor: game.isCompleted ? '#1f2937' : '#1d4ed8',
        paddingHorizontal: 14, paddingVertical: 9,
        flexDirection: 'row', alignItems: 'center', gap: 8,
      }}>
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 12, flex: 1 }} numberOfLines={1}>
          {game.homeTeam} vs {game.awayTeam}
        </Text>
        {game.matchNumber != null && (
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, flexShrink: 0 }}>
            M{game.matchNumber}
          </Text>
        )}
        <View style={{
          borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2, flexShrink: 0,
          backgroundColor: game.isCompleted ? '#4b5563' : 'rgba(255,255,255,0.18)',
        }}>
          <Text style={{ color: 'white', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 }}>
            {game.isCompleted ? 'FINAL' : 'UPCOMING'}
          </Text>
        </View>
      </View>

      {/* Time row for pending games */}
      {!game.isCompleted && (
        <View style={{
          paddingHorizontal: 14, paddingVertical: 7,
          backgroundColor: '#eff6ff', borderBottomWidth: 1, borderBottomColor: '#dbeafe',
        }}>
          <Text style={{ color: '#3b82f6', fontSize: 12, fontWeight: '500' }}>
            {formatMatchTime(game.startTimeUtc, game.matchDate)}
          </Text>
        </View>
      )}

      {/* Scores row */}
      <View style={{
        flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10,
        borderBottomWidth: game.myPlayers.length > 0 || game.oppPlayers.length > 0 ? 1 : 0,
        borderBottomColor: '#f3f4f6', gap: 12, alignItems: 'center',
      }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Text style={{
            color: myWins ? '#dc2626' : game.isCompleted ? '#374151' : '#9ca3af',
            fontWeight: '800', fontSize: 22,
          }}>
            {game.isCompleted ? game.myPoints.toFixed(1) : '—'}
          </Text>
          {game.isCompleted && <Text style={{ color: '#9ca3af', fontSize: 11 }}>pts</Text>}
          <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '600', marginLeft: 2 }} numberOfLines={1}>
            {abbrevName(myName)}
          </Text>
        </View>
        <Text style={{ color: '#e5e7eb', fontWeight: '700', fontSize: 13 }}>vs</Text>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 4, justifyContent: 'flex-end' }}>
          <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
            {abbrevName(oppName)}
          </Text>
          <Text style={{
            color: oppWins ? '#111827' : game.isCompleted ? '#374151' : '#9ca3af',
            fontWeight: '800', fontSize: 22,
          }}>
            {game.isCompleted ? game.oppPoints.toFixed(1) : '—'}
          </Text>
          {game.isCompleted && <Text style={{ color: '#9ca3af', fontSize: 11 }}>pts</Text>}
        </View>
      </View>

      {/* Players columns */}
      {(game.myPlayers.length > 0 || game.oppPlayers.length > 0) && (
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, padding: 10, borderRightWidth: 1, borderRightColor: '#f3f4f6' }}>
            {game.myPlayers.length === 0 ? (
              <Text style={{ color: '#d1d5db', fontSize: 11, textAlign: 'center', paddingVertical: 4 }}>
                No starters
              </Text>
            ) : game.myPlayers.map(p => (
              <PlayerRow key={p.playerId} player={p} />
            ))}
          </View>
          <View style={{ flex: 1, padding: 10 }}>
            {game.oppPlayers.length === 0 ? (
              <Text style={{ color: '#d1d5db', fontSize: 11, textAlign: 'center', paddingVertical: 4 }}>
                No starters
              </Text>
            ) : game.oppPlayers.map(p => (
              <PlayerRow key={p.playerId} player={p} />
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
      <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
      <Text style={{ color: '#9ca3af', fontSize: 11 }}>{count}</Text>
    </View>
  )
}

export function GameBreakdownSection({ leagueId, weekNum, opponentId, myName, oppName }: Props) {
  const { data, isLoading } = useGameBreakdown(leagueId, weekNum, opponentId)
  const games = data?.games ?? []

  if (isLoading) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <Text style={{ color: '#9ca3af', fontSize: 13 }}>Loading games…</Text>
      </View>
    )
  }

  if (games.length === 0) {
    return (
      <View style={{
        backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#f3f4f6',
        padding: 20, alignItems: 'center',
      }}>
        <Text style={{ color: '#9ca3af', fontSize: 13 }}>No matches scheduled this week</Text>
      </View>
    )
  }

  const completed = games.filter(g => g.isCompleted)
  const upcoming = games.filter(g => !g.isCompleted)

  return (
    <View>
      {completed.length > 0 && (
        <View style={{ marginBottom: upcoming.length > 0 ? 6 : 0 }}>
          <SectionLabel label="Finished" count={completed.length} />
          {completed.map(game => (
            <GameCard key={game.matchId} game={game} myName={myName} oppName={oppName} />
          ))}
        </View>
      )}
      {upcoming.length > 0 && (
        <View>
          <SectionLabel label="Upcoming" count={upcoming.length} />
          {upcoming.map(game => (
            <GameCard key={game.matchId} game={game} myName={myName} oppName={oppName} />
          ))}
        </View>
      )}
    </View>
  )
}
