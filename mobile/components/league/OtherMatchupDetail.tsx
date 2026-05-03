import { useCallback } from 'react'
import { RefreshControl } from 'react-native'
import { useUserLineup, useMatchupBreakdown } from '../../hooks/useLineup'
import { useWeekMatches } from '../../hooks/useMatchup'
import type { Matchup, IplWeek } from '../../hooks/useMatchup'
import { ROLE_ORDER } from './LineupCard'
import { useAllTeams } from '../../hooks/useTeam'
import { MatchupView } from './MatchupView'
import { PRIMARY_SOFT } from '../../constants/colors'

function sortByRole<T extends { slot_role?: string; playerRole?: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) =>
    (ROLE_ORDER[a.slot_role ?? a.playerRole ?? ''] ?? 5) -
    (ROLE_ORDER[b.slot_role ?? b.playerRole ?? ''] ?? 5)
  )
}

interface Props {
  matchup: Matchup
  week: IplWeek
  leagueId: string
  width: number
}

export function OtherMatchupDetail({ matchup, week, leagueId, width }: Props) {
  const homeName = matchup.home_team_name || matchup.home_full_name || matchup.home_username
  const homeUsername = matchup.home_full_name
  const awayName = matchup.away_team_name || matchup.away_full_name || matchup.away_username
  const awayUsername = matchup.away_full_name
  const homePts = parseFloat(String(matchup.home_points)) || 0
  const awayPts = parseFloat(String(matchup.away_points)) || 0
  const isCompleted = matchup.is_final || (week.window_end ? new Date(week.window_end) < new Date() : false)
  const hasPoints = homePts > 0 || awayPts > 0 || matchup.is_final
  const isLive = !isCompleted && hasPoints

  const { data: weekMatches, refetch: refetchWeekMatches } = useWeekMatches(week.week_num)
  const { data: homeLineupData, refetch: refetchHomeLineup } = useUserLineup(leagueId, matchup.home_user, week.week_num)
  const { data: awayLineupData, refetch: refetchAwayLineup } = useUserLineup(leagueId, matchup.away_user, week.week_num)
  const homeLineup = sortByRole(homeLineupData?.lineup ?? [])
  const awayLineup = sortByRole(awayLineupData?.lineup ?? [])
  const homeLineupLoading = homeLineupData === undefined
  const awayLineupLoading = awayLineupData === undefined

  const { data: allRosters } = useAllTeams(leagueId)
  const homeStartingIds = new Set(homeLineup.map(e => e.player_id))
  const awayStartingIds = new Set(awayLineup.map(e => e.player_id))
  const homeBench = (allRosters ?? [])
    .filter(r => r.user_id === matchup.home_user && !homeStartingIds.has(r.player_id))
    .map(r => ({ player_id: r.player_id, player_name: r.player_name, player_ipl_team: r.player_ipl_team, player_role: r.player_role, player_image_url: r.player_image_url }))
  const awayBench = (allRosters ?? [])
    .filter(r => r.user_id === matchup.away_user && !awayStartingIds.has(r.player_id))
    .map(r => ({ player_id: r.player_id, player_name: r.player_name, player_ipl_team: r.player_ipl_team, player_role: r.player_role, player_image_url: r.player_image_url }))

  const { data: breakdownData, refetch: refetchBreakdown, isRefetching } = useMatchupBreakdown(
    leagueId, week.week_num, matchup.home_user, matchup.away_user
  )
  const breakdownByMatchId = new Map(
    (breakdownData?.games ?? []).map(g => [g.matchId, g])
  )

  const onRefresh = useCallback(() => {
    refetchWeekMatches()
    refetchHomeLineup()
    refetchAwayLineup()
    refetchBreakdown()
  }, [refetchWeekMatches, refetchHomeLineup, refetchAwayLineup, refetchBreakdown])

  return (
    <MatchupView
      week={week}
      myName={homeName}
      myUsername={homeUsername}
      oppName={awayName}
      oppUsername={awayUsername}
      myPoints={homePts}
      oppPoints={awayPts}
      result={null}
      isCompleted={isCompleted}
      isLive={isLive}
      myLineup={homeLineup}
      oppLineup={awayLineup}
      myBench={homeBench}
      oppBench={awayBench}
      weekMatches={weekMatches}
      breakdownByMatchId={breakdownByMatchId}
      getMyPlayerStats={(matchId, playerId) => breakdownByMatchId.get(matchId)?.myPlayers.find(p => p.playerId === playerId)}
      getOppPlayerStats={(matchId, playerId) => breakdownByMatchId.get(matchId)?.oppPlayers.find(p => p.playerId === playerId)}
      width={width}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={PRIMARY_SOFT} />}
      myLineupLoading={homeLineupLoading}
      oppLineupLoading={awayLineupLoading}
    />
  )
}
