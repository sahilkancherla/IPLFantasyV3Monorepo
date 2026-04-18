import { View, Text } from 'react-native'
import { useGameBreakdown } from '../../hooks/useLineup'
import type { GameBreakdownData, GamePlayer } from '../../hooks/useLineup'
import { PointsValue } from '../ui/PointsBreakdown'
import {
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, TEXT_PLACEHOLDER, TEXT_DISABLED,
  BORDER_DEFAULT, BORDER_MEDIUM,
  BG_CARD, BG_SUBTLE,
  PRIMARY,
  WARNING_DARK,
  INFO_DARK, INFO_BG, INFO_MID, INFO_SUBTLE,
  BG_DARK_HEADER,
} from '../../constants/colors'

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
        backgroundColor: BG_SUBTLE, alignItems: 'center', justifyContent: 'center',
        marginRight: 6, flexShrink: 0,
      }}>
        <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 8, fontWeight: '700' }}>
          {ROLE_SHORT[player.slotRole] ?? player.slotRole}
        </Text>
      </View>
      <Text style={{ flex: 1, color: TEXT_SECONDARY, fontSize: 12, fontWeight: '500' }} numberOfLines={1}>
        {abbrevName(player.playerName)}
      </Text>
      <PointsValue
        value={player.points}
        stats={player}
        playerName={player.playerName}
        style={{
          color: player.points > 0 ? TEXT_PRIMARY : TEXT_DISABLED,
          fontSize: 12, fontWeight: player.points > 0 ? '700' : '400',
          marginLeft: 6, minWidth: 32, textAlign: 'right',
        }}
      />
    </View>
  )
}

function formatMatchTime(isoStr: string | null, matchDate: string): string {
  const src = isoStr ?? matchDate
  const d = new Date(src)
  if (isNaN(d.getTime())) return matchDate
  if (isoStr) {
    return d.toLocaleString('en-US', {
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

  const headerBg = game.status === 'live' ? WARNING_DARK
    : game.isCompleted ? BG_DARK_HEADER
    : game.status === 'upcoming' ? INFO_DARK
    : TEXT_SECONDARY

  return (
    <View style={{
      backgroundColor: BG_CARD, borderRadius: 14,
      borderWidth: 1, borderColor: game.isCompleted ? BORDER_MEDIUM : INFO_SUBTLE,
      overflow: 'hidden', marginBottom: 10,
    }}>
      {/* Match header */}
      <View style={{
        backgroundColor: headerBg,
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
          backgroundColor: 'rgba(255,255,255,0.18)',
        }}>
          <Text style={{ color: 'white', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 }}>
            {game.status === 'live' ? 'LIVE' : game.isCompleted ? 'FINAL' : game.status === 'upcoming' ? 'NEXT' : 'UPCOMING'}
          </Text>
        </View>
      </View>

      {/* Time row for pending games */}
      {!game.isCompleted && (
        <View style={{
          paddingHorizontal: 14, paddingVertical: 7,
          backgroundColor: INFO_BG, borderBottomWidth: 1, borderBottomColor: INFO_SUBTLE,
        }}>
          <Text style={{ color: INFO_MID, fontSize: 12, fontWeight: '500' }}>
            {formatMatchTime(game.startTimeUtc, game.matchDate)}
          </Text>
        </View>
      )}

      {/* Scores row */}
      <View style={{
        flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10,
        borderBottomWidth: game.myPlayers.length > 0 || game.oppPlayers.length > 0 ? 1 : 0,
        borderBottomColor: BORDER_DEFAULT, gap: 12, alignItems: 'center',
      }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Text style={{
            color: myWins ? PRIMARY : game.isCompleted ? TEXT_SECONDARY : TEXT_PLACEHOLDER,
            fontWeight: '800', fontSize: 22,
          }}>
            {game.isCompleted ? Math.round(game.myPoints) : '—'}
          </Text>
          {game.isCompleted && <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11 }}>pts</Text>}
          <Text style={{ color: PRIMARY, fontSize: 11, fontWeight: '600', marginLeft: 2 }} numberOfLines={1}>
            {abbrevName(myName)}
          </Text>
        </View>
        <Text style={{ color: BORDER_MEDIUM, fontWeight: '700', fontSize: 13 }}>vs</Text>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 4, justifyContent: 'flex-end' }}>
          <Text style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
            {abbrevName(oppName)}
          </Text>
          <Text style={{
            color: oppWins ? TEXT_PRIMARY : game.isCompleted ? TEXT_SECONDARY : TEXT_PLACEHOLDER,
            fontWeight: '800', fontSize: 22,
          }}>
            {game.isCompleted ? Math.round(game.oppPoints) : '—'}
          </Text>
          {game.isCompleted && <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11 }}>pts</Text>}
        </View>
      </View>

      {/* Players columns */}
      {(() => {
        const myStarters = game.myPlayers.filter(p => p.slotRole !== 'bench')
        const oppStarters = game.oppPlayers.filter(p => p.slotRole !== 'bench')
        return (myStarters.length > 0 || oppStarters.length > 0) && (
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, padding: 10, borderRightWidth: 1, borderRightColor: BORDER_DEFAULT }}>
              {myStarters.length === 0 ? (
                <Text style={{ color: TEXT_DISABLED, fontSize: 11, textAlign: 'center', paddingVertical: 4 }}>
                  No starters
                </Text>
              ) : myStarters.map(p => (
                <PlayerRow key={p.playerId} player={p} />
              ))}
            </View>
            <View style={{ flex: 1, padding: 10 }}>
              {oppStarters.length === 0 ? (
                <Text style={{ color: TEXT_DISABLED, fontSize: 11, textAlign: 'center', paddingVertical: 4 }}>
                  No starters
                </Text>
              ) : oppStarters.map(p => (
                <PlayerRow key={p.playerId} player={p} />
              ))}
            </View>
          </View>
        )
      })()}
    </View>
  )
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
      <Text style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: BORDER_MEDIUM }} />
      <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11 }}>{count}</Text>
    </View>
  )
}

/** Render-only version — accepts pre-fetched games */
export function GameBreakdownList({ games, myName, oppName, isLoading }: {
  games: GameBreakdownData[]
  myName: string
  oppName: string
  isLoading?: boolean
}) {
  if (isLoading) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 13 }}>Loading games…</Text>
      </View>
    )
  }
  if (games.length === 0) {
    return (
      <View style={{
        backgroundColor: BG_CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER_DEFAULT,
        padding: 20, alignItems: 'center',
      }}>
        <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 13 }}>No matches scheduled this week</Text>
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
          {completed.map(game => <GameCard key={game.matchId} game={game} myName={myName} oppName={oppName} />)}
        </View>
      )}
      {upcoming.length > 0 && (
        <View>
          <SectionLabel label="Upcoming" count={upcoming.length} />
          {upcoming.map(game => <GameCard key={game.matchId} game={game} myName={myName} oppName={oppName} />)}
        </View>
      )}
    </View>
  )
}

export function GameBreakdownSection({ leagueId, weekNum, opponentId, myName, oppName }: Props) {
  const { data, isLoading } = useGameBreakdown(leagueId, weekNum, opponentId)
  return <GameBreakdownList games={data?.games ?? []} myName={myName} oppName={oppName} isLoading={isLoading} />
}
