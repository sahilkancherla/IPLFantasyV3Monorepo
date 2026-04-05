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

function GameCard({ game, myName, oppName }: { game: GameBreakdownData; myName: string; oppName: string }) {
  const myWins = game.myPoints > game.oppPoints
  const oppWins = game.oppPoints > game.myPoints

  return (
    <View style={{
      backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#f3f4f6',
      overflow: 'hidden', marginBottom: 10,
    }}>
      {/* Match header */}
      <View style={{
        backgroundColor: '#1f2937', paddingHorizontal: 14, paddingVertical: 9,
        flexDirection: 'row', alignItems: 'center', gap: 8,
      }}>
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 12, flex: 1 }} numberOfLines={1}>
          {game.homeTeam} vs {game.awayTeam}
        </Text>
        {game.matchNumber != null && (
          <Text style={{ color: '#9ca3af', fontSize: 11, flexShrink: 0 }}>M{game.matchNumber}</Text>
        )}
        <Text style={{ color: '#9ca3af', fontSize: 11, flexShrink: 0 }}>
          {new Date(game.matchDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </Text>
        {game.isCompleted && (
          <View style={{ backgroundColor: '#374151', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0 }}>
            <Text style={{ color: '#9ca3af', fontSize: 10, fontWeight: '600' }}>FT</Text>
          </View>
        )}
      </View>

      {/* Scores row */}
      <View style={{
        flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 12, alignItems: 'center',
      }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Text style={{ color: myWins ? '#dc2626' : '#6b7280', fontWeight: '800', fontSize: 22 }}>
            {game.myPoints.toFixed(1)}
          </Text>
          <Text style={{ color: '#9ca3af', fontSize: 11 }}>pts</Text>
          <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '600', marginLeft: 2 }} numberOfLines={1}>
            {abbrevName(myName)}
          </Text>
        </View>
        <Text style={{ color: '#e5e7eb', fontWeight: '700', fontSize: 13 }}>vs</Text>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 4, justifyContent: 'flex-end' }}>
          <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
            {abbrevName(oppName)}
          </Text>
          <Text style={{ color: oppWins ? '#111827' : '#6b7280', fontWeight: '800', fontSize: 22 }}>
            {game.oppPoints.toFixed(1)}
          </Text>
          <Text style={{ color: '#9ca3af', fontSize: 11 }}>pts</Text>
        </View>
      </View>

      {/* Players columns */}
      {(game.myPlayers.length > 0 || game.oppPlayers.length > 0) ? (
        <View style={{ flexDirection: 'row' }}>
          {/* My players */}
          <View style={{ flex: 1, padding: 10, borderRightWidth: 1, borderRightColor: '#f3f4f6' }}>
            {game.myPlayers.length === 0 ? (
              <Text style={{ color: '#d1d5db', fontSize: 11, textAlign: 'center', paddingVertical: 4 }}>
                No starters
              </Text>
            ) : game.myPlayers.map(p => (
              <PlayerRow key={p.playerId} player={p} />
            ))}
          </View>
          {/* Opp players */}
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
      ) : (
        <View style={{ padding: 14, alignItems: 'center' }}>
          <Text style={{ color: '#d1d5db', fontSize: 12 }}>No started players in this match</Text>
        </View>
      )}
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

  return (
    <View>
      {games.map(game => (
        <GameCard key={game.matchId} game={game} myName={myName} oppName={oppName} />
      ))}
    </View>
  )
}
