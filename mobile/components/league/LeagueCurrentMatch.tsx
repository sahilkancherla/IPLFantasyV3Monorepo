import { View, Text } from 'react-native'
import { PointsValue } from '../ui/PointsBreakdown'
import type { MatchPlayer, CurrentMatchInfo, Matchup } from '../../hooks/useMatchup'

interface Props {
  leagueName: string
  currentMatch: CurrentMatchInfo
  matchup: Matchup
  myPlayers: MatchPlayer[]
  oppPlayers: MatchPlayer[]
  userId: string
}

const ROLE_SHORT: Record<string, string> = {
  batsman: 'BAT', bowler: 'BOW', all_rounder: 'AR', wicket_keeper: 'WK',
}

function statLine(p: MatchPlayer): string {
  const parts: string[] = []

  if (p.ballsFaced > 0 || p.runsScored > 0) {
    parts.push(`${p.runsScored}(${p.ballsFaced})`)
    if (p.fours > 0) parts.push(`${p.fours}×4`)
    if (p.sixes > 0) parts.push(`${p.sixes}×6`)
  }
  if (p.ballsBowled > 0) {
    const overs = `${Math.floor(p.ballsBowled / 6)}.${p.ballsBowled % 6}`
    parts.push(`${p.wicketsTaken}/${p.runsConceded} (${overs}ov)`)
    if (p.maidens > 0) parts.push(`${p.maidens}m`)
  }
  if (p.catches > 0) parts.push(`${p.catches}c`)
  if (p.stumpings > 0) parts.push(`${p.stumpings}st`)
  if (p.runOutsDirect > 0 || p.runOutsIndirect > 0) parts.push(`${p.runOutsDirect + p.runOutsIndirect}ro`)
  return parts.join('  ')
}

function PlayerRow({ p, isLiveOrDone }: { p: MatchPlayer; isLiveOrDone: boolean }) {
  const roleShort = ROLE_SHORT[p.playerRole] ?? p.playerRole.toUpperCase()
  const stats = isLiveOrDone ? statLine(p) : null
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: '#dc2626', fontSize: 10, fontWeight: '700', width: 28 }}>{roleShort}</Text>
        <Text style={{ flex: 1, color: '#111827', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
          {p.playerName}
        </Text>
        <PointsValue
          value={p.points}
          stats={{ ...p, playerRole: p.playerRole }}
          playerName={p.playerName}
          style={{ color: p.points > 0 ? '#16a34a' : '#9ca3af', fontSize: 12, fontWeight: '700' }}
        >
          {p.points > 0 ? `+${p.points.toFixed(1)}` : '—'}
        </PointsValue>
      </View>
      {stats ? (
        <Text style={{ color: '#9ca3af', fontSize: 11, paddingLeft: 28 }}>{stats}</Text>
      ) : null}
    </View>
  )
}

export function LeagueCurrentMatch({ leagueName, currentMatch, matchup, myPlayers, oppPlayers, userId }: Props) {
  const isHome = matchup.home_user === userId
  const myName = isHome
    ? (matchup.home_full_name || matchup.home_username)
    : (matchup.away_full_name || matchup.away_username)
  const oppName = isHome
    ? (matchup.away_full_name || matchup.away_username)
    : (matchup.home_full_name || matchup.home_username)

  const isLiveOrDone = currentMatch.status === 'live' || currentMatch.status === 'completed'
  const statusBg = currentMatch.status === 'live' ? '#fef9c3' : currentMatch.status === 'completed' ? '#f0fdf4' : '#f3f4f6'
  const statusColor = currentMatch.status === 'live' ? '#b45309' : currentMatch.status === 'completed' ? '#16a34a' : '#6b7280'
  const statusLabel = currentMatch.status === 'live' ? 'LIVE' : currentMatch.status === 'completed' ? 'FINAL' : 'UPCOMING'

  const dateStr = currentMatch.start_time_utc
    ? new Date(currentMatch.start_time_utc).toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
        timeZoneName: 'short',
      })
    : null

  const myTotal = myPlayers.reduce((s, p) => s + p.points, 0)
  const oppTotal = oppPlayers.reduce((s, p) => s + p.points, 0)

  return (
    <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}>
      {/* Card header */}
      <View style={{ backgroundColor: '#1f2937', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{leagueName}</Text>
        <View style={{ backgroundColor: statusBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ color: statusColor, fontSize: 11, fontWeight: '700' }}>{statusLabel}</Text>
        </View>
      </View>

      {/* Match teams row */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, color: '#111827', fontSize: 13, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>
          {currentMatch.home_team}
        </Text>
        <Text style={{ color: '#d1d5db', fontSize: 11, fontWeight: '700', paddingHorizontal: 8 }}>vs</Text>
        <Text style={{ flex: 1, color: '#111827', fontSize: 13, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>
          {currentMatch.away_team}
        </Text>
        {currentMatch.match_number != null && (
          <Text style={{ color: '#d1d5db', fontSize: 11, position: 'absolute', right: 16 }}>
            M{currentMatch.match_number}
          </Text>
        )}
      </View>

      {dateStr && (
        <Text style={{ color: '#9ca3af', fontSize: 11, textAlign: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
          {dateStr}
        </Text>
      )}

      {/* Players */}
      {myPlayers.length === 0 && oppPlayers.length === 0 ? (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <Text style={{ color: '#d1d5db', fontSize: 13 }}>No lineup players in this match</Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
          {myPlayers.length > 0 && (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: '#dc2626', fontSize: 10, fontWeight: '700' }}>{myName} ★</Text>
                {isLiveOrDone && myTotal > 0 && (
                  <Text style={{ color: '#16a34a', fontSize: 12, fontWeight: '700' }}>+{myTotal.toFixed(1)} pts</Text>
                )}
              </View>
              {myPlayers.map(p => (
                <PlayerRow key={p.playerId} p={p} isLiveOrDone={isLiveOrDone} />
              ))}
            </View>
          )}

          {myPlayers.length > 0 && oppPlayers.length > 0 && (
            <View style={{ height: 1, backgroundColor: '#f3f4f6' }} />
          )}

          {oppPlayers.length > 0 && (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: '#6b7280', fontSize: 10, fontWeight: '700' }}>{oppName}</Text>
                {isLiveOrDone && oppTotal > 0 && (
                  <Text style={{ color: '#16a34a', fontSize: 12, fontWeight: '700' }}>+{oppTotal.toFixed(1)} pts</Text>
                )}
              </View>
              {oppPlayers.map(p => (
                <PlayerRow key={p.playerId} p={p} isLiveOrDone={isLiveOrDone} />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  )
}
