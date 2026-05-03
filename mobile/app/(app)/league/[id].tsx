import { useState, useRef, useEffect } from 'react'
import {
  View, Text, ScrollView, Alert, RefreshControl, TouchableOpacity,
  TextInput, FlatList, KeyboardAvoidingView, Platform, Modal, ActivityIndicator,
  Animated, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatCurrency } from '../../../lib/currency'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, TEXT_PLACEHOLDER, TEXT_DISABLED,
  BORDER_DEFAULT, BORDER_MEDIUM,
  BG_PAGE, BG_CARD,
  PRIMARY, PRIMARY_SOFT, PRIMARY_BG, PRIMARY_BORDER, PRIMARY_SUBTLE,
  SUCCESS, SUCCESS_BG, SUCCESS_SUBTLE,
  WARNING_DARK, WARNING_BG, WARNING_DARKER,
  INFO_DARK, INFO_SUBTLE,
  BG_DARK_HEADER,
  roleColors as importedRoleColors,
} from '../../../constants/colors'
import { MemberList } from '../../../components/league/MemberList'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { useLeague, useLeaveLeague, useAdvanceLeagueStatus, useDeleteAuction, useDeleteLeague, useUpdateWeekMatchups, useUpdateTeamName, useLeagueOverrides, useSetOverride, useDeleteOverride, useRenameLeague, useUpdateLeagueLimits } from '../../../hooks/useLeague'
import { usePlayerInterests, useToggleInterest, useAvailablePlayers } from '../../../hooks/useAuctionInterests'
import { useAllTeams, useLeaderboard, useDropPlayer, useAddPlayer, useAdminDropPlayer, useAdminAddPlayer, type RosterEntry } from '../../../hooks/useTeam'
import { useFreeAgents, type FreeAgent } from '../../../hooks/useWaivers'
import { useLeagueHome } from '../../../hooks/useLeagueHome'
import { useLeagueSchedule, useAllWeeks } from '../../../hooks/useMatchup'
import { SquadGrid } from '../../../components/team/SquadGrid'
import { MatchupsTab } from '../../../components/league/MatchupsTab'
import { PlayerDetailModal } from '../../../components/league/PlayerDetailModal'
import { LoadingScreen, LoadingOverlay } from '../../../components/ui/Loading'
import { Avatar } from '../../../components/ui/Avatar'
import { useAuthStore } from '../../../stores/authStore'
import { PlayerRow, roleColors, roleLabels } from '../../../components/league/PlayerRow'
import { NavButton } from '../../../components/ui/NavButton'
import { SearchBar } from '../../../components/ui/SearchBar'
import { SegmentedControl } from '../../../components/ui/SegmentedControl'
import { api } from '../../../lib/api'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAdminSetLineup, useUserLineup, useLeagueWeeklyTotals } from '../../../hooks/useLineup'


interface PlayerRow {
  id: string
  name: string
  ipl_team: string
  role: string
  base_price: number
  nationality: string
  image_url?: string | null
}


const wishlistRoleChips: { label: string; value: string | null }[] = [
  { label: 'All', value: null },
  { label: 'BAT', value: 'batsman' },
  { label: 'WK', value: 'wicket_keeper' },
  { label: 'AR', value: 'all_rounder' },
  { label: 'BOWL', value: 'bowler' },
]

const roleBadgeColors: Record<string, 'blue' | 'red' | 'green' | 'yellow'> = {
  batsman: 'blue',
  bowler: 'red',
  all_rounder: 'green',
  wicket_keeper: 'yellow',
}

// ─── Placeholder tab content ─────────────────────────────────────────────────


export default function LeagueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { top: topInset } = useSafeAreaInsets()
  const { user } = useAuthStore()
  const { data, isLoading, refetch, isRefetching } = useLeague(id!)
  const leaveLeague = useLeaveLeague()
  const advanceStatus = useAdvanceLeagueStatus()
  const deleteAuction = useDeleteAuction()
  const deleteLeague = useDeleteLeague()
  const updateWeekMatchups = useUpdateWeekMatchups()
  const [scheduleAdjustOpen, setScheduleAdjustOpen] = useState(false)
  const [scheduleEditWeek, setScheduleEditWeek] = useState<number | null>(null)
  // draft[weekNum][matchupId] = { home_user, away_user }
  const [scheduleEdits, setScheduleEdits] = useState<Record<number, Record<string, { id: string; home_user: string; away_user: string }>>>({})
  const [playerSearch, setPlayerSearch] = useState('')
  const [playerRoleFilter, setPlayerRoleFilter] = useState<string | null>(null)
  const [playerTeamFilter, setPlayerTeamFilter] = useState<string | null>(null)
  const [allPlayersCollapsed, setAllPlayersCollapsed] = useState(false)
  const [interestedCollapsed, setInterestedCollapsed] = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  const [wishlistY, setWishlistY] = useState(0)
  const [activeLeagueTab, setActiveLeagueTab] = useState('matchups')
  const [scheduleSubTab, setScheduleSubTab] = useState<'upcoming' | 'results'>('upcoming')

  // Team name state
  const [teamNameInput, setTeamNameInput] = useState('')
  const updateTeamName = useUpdateTeamName()

  // League rename state
  const [leagueNameInput, setLeagueNameInput] = useState('')
  const renameLeague = useRenameLeague()

  // Squad limits state (initialised from league data when available)
  const updateLeagueLimits = useUpdateLeagueLimits()
  const [limitsMaxTeams, setLimitsMaxTeams] = useState('')
  const [limitsRosterSize, setLimitsRosterSize] = useState('')
  const [limitsMaxBatsmen, setLimitsMaxBatsmen] = useState('')
  const [limitsMaxWK, setLimitsMaxWK] = useState('')
  const [limitsMaxAR, setLimitsMaxAR] = useState('')
  const [limitsMaxBowlers, setLimitsMaxBowlers] = useState('')

  // Points override state
  const [overrideUserId, setOverrideUserId] = useState<string>('')
  const [overrideWeek, setOverrideWeek] = useState<string>('')
  const [overridePoints, setOverridePoints] = useState<string>('')
  const [overrideNote, setOverrideNote] = useState<string>('')

  // Teams tab state
  const [teamsSubTab, setTeamsSubTab] = useState<'squads' | 'points'>('squads')
  const [selectedTeamUserId, setSelectedTeamUserId] = useState<string | null>(null)

  // Add/drop state
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [faSearch, setFaSearch] = useState('')
  const [selectedFreeAgent, setSelectedFreeAgent] = useState<FreeAgent | null>(null)
  const [dropPickerVisible, setDropPickerVisible] = useState(false)
  const [dropRoleFilter, setDropRoleFilter] = useState<string | null>(null)
  const [dropConfirmItem, setDropConfirmItem] = useState<RosterEntry | null>(null)
  const dropConfirmItemRef = useRef<RosterEntry | null>(null)
  const dropSlide = useRef(new Animated.Value(0)).current
  const SCREEN_W = Dimensions.get('window').width

  // Player detail modal (active league Players tab)
  const [lpSelectedPlayer, setLpSelectedPlayer] = useState<{
    player_id: string; name: string; ipl_team: string; role: string
    nationality: string; base_price: number; sold_to: string | null
    total_points: number; team_games_played: number
  } | null>(null)

  // Admin Set Lineup state
  const [adminLineupOpen, setAdminLineupOpen] = useState(false)
  const [adminLineupUserId, setAdminLineupUserId] = useState<string | null>(null)
  const [adminLineupWeek, setAdminLineupWeek] = useState<number | null>(null)
  const [adminLineupDraft, setAdminLineupDraft] = useState<Array<{ playerId: string; slotRole: string }>>([])

  // Admin Roster Management state
  const [adminRosterOpen, setAdminRosterOpen] = useState(false)
  const [adminRosterUserId, setAdminRosterUserId] = useState<string | null>(null)
  const [adminRosterAction, setAdminRosterAction] = useState<'drop' | 'add' | null>(null)
  const [adminRosterFaSearch, setAdminRosterFaSearch] = useState('')

  // Players tab filters (active league state)
  const [lpSearch, setLpSearch] = useState('')
  const [lpRoleFilter, setLpRoleFilter] = useState<string | null>(null)
  const [lpTeamFilter, setLpTeamFilter] = useState<string | null>(null)
  const [lpFreeAgentsOnly, setLpFreeAgentsOnly] = useState(true)

  const league = data?.league
  const members = data?.members ?? []
  const isAdmin = league?.admin_id === user?.id
  const isDraftPending = league?.status === 'draft_pending'
  const isDraftActive  = league?.status === 'draft_active'
  const isActive       = league?.status === 'league_active'
  const isComplete     = league?.status === 'league_complete'

  const { data: playersData } = useQuery({
    queryKey: ['players-all'],
    queryFn: () => api.get<{ players: PlayerRow[] }>('/players'),
    enabled: isDraftPending,
    select: (d) => d.players,
  })
  const { data: availableData, refetch: refetchAvailable } = useAvailablePlayers((isActive || isComplete) ? id! : '')
  const { data: allRosters } = useAllTeams((isActive || isComplete) ? id! : '')
  const { data: leaderboard } = useLeaderboard((isActive || isComplete) ? id! : '')
  const { data: overrides } = useLeagueOverrides(id!)
  const setOverride = useSetOverride(id!)
  const deleteOverride = useDeleteOverride(id!)
  const { data: homeData, refetch: refetchHome } = useLeagueHome(id!)
  const { data: scheduleMatchups, isLoading: matchupsLoading, refetch: refetchSchedule } = useLeagueSchedule((isActive || isComplete) ? id! : '')
  const { data: weeklyTotals } = useLeagueWeeklyTotals((isActive || isComplete) ? id! : '')
  const { data: allWeeks, isLoading: weeksLoading } = useAllWeeks()
  const { data: interestData } = usePlayerInterests(isDraftPending ? id! : '')
  const toggleInterest = useToggleInterest(id!)
  const { data: freeAgents, isLoading: faLoading } = useFreeAgents(id!)
  const dropPlayerMutation = useDropPlayer(id!)
  const addPlayerMutation = useAddPlayer(id!)
  const adminDropPlayer = useAdminDropPlayer(id!)
  const adminAddPlayer = useAdminAddPlayer(id!)
  const adminSetLineup = useAdminSetLineup(id!)
  const { data: adminLineupData, isLoading: adminLineupLoading } = useUserLineup(
    id!, adminLineupUserId ?? '', adminLineupWeek ?? 0
  )

  // Prefetch current-week matchup data so the Matchups tab loads instantly
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!id || !user || !homeData?.currentWeekNum || !scheduleMatchups) return
    const weekNum = homeData.currentWeekNum

    // My lineup for the current week
    queryClient.prefetchQuery({
      queryKey: ['lineup', id, weekNum],
      queryFn: () => api.get(`/lineups/${id}?week=${weekNum}`),
      staleTime: 60_000,
    })

    // IPL matches this week
    queryClient.prefetchQuery({
      queryKey: ['weekMatches', weekNum],
      queryFn: () => api.get(`/schedule/weeks/${weekNum}/matches`),
      staleTime: 60_000,
    })

    // Opponent lineup + game breakdown for my matchup this week
    const myMatchup = scheduleMatchups.find(
      m => m.week_num === weekNum && (m.home_user === user.id || m.away_user === user.id)
    )
    if (myMatchup) {
      const oppId = myMatchup.home_user === user.id ? myMatchup.away_user : myMatchup.home_user
      queryClient.prefetchQuery({
        queryKey: ['lineup', id, oppId, weekNum],
        queryFn: () => api.get(`/lineups/${id}/user/${oppId}?week=${weekNum}`),
        staleTime: 60_000,
      })
      queryClient.prefetchQuery({
        queryKey: ['game-breakdown', id, weekNum, oppId],
        queryFn: () => api.get(`/lineups/${id}/game-breakdown?week=${weekNum}&opponentId=${oppId}`),
        staleTime: 30_000,
      })
    }
  }, [id, user?.id, homeData?.currentWeekNum, scheduleMatchups?.length])

  // Sync admin lineup data into draft when user/week changes
  useEffect(() => {
    if (adminLineupData?.lineup) {
      setAdminLineupDraft(adminLineupData.lineup.map((e: any) => ({ playerId: e.player_id, slotRole: e.slot_role })))
    } else {
      setAdminLineupDraft([])
    }
  }, [adminLineupData])

  const ADMIN_SLOT_DEFS = [
    { role: 'batsman', label: 'BAT', count: 3 },
    { role: 'wicket_keeper', label: 'WK', count: 1 },
    { role: 'all_rounder', label: 'AR', count: 1 },
    { role: 'bowler', label: 'BOW', count: 3 },
    { role: 'flex', label: 'FLEX', count: 3 },
  ]

  const handleAdminTogglePlayer = (player: RosterEntry) => {
    const inLineup = adminLineupDraft.some(e => e.playerId === player.player_id)
    if (inLineup) {
      setAdminLineupDraft(prev => prev.filter(e => e.playerId !== player.player_id))
      return
    }
    if (adminLineupDraft.length >= 11) return
    const roleCount = adminLineupDraft.filter(e => e.slotRole === player.player_role).length
    const roleDef = ADMIN_SLOT_DEFS.find(d => d.role === player.player_role)
    const flexCount = adminLineupDraft.filter(e => e.slotRole === 'flex').length
    let slotRole: string
    if (roleCount < (roleDef?.count ?? 0)) {
      slotRole = player.player_role
    } else if (flexCount < 3) {
      slotRole = 'flex'
    } else {
      Alert.alert('No Open Slots', `No ${player.player_role.replace(/_/g, ' ')} or FLEX slots available`)
      return
    }
    setAdminLineupDraft(prev => [...prev, { playerId: player.player_id, slotRole }])
  }

  const handleAdminSaveLineup = async () => {
    if (!adminLineupUserId || !adminLineupWeek) return
    if (adminLineupDraft.length === 0) return
    try {
      await adminSetLineup.mutateAsync({
        userId: adminLineupUserId,
        weekNum: adminLineupWeek,
        entries: adminLineupDraft as any,
      })
      Alert.alert('Saved', 'Lineup saved successfully')
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save lineup')
    }
  }

  const myInterests = new Set(interestData?.myInterests ?? [])
  const interestCounts = interestData?.counts ?? {}

  const filteredPlayers = (playersData ?? []).filter(p => {
    if (playerSearch.length > 0 &&
        !p.name.toLowerCase().includes(playerSearch.toLowerCase()) &&
        !p.ipl_team.toLowerCase().includes(playerSearch.toLowerCase())) return false
    if (playerRoleFilter && p.role !== playerRoleFilter) return false
    if (playerTeamFilter && p.ipl_team !== playerTeamFilter) return false
    return true
  })

  const interested = filteredPlayers.filter(p => myInterests.has(p.id))
  const others     = filteredPlayers.filter(p => !myInterests.has(p.id))

  const renderPlayer = (item: PlayerRow, index: number, section: 'interested' | 'others') => {
    const isInterested = section === 'interested'
    const count = interestCounts[item.id] ?? 0
    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => toggleInterest.mutate(item.id)}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          paddingVertical: 12, paddingHorizontal: 16,
          borderTopWidth: index > 0 ? 1 : 0, borderTopColor: BORDER_DEFAULT,
          backgroundColor: isInterested ? SUCCESS_BG : BG_CARD,
        }}
      >
        <View style={{
          width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
          backgroundColor: isInterested ? SUCCESS : BORDER_DEFAULT,
          flexShrink: 0,
        }}>
          <Text style={{ fontSize: 13, color: isInterested ? 'white' : TEXT_PLACEHOLDER }}>
            {isInterested ? '★' : '☆'}
          </Text>
        </View>
        <Avatar uri={item.image_url} name={item.name} size={36} neutralFallback />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: TEXT_PRIMARY, fontWeight: '600', fontSize: 14 }}>{item.name}</Text>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 12 }}>{item.ipl_team}</Text>
            <Badge label={roleLabels[item.role] ?? item.role} color={roleBadgeColors[item.role] ?? 'gray'} />
            {item.nationality !== 'Indian' && <Badge label="OS" color="yellow" />}
          </View>
        </View>
        {count > 1 && <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11 }}>{count} want</Text>}
      </TouchableOpacity>
    )
  }

  // ── Handlers ──

  const handleDeleteLeague = () => {
    Alert.alert(
      'Delete League',
      'This will permanently delete the league, all rosters, and all data. Every member will lose access. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete League', style: 'destructive', onPress: async () => {
          try {
            await deleteLeague.mutateAsync(id!)
            router.replace('/(app)/home')
          } catch {
            Alert.alert('Error', 'Failed to delete league. Please try again.')
          }
        }},
      ]
    )
  }

  const handleDeleteAuction = () => {
    Alert.alert(
      'Reset Auction',
      'This will reset the draft and delete all rosters, bids, and matchups. Members will keep their spots but budgets will be restored. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteAuction.mutateAsync(id!)
          } catch {
            Alert.alert('Error', 'Failed to delete auction. Please try again.')
          }
        }},
      ]
    )
  }

  // ── Add/drop handlers ──────────────────────────────────────────────────────
  const adRoleColors = roleColors
  const adRoleLabels = roleLabels
  const adRoleFullLabels: Record<string, string> = {
    batsman: 'Batsman', bowler: 'Bowler', all_rounder: 'All-Rounder', wicket_keeper: 'Wicket Keeper',
  }
  const ROLE_LIMITS: Record<string, number> = {
    batsman:       league?.max_batsmen        ?? 6,
    wicket_keeper: league?.max_wicket_keepers ?? 2,
    all_rounder:   league?.max_all_rounders   ?? 4,
    bowler:        league?.max_bowlers        ?? 6,
  }

  const myCurrentRoster: RosterEntry[] = (() => {
    const rostersByUser = (allRosters ?? []).reduce<Record<string, typeof allRosters>>((acc, e) => {
      if (!acc[e!.user_id]) acc[e!.user_id] = []
      acc[e!.user_id]!.push(e!)
      return acc
    }, {})
    return (rostersByUser[user?.id ?? ''] ?? []) as RosterEntry[]
  })()
  const rosterFull = myCurrentRoster.length >= (league?.roster_size ?? 16)

  const filteredFreeAgents = (freeAgents ?? []).filter(p =>
    p.name.toLowerCase().includes(faSearch.toLowerCase()) ||
    p.ipl_team.toLowerCase().includes(faSearch.toLowerCase())
  )

  const handleDropPlayer = async (player: RosterEntry) => {
    let warningLine = ''
    try {
      const impact = await api.get<{ affectedWeeks: number[] }>(
        `/teams/${id}/players/${player.player_id}/drop-impact`
      )
      if (impact.affectedWeeks.length > 0) {
        const weeks = impact.affectedWeeks.map(w => `Week ${w}`).join(', ')
        warningLine = `\n\nThis will also remove them from your lineup for: ${weeks}.`
      }
    } catch {}

    Alert.alert(
      'Drop Player',
      `Drop ${player.player_name} from your squad?${warningLine}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Drop', style: 'destructive', onPress: async () => {
          try {
            await dropPlayerMutation.mutateAsync(player.player_id)
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Failed to drop player')
          }
        }},
      ]
    )
  }

  const handleSelectFreeAgent = (player: FreeAgent) => {
    setSelectedFreeAgent(player)
    setAddModalVisible(false)

    const roleCount = myCurrentRoster.filter(r => r.player_role === player.role).length
    const roleFull = roleCount >= (ROLE_LIMITS[player.role] ?? Infinity)

    if (roleFull) {
      // Must drop a same-role player to stay within positional limits
      setDropRoleFilter(player.role)
      setDropPickerVisible(true)
    } else if (rosterFull) {
      // Roster is full — any drop is fine
      setDropRoleFilter(null)
      setDropPickerVisible(true)
    } else {
      confirmAddPlayer(player.id, undefined)
    }
  }

  const confirmAddPlayer = async (playerId: string, dropPlayerId: string | undefined) => {
    try {
      await addPlayerMutation.mutateAsync({ playerId, dropPlayerId })
      setSelectedFreeAgent(null)
      setDropPickerVisible(false)
      setDropRoleFilter(null)
      setDropConfirmItem(null)
      dropSlide.setValue(0)
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to add player')
    }
  }
  // ───────────────────────────────────────────────────────────────────────────

  const handleLeave = () => {
    Alert.alert('Leave League', 'Are you sure you want to leave this league?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        await leaveLeague.mutateAsync(id!)
        router.replace('/(app)/home')
      }},
    ])
  }

  const handleStartDraft = () => {
    Alert.alert(
      'Start Draft',
      `Start the auction draft now? All ${members.length} member(s) currently in the league will participate.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start Draft', onPress: () => advanceStatus.mutate({ leagueId: id!, status: 'draft_active' }) },
      ]
    )
  }

  // ── Loading / error ──

  if (isLoading) {
    return <LoadingScreen message="Loading league…" />
  }

  if (!league) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-red-500">League not found</Text>
      </View>
    )
  }

  // ── Active / complete league: tab-based layout ──

  if (isActive || isComplete) {
    const leagueTabs = [
      { key: 'matchups', label: 'Matchups' },
      { key: 'teams',    label: 'Teams' },
      { key: 'players',  label: 'Players' },
      { key: 'schedule', label: 'Schedule' },
      { key: 'settings', label: 'Settings' },
      ...(isAdmin ? [{ key: 'admin', label: 'Admin' }] : []),
    ]

    return (
      <View style={{ flex: 1, backgroundColor: BG_PAGE }}>
        {/* Fully custom header — avoids native UIBarButtonItem circle on iOS */}
        <View style={{
          backgroundColor: BG_CARD,
          paddingTop: topInset,
          borderBottomWidth: 1,
          borderBottomColor: BORDER_MEDIUM,
          flexDirection: 'row',
          alignItems: 'center',
          height: topInset + 44,
          paddingHorizontal: 16,
        }}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.75}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: BORDER_DEFAULT }}
          >
            <Text style={{ color: TEXT_SECONDARY, fontWeight: '600', fontSize: 14 }}>← All Leagues</Text>
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ backgroundColor: BG_CARD, borderBottomWidth: 1, borderBottomColor: BORDER_MEDIUM, flexGrow: 0 }}
          contentContainerStyle={{ flexDirection: 'row' }}
        >
          {leagueTabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveLeagueTab(tab.key)}
              style={{
                paddingHorizontal: 16, paddingVertical: 12,
                borderBottomWidth: 2,
                borderBottomColor: activeLeagueTab === tab.key ? PRIMARY : 'transparent',
              }}
            >
              <Text style={{
                fontSize: 13, fontWeight: '600',
                color: activeLeagueTab === tab.key ? PRIMARY : TEXT_PLACEHOLDER,
              }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Matchups tab — horizontal paging FlatList, no wrapping ScrollView */}
        {activeLeagueTab === 'matchups' && (
          <MatchupsTab
            leagueId={id!}
            userId={user!.id}
            matchups={scheduleMatchups ?? []}
            weeks={allWeeks ?? []}
            currentWeekNum={homeData?.currentWeekNum ?? null}
            isLoading={matchupsLoading || weeksLoading}
            overrides={overrides}
            onRefreshMatchups={refetchSchedule}
          />
        )}

        {/* Players tab — FlatList takes full flex:1 directly, no wrapping ScrollView */}
        {activeLeagueTab === 'players' && (() => {
          const allPlayers = availableData?.players ?? []
          const uniqueIplTeams = [...new Set(allPlayers.map(p => p.ipl_team))].sort()
          const filtered = allPlayers.filter(p => {
            if (lpFreeAgentsOnly && p.sold_to !== null) return false
            if (lpSearch && !p.name.toLowerCase().includes(lpSearch.toLowerCase()) &&
                !p.ipl_team.toLowerCase().includes(lpSearch.toLowerCase())) return false
            if (lpRoleFilter && p.role !== lpRoleFilter) return false
            if (lpTeamFilter && p.ipl_team !== lpTeamFilter) return false
            return true
          }).sort((a, b) => {
            const avgA = a.team_games_played > 0 ? a.total_points / a.team_games_played : 0
            const avgB = b.team_games_played > 0 ? b.total_points / b.team_games_played : 0
            return avgB - avgA
          })

          const chipStyle = (active: boolean) => ({
            paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20,
            backgroundColor: active ? PRIMARY : BG_CARD,
            borderWidth: 1, borderColor: active ? PRIMARY : BORDER_MEDIUM,
            marginRight: 7,
          })
          const chipText = (active: boolean) => ({
            fontSize: 12, fontWeight: '600' as const,
            color: active ? BG_CARD : TEXT_SECONDARY,
          })
          const roleChips = [
            { label: 'All', value: null },
            { label: 'BAT', value: 'batsman' },
            { label: 'WK', value: 'wicket_keeper' },
            { label: 'AR', value: 'all_rounder' },
            { label: 'BOWL', value: 'bowler' },
          ]


          return (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); refetchHome(); refetchAvailable() }} tintColor={PRIMARY_SOFT} />}
            >
              {/* Filters */}
              <View style={{ gap: 10, paddingTop: 16, paddingBottom: 8 }}>
                <SegmentedControl
                  segments={[
                    { key: 'fa', label: 'Free Agents' },
                    { key: 'all', label: 'All Players' },
                  ]}
                  value={lpFreeAgentsOnly ? 'fa' : 'all'}
                  onChange={k => setLpFreeAgentsOnly(k === 'fa')}
                />
                <SearchBar
                  value={lpSearch}
                  onChangeText={setLpSearch}
                  placeholder="Search by name or team…"
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row' }}>
                    {roleChips.map(({ label, value }) => (
                      <TouchableOpacity key={label} onPress={() => setLpRoleFilter(value)} style={chipStyle(lpRoleFilter === value)}>
                        <Text style={chipText(lpRoleFilter === value)}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                    {(lpSearch || lpRoleFilter || lpTeamFilter) && (
                      <TouchableOpacity
                        onPress={() => { setLpSearch(''); setLpRoleFilter(null); setLpTeamFilter(null) }}
                        style={{ paddingHorizontal: 10, paddingVertical: 6, justifyContent: 'center' }}
                      >
                        <Text style={{ color: PRIMARY_SOFT, fontSize: 12, fontWeight: '600' }}>Clear</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity onPress={() => setLpTeamFilter(null)} style={chipStyle(lpTeamFilter === null)}>
                      <Text style={chipText(lpTeamFilter === null)}>All IPL Teams</Text>
                    </TouchableOpacity>
                    {uniqueIplTeams.map(team => (
                      <TouchableOpacity key={team} onPress={() => setLpTeamFilter(team)} style={chipStyle(lpTeamFilter === team)}>
                        <Text style={chipText(lpTeamFilter === team)}>{team}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Flat grid with role badges */}
              {filtered.length === 0 ? (
                <View style={{ backgroundColor: BG_CARD, borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: BORDER_DEFAULT }}>
                  <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 15 }}>
                    {allPlayers.length === 0 ? 'Loading players…' : 'No players found'}
                  </Text>
                </View>
              ) : (
                <View style={{ backgroundColor: BG_CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER_DEFAULT, overflow: 'hidden' }}>
                  {filtered.map((item, idx) => {
                    const avgPts = item.team_games_played > 0 && item.total_points !== 0 ? item.total_points / item.team_games_played : null
                    const isOS = item.nationality !== 'Indian'
                    const roleColor = adRoleColors[item.role] ?? TEXT_MUTED
                    return (
                      <TouchableOpacity
                        key={item.player_id}
                        onPress={() => setLpSelectedPlayer(item)}
                        activeOpacity={0.7}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 12, gap: 8, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: BORDER_DEFAULT }}
                      >
                        {/* Role badge — fixed width */}
                        <View style={{ width: 54, alignItems: 'center', justifyContent: 'center', paddingVertical: 11 }}>
                          <View style={{ backgroundColor: roleColor + '18', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 }}>
                            <Text style={{ color: roleColor, fontSize: 10, fontWeight: '700' }}>{adRoleLabels[item.role] ?? item.role}</Text>
                          </View>
                        </View>
                        <Avatar uri={item.image_url} name={item.name} size={36} neutralFallback />
                        {/* Name + team */}
                        <View style={{ flex: 1, paddingVertical: 11 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Text style={{ color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>{item.name}</Text>
                            {isOS && (
                              <View style={{ backgroundColor: WARNING_BG, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, flexShrink: 0 }}>
                                <Text style={{ color: WARNING_DARK, fontSize: 9, fontWeight: '700' }}>OS</Text>
                              </View>
                            )}
                          </View>
                          <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, marginTop: 1 }}>{item.ipl_team}</Text>
                        </View>
                        {/* Avg pts */}
                        {avgPts != null ? (
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 13 }}>{Math.round(avgPts)}</Text>
                            <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 9, fontWeight: '500' }}>avg pts</Text>
                          </View>
                        ) : (
                          <Text style={{ color: TEXT_DISABLED, fontSize: 12 }}>—</Text>
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )}
            </ScrollView>
          )
        })()}

        {/* All other tabs — wrapped in ScrollView */}
        {activeLeagueTab !== 'players' && activeLeagueTab !== 'matchups' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); refetchHome() }} tintColor={PRIMARY_SOFT} />}
        >
          {activeLeagueTab === 'teams' && (() => {
            const rostersByUser = (allRosters ?? []).reduce<Record<string, typeof allRosters>>((acc, e) => {
              if (!acc[e!.user_id]) acc[e!.user_id] = []
              acc[e!.user_id]!.push(e!)
              return acc
            }, {})
            const pointsMap = (leaderboard ?? []).reduce<Record<string, number>>((acc, e) => {
              acc[e.user_id] = e.total_points; return acc
            }, {})
            // Per-user record computed at runtime from live weekly totals.
            // Avoids the stale `weekly_matchups.home_points` cache by pulling
            // fresh sums from /lineups/:leagueId/all-totals and re-deriving
            // wins/losses/ties from the comparison instead of `winner_id`.
            type TeamRecord = { wins: number; losses: number; ties: number; points: number }
            const records: globalThis.Record<string, TeamRecord> = {}
            const totalsByKey = new Map<string, number>()
            for (const t of (weeklyTotals ?? [])) {
              totalsByKey.set(`${t.userId}:${t.weekNum}`, t.points)
            }
            const ptsFor = (uid: string, week: number) => totalsByKey.get(`${uid}:${week}`) ?? 0
            for (const m of (scheduleMatchups ?? [])) {
              if (!m.is_final) continue
              for (const uid of [m.home_user, m.away_user]) {
                if (!records[uid]) records[uid] = { wins: 0, losses: 0, ties: 0, points: 0 }
              }
              const homePts = ptsFor(m.home_user, m.week_num)
              const awayPts = ptsFor(m.away_user, m.week_num)
              records[m.home_user]!.points += homePts
              records[m.away_user]!.points += awayPts
              if (homePts > awayPts) {
                records[m.home_user]!.wins++
                records[m.away_user]!.losses++
              } else if (awayPts > homePts) {
                records[m.away_user]!.wins++
                records[m.home_user]!.losses++
              } else {
                records[m.home_user]!.ties++
                records[m.away_user]!.ties++
              }
            }
            const effectiveUserId = selectedTeamUserId ?? user?.id ?? (members[0]?.user_id ?? null)
            const selectedMember = members.find(m => m.user_id === effectiveUserId)
            const selectedRoster = effectiveUserId ? (rostersByUser[effectiveUserId] ?? []) : []
            const currency = league.currency

            return (
              <View style={{ gap: 12 }}>
                {/* Sub-tab toggle */}
                <SegmentedControl
                  segments={[
                    { key: 'squads', label: 'Squads' },
                    { key: 'points', label: 'Points Table' },
                  ]}
                  value={teamsSubTab}
                  onChange={setTeamsSubTab}
                />

                {/* ── Squads sub-tab ── */}
                {teamsSubTab === 'squads' && (
                  <View style={{ gap: 12 }}>
                    {/* Team selector pills */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {members.map(m => {
                          const isSelected = (m.user_id === effectiveUserId)
                          const isMe = m.user_id === user?.id
                          return (
                            <TouchableOpacity
                              key={m.user_id}
                              onPress={() => setSelectedTeamUserId(m.user_id)}
                              style={{
                                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                                backgroundColor: isSelected ? PRIMARY : BG_CARD,
                                borderWidth: 1, borderColor: isSelected ? PRIMARY : BORDER_MEDIUM,
                                alignItems: 'center',
                              }}
                            >
                              <Text style={{ fontSize: 13, fontWeight: '700', color: isSelected ? 'white' : TEXT_SECONDARY }}>
                                {m.team_name || m.display_name || m.username}{isMe ? ' (You)' : ''}
                              </Text>
                              {m.team_name && (
                                <Text style={{ fontSize: 11, color: isSelected ? 'rgba(255,255,255,0.75)' : TEXT_PLACEHOLDER }}>
                                  {m.display_name ?? m.username}
                                </Text>
                              )}
                            </TouchableOpacity>
                          )
                        })}
                      </View>
                    </ScrollView>

                    {/* Team card */}
                    {selectedMember && (
                      <View style={{
                        backgroundColor: BG_CARD, borderRadius: 16, padding: 16,
                        borderWidth: 1, borderColor: BORDER_DEFAULT, gap: 12,
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <Avatar
                            uri={selectedMember.avatar_url}
                            name={selectedMember.team_name || selectedMember.display_name || selectedMember.username}
                            size={44}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 18 }}>
                              {selectedMember.team_name || selectedMember.display_name || selectedMember.username}
                              {selectedMember.user_id === user?.id ? ' (You)' : ''}
                            </Text>
                            {selectedMember.team_name && (
                              <Text style={{ color: TEXT_MUTED, fontSize: 13 }}>
                                {selectedMember.display_name ?? selectedMember.username}
                              </Text>
                            )}
                            <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 13 }}>
                              {selectedRoster.length} / {league.roster_size} players
                            </Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 0 }}>
                          {[
                            { label: 'Total Pts', value: pointsMap[selectedMember.user_id] != null ? String(pointsMap[selectedMember.user_id]) : '—' },
                            { label: 'Record', value: '—' },
                          ].map(({ label, value }, i, arr) => (
                            <View
                              key={label}
                              style={{
                                flex: 1, alignItems: 'center',
                                borderRightWidth: i < arr.length - 1 ? 1 : 0,
                                borderRightColor: BORDER_DEFAULT,
                              }}
                            >
                              <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 18 }}>{value}</Text>
                              <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, marginTop: 2 }}>{label}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Squad */}
                    <SquadGrid
                      roster={selectedRoster}
                      currency={currency}
                      onDrop={effectiveUserId === user?.id ? handleDropPlayer : undefined}
                    />
                  </View>
                )}

                {/* ── Points Table sub-tab ── */}
                {teamsSubTab === 'points' && (
                  <View style={{ backgroundColor: BG_CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER_DEFAULT, overflow: 'hidden' }}>
                    {/* Header row */}
                    <View style={{ flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 16, backgroundColor: BG_PAGE, borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT }}>
                      <Text style={{ width: 28, color: TEXT_PLACEHOLDER, fontSize: 11, fontWeight: '700' }}>#</Text>
                      <Text style={{ flex: 1, color: TEXT_PLACEHOLDER, fontSize: 11, fontWeight: '700' }}>TEAM</Text>
                      <Text style={{ width: 26, color: TEXT_PLACEHOLDER, fontSize: 11, fontWeight: '700', textAlign: 'right' }}>W</Text>
                      <Text style={{ width: 26, color: TEXT_PLACEHOLDER, fontSize: 11, fontWeight: '700', textAlign: 'right' }}>L</Text>
                      <Text style={{ width: 26, color: TEXT_PLACEHOLDER, fontSize: 11, fontWeight: '700', textAlign: 'right' }}>T</Text>
                      <Text style={{ width: 52, color: TEXT_PLACEHOLDER, fontSize: 11, fontWeight: '700', textAlign: 'right' }}>PTS</Text>
                    </View>

                    {/* Sorted rows — wins desc, then points desc as tiebreaker */}
                    {members
                      .slice()
                      .sort((a, b) => {
                        const ra = records[a.user_id]
                        const rb = records[b.user_id]
                        const winDiff = (rb?.wins ?? 0) - (ra?.wins ?? 0)
                        if (winDiff !== 0) return winDiff
                        return (rb?.points ?? 0) - (ra?.points ?? 0)
                      })
                      .map((m, i) => {
                        const isMe = m.user_id === user?.id
                        const rec = records[m.user_id]
                        return (
                          <View
                            key={m.user_id}
                            style={{
                              flexDirection: 'row', alignItems: 'center',
                              paddingVertical: 12, paddingHorizontal: 16,
                              borderTopWidth: i === 0 ? 0 : 1, borderTopColor: BG_PAGE,
                              backgroundColor: isMe ? PRIMARY_BG : BG_CARD,
                            }}
                          >
                            <Text style={{ width: 28, color: i < 3 ? PRIMARY : TEXT_PLACEHOLDER, fontSize: 13, fontWeight: '700' }}>
                              {i + 1}
                            </Text>
                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Avatar uri={m.avatar_url} name={m.team_name || m.display_name || m.username} size={28} />
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                                  {m.team_name || m.display_name || m.username}{isMe ? ' ★' : ''}
                                </Text>
                                {m.team_name && (
                                  <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11 }} numberOfLines={1}>
                                    {m.display_name ?? m.username}
                                  </Text>
                                )}
                              </View>
                            </View>
                            <Text style={{ width: 26, color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700', textAlign: 'right' }}>
                              {rec?.wins ?? 0}
                            </Text>
                            <Text style={{ width: 26, color: TEXT_MUTED, fontSize: 13, textAlign: 'right' }}>
                              {rec?.losses ?? 0}
                            </Text>
                            <Text style={{ width: 26, color: TEXT_MUTED, fontSize: 13, textAlign: 'right' }}>
                              {rec?.ties ?? 0}
                            </Text>
                            <Text style={{ width: 52, color: rec ? TEXT_PRIMARY : TEXT_DISABLED, fontSize: 14, fontWeight: '700', textAlign: 'right' }}>
                              {rec ? Math.round(rec.points) : '—'}
                            </Text>
                          </View>
                        )
                      })}
                  </View>
                )}
              </View>
            )
          })()}

          {activeLeagueTab === 'schedule' && (() => {
            const matchups = scheduleMatchups ?? []
            const weeks = allWeeks ?? []

            const byWeek = matchups.reduce<Record<number, typeof matchups>>((acc, m) => {
              if (!acc[m.week_num]) acc[m.week_num] = []
              acc[m.week_num].push(m)
              return acc
            }, {})

            const allWeekNums = Object.keys(byWeek).map(Number).sort((a, b) => a - b)

            const isCompleted = (weekNum: number) => {
              const weekInfo = weeks.find(w => w.week_num === weekNum)
              if (weekInfo?.window_end && new Date(weekInfo.window_end) < new Date()) return true
              return byWeek[weekNum]!.every(m => m.is_final)
            }

            const upcomingWeeks = allWeekNums.filter(wn => !isCompleted(wn))
            const resultWeeks = [...allWeekNums.filter(wn => isCompleted(wn))].reverse()
            const weekNums = scheduleSubTab === 'upcoming' ? upcomingWeeks : resultWeeks

            if (allWeekNums.length === 0) {
              return (
                <View style={{ backgroundColor: BG_CARD, borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: BORDER_DEFAULT }}>
                  <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 15 }}>No schedule generated yet</Text>
                </View>
              )
            }

            return (
              <View style={{ gap: 16 }}>
                {/* Sub-tabs */}
                <SegmentedControl
                  segments={[
                    { key: 'upcoming', label: 'Schedule', count: upcomingWeeks.length },
                    { key: 'results',  label: 'Results',  count: resultWeeks.length },
                  ]}
                  value={scheduleSubTab}
                  onChange={setScheduleSubTab}
                />

                {weekNums.length === 0 && (
                  <View style={{ backgroundColor: BG_CARD, borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: BORDER_DEFAULT }}>
                    <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 15 }}>
                      {scheduleSubTab === 'upcoming' ? 'No upcoming games' : 'No completed weeks yet'}
                    </Text>
                  </View>
                )}

                {weekNums.map(weekNum => {
                  const weekMatchups = byWeek[weekNum]!
                  const weekInfo = weeks.find(w => w.week_num === weekNum)
                  return (
                    <View key={weekNum} style={{ gap: 8 }}>
                      {/* Week header */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 15 }}>
                          {weekInfo?.label || `Week ${weekNum}`}
                        </Text>
                        {weekInfo?.week_type && weekInfo.week_type !== 'regular' && (
                          <View style={{
                            backgroundColor: weekInfo.week_type === 'finals' ? WARNING_BG : PRIMARY_SUBTLE,
                            borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
                          }}>
                            <Text style={{
                              fontSize: 10, fontWeight: '700',
                              color: weekInfo.week_type === 'finals' ? WARNING_DARK : PRIMARY,
                              textTransform: 'uppercase',
                            }}>
                              {weekInfo.week_type}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Matchup cards */}
                      {weekMatchups.map(m => {
                        const isMyMatchup = m.home_user === user?.id || m.away_user === user?.id
                        const isHome = m.home_user === user?.id
                        const myName = isHome
                          ? (m.home_team_name || m.home_full_name || m.home_username)
                          : (m.away_team_name || m.away_full_name || m.away_username)
                        const oppName = isHome
                          ? (m.away_team_name || m.away_full_name || m.away_username)
                          : (m.home_team_name || m.home_full_name || m.home_username)
                        const myPts = isHome ? m.home_points : m.away_points
                        const oppPts = isHome ? m.away_points : m.home_points
                        const weekEnded = weekInfo?.window_end ? new Date(weekInfo.window_end) < new Date() : m.is_final
                        const hasResult = m.is_final || weekEnded
                        const weekStarted = weekInfo?.window_start ? new Date(weekInfo.window_start) <= new Date() : true
                        const showPoints = weekStarted

                        const winnerId = m.winner_id ?? (
                          weekEnded && (parseFloat(String(m.home_points)) !== parseFloat(String(m.away_points)))
                            ? (parseFloat(String(m.home_points)) > parseFloat(String(m.away_points)) ? m.home_user : m.away_user)
                            : null
                        )
                        const resultLabel = hasResult
                          ? (winnerId === user?.id ? 'WIN' : winnerId ? 'LOSS' : 'TIE')
                          : null
                        const resultBg = resultLabel === 'WIN' ? SUCCESS_SUBTLE : resultLabel === 'LOSS' ? PRIMARY_SUBTLE : BORDER_DEFAULT
                        const resultColor = resultLabel === 'WIN' ? SUCCESS : resultLabel === 'LOSS' ? PRIMARY : TEXT_MUTED

                        return (
                          <View
                            key={m.id}
                            style={{
                              backgroundColor: BG_CARD,
                              borderRadius: 14,
                              borderWidth: 1,
                              borderColor: isMyMatchup ? '#fca5a5' : BORDER_DEFAULT,
                              overflow: 'hidden',
                            }}
                          >
                            {isMyMatchup && (
                              <View style={{ backgroundColor: PRIMARY, paddingHorizontal: 14, paddingVertical: 5 }}>
                                <Text style={{ color: 'white', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>YOUR MATCHUP</Text>
                              </View>
                            )}

                            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 }}>
                              {/* Left team */}
                              <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                                <Avatar
                                  uri={null}
                                  name={isMyMatchup ? myName : (m.home_team_name || m.home_full_name || m.home_username)}
                                  size={36}
                                />
                                <Text style={{ color: TEXT_PRIMARY, fontWeight: isMyMatchup ? '700' : '500', fontSize: 12, textAlign: 'center' }} numberOfLines={1}>
                                  {isMyMatchup ? myName : (m.home_team_name || m.home_full_name || m.home_username)}
                                  {isMyMatchup ? ' ★' : ''}
                                </Text>
                                {showPoints && (
                                  <Text style={{ color: isMyMatchup ? PRIMARY : TEXT_SECONDARY, fontWeight: '800', fontSize: 22 }}>
                                    {Math.round(parseFloat(String(isMyMatchup ? myPts : m.home_points)) || 0)}
                                  </Text>
                                )}
                              </View>

                              {/* Middle */}
                              <View style={{ alignItems: 'center', gap: 4 }}>
                                <Text style={{ color: TEXT_DISABLED, fontWeight: '700', fontSize: 13 }}>VS</Text>
                                {resultLabel && isMyMatchup && (
                                  <View style={{ backgroundColor: resultBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                                    <Text style={{ fontSize: 10, fontWeight: '700', color: resultColor }}>{resultLabel}</Text>
                                  </View>
                                )}
                                {hasResult && !isMyMatchup && (
                                  <View style={{ backgroundColor: BORDER_DEFAULT, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                                    <Text style={{ fontSize: 10, fontWeight: '700', color: TEXT_MUTED }}>FINAL</Text>
                                  </View>
                                )}
                              </View>

                              {/* Right team */}
                              <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                                <Avatar
                                  uri={null}
                                  name={isMyMatchup ? oppName : (m.away_team_name || m.away_full_name || m.away_username)}
                                  size={36}
                                />
                                <Text style={{ color: TEXT_PRIMARY, fontWeight: '500', fontSize: 12, textAlign: 'center' }} numberOfLines={1}>
                                  {isMyMatchup ? oppName : (m.away_team_name || m.away_full_name || m.away_username)}
                                </Text>
                                {showPoints && (
                                  <Text style={{ color: TEXT_SECONDARY, fontWeight: '800', fontSize: 22 }}>
                                    {Math.round(parseFloat(String(isMyMatchup ? oppPts : m.away_points)) || 0)}
                                  </Text>
                                )}
                              </View>
                            </View>
                          </View>
                        )
                      })}
                    </View>
                  )
                })}
              </View>
            )
          })()}

          {activeLeagueTab === 'settings' && (
            <View style={{ gap: 12 }}>
              <View style={{ backgroundColor: BG_CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER_DEFAULT, gap: 12 }}>
                <Text style={{ fontWeight: '700', fontSize: 16, color: TEXT_PRIMARY }}>League Info</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                  <View>
                    <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 12 }}>Invite Code</Text>
                    <Text style={{ color: PRIMARY, fontWeight: '700', fontFamily: 'monospace', fontSize: 16, letterSpacing: 2 }}>
                      {league.invite_code}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 12 }}>Teams</Text>
                    <Text style={{ color: TEXT_PRIMARY, fontWeight: '600' }}>{members.length}/{league.max_teams}</Text>
                  </View>
                  <View>
                    <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 12 }}>Roster Size</Text>
                    <Text style={{ color: TEXT_PRIMARY, fontWeight: '600' }}>{league.roster_size}</Text>
                  </View>
                </View>
              </View>

              <View style={{ backgroundColor: BG_CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER_DEFAULT, gap: 10 }}>
                <Text style={{ fontWeight: '700', fontSize: 16, color: TEXT_PRIMARY }}>Team Name</Text>
                <TextInput
                  value={teamNameInput}
                  onChangeText={setTeamNameInput}
                  placeholder={members.find(m => m.user_id === user?.id)?.team_name || 'Your team name'}
                  placeholderTextColor={TEXT_PLACEHOLDER}
                  style={{
                    borderWidth: 1, borderColor: BORDER_MEDIUM, borderRadius: 10,
                    paddingHorizontal: 12, paddingVertical: 10,
                    fontSize: 15, color: TEXT_PRIMARY, backgroundColor: BG_PAGE,
                  }}
                  maxLength={50}
                />
                <TouchableOpacity
                  onPress={async () => {
                    const trimmed = teamNameInput.trim()
                    if (!trimmed) return
                    try {
                      await updateTeamName.mutateAsync({ leagueId: id!, teamName: trimmed })
                      setTeamNameInput('')
                      Alert.alert('Updated', 'Team name changed successfully')
                    } catch (err) {
                      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update team name')
                    }
                  }}
                  disabled={!teamNameInput.trim() || updateTeamName.isPending}
                  style={{
                    backgroundColor: !teamNameInput.trim() ? BORDER_MEDIUM : TEXT_PRIMARY,
                    borderRadius: 10, paddingVertical: 11, alignItems: 'center',
                  }}
                >
                  {updateTeamName.isPending
                    ? <ActivityIndicator color="white" />
                    : <Text style={{ color: !teamNameInput.trim() ? TEXT_PLACEHOLDER : 'white', fontWeight: '700', fontSize: 14 }}>Save Team Name</Text>
                  }
                </TouchableOpacity>
              </View>

              {!isAdmin && (
                <Button label="Leave League" variant="danger" onPress={handleLeave} />
              )}
            </View>
          )}

          {activeLeagueTab === 'admin' && isAdmin && (
            <View style={{ gap: 12 }}>
              {/* Rename League */}
              <View style={{ backgroundColor: BG_CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER_DEFAULT, gap: 8 }}>
                <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 15 }}>Rename League</Text>
                <TextInput
                  value={leagueNameInput}
                  onChangeText={setLeagueNameInput}
                  placeholder={league?.name ?? 'League name'}
                  placeholderTextColor={TEXT_PLACEHOLDER}
                  style={{ backgroundColor: BG_PAGE, borderRadius: 10, borderWidth: 1, borderColor: BORDER_MEDIUM, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: TEXT_PRIMARY }}
                />
                <TouchableOpacity
                  onPress={async () => {
                    const trimmed = leagueNameInput.trim()
                    if (!trimmed || trimmed.length < 3) return
                    await renameLeague.mutateAsync({ leagueId: id!, name: trimmed })
                    setLeagueNameInput('')
                  }}
                  disabled={renameLeague.isPending || leagueNameInput.trim().length < 3}
                  style={{ backgroundColor: renameLeague.isPending || leagueNameInput.trim().length < 3 ? TEXT_PLACEHOLDER : TEXT_PRIMARY, borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}
                >
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>
                    {renameLeague.isPending ? 'Saving…' : 'Save Name'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Squad Limits */}
              <View style={{ backgroundColor: BG_CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER_DEFAULT, gap: 12 }}>
                <View style={{ gap: 2 }}>
                  <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 15 }}>Squad Limits</Text>
                  <Text style={{ color: TEXT_MUTED, fontSize: 13 }}>Current: {league?.max_teams}T · {league?.roster_size} roster · {league?.max_batsmen}B / {league?.max_wicket_keepers}WK / {league?.max_all_rounders}AR / {league?.max_bowlers}BOW</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: '600' }}>Max Teams</Text>
                    <TextInput value={limitsMaxTeams} onChangeText={setLimitsMaxTeams} keyboardType="numeric" placeholder={String(league?.max_teams ?? '')} placeholderTextColor={TEXT_PLACEHOLDER} style={{ backgroundColor: BG_PAGE, borderRadius: 8, borderWidth: 1, borderColor: BORDER_MEDIUM, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: TEXT_PRIMARY }} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: '600' }}>Roster Size</Text>
                    <TextInput value={limitsRosterSize} onChangeText={setLimitsRosterSize} keyboardType="numeric" placeholder={String(league?.roster_size ?? '')} placeholderTextColor={TEXT_PLACEHOLDER} style={{ backgroundColor: BG_PAGE, borderRadius: 8, borderWidth: 1, borderColor: BORDER_MEDIUM, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: TEXT_PRIMARY }} />
                  </View>
                </View>
                <Text style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: '600' }}>Max slots per role</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: TEXT_MUTED, fontSize: 11 }}>Batsmen</Text>
                    <TextInput value={limitsMaxBatsmen} onChangeText={setLimitsMaxBatsmen} keyboardType="numeric" placeholder={String(league?.max_batsmen ?? '')} placeholderTextColor={TEXT_PLACEHOLDER} style={{ backgroundColor: BG_PAGE, borderRadius: 8, borderWidth: 1, borderColor: BORDER_MEDIUM, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: TEXT_PRIMARY }} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: TEXT_MUTED, fontSize: 11 }}>Wicket-Keepers</Text>
                    <TextInput value={limitsMaxWK} onChangeText={setLimitsMaxWK} keyboardType="numeric" placeholder={String(league?.max_wicket_keepers ?? '')} placeholderTextColor={TEXT_PLACEHOLDER} style={{ backgroundColor: BG_PAGE, borderRadius: 8, borderWidth: 1, borderColor: BORDER_MEDIUM, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: TEXT_PRIMARY }} />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: TEXT_MUTED, fontSize: 11 }}>All-Rounders</Text>
                    <TextInput value={limitsMaxAR} onChangeText={setLimitsMaxAR} keyboardType="numeric" placeholder={String(league?.max_all_rounders ?? '')} placeholderTextColor={TEXT_PLACEHOLDER} style={{ backgroundColor: BG_PAGE, borderRadius: 8, borderWidth: 1, borderColor: BORDER_MEDIUM, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: TEXT_PRIMARY }} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: TEXT_MUTED, fontSize: 11 }}>Bowlers</Text>
                    <TextInput value={limitsMaxBowlers} onChangeText={setLimitsMaxBowlers} keyboardType="numeric" placeholder={String(league?.max_bowlers ?? '')} placeholderTextColor={TEXT_PLACEHOLDER} style={{ backgroundColor: BG_PAGE, borderRadius: 8, borderWidth: 1, borderColor: BORDER_MEDIUM, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: TEXT_PRIMARY }} />
                  </View>
                </View>
                <TouchableOpacity
                  disabled={updateLeagueLimits.isPending}
                  onPress={async () => {
                    const payload: Record<string, number> = {}
                    if (limitsMaxTeams.trim())   payload.maxTeams         = parseInt(limitsMaxTeams, 10)
                    if (limitsRosterSize.trim())  payload.rosterSize       = parseInt(limitsRosterSize, 10)
                    if (limitsMaxBatsmen.trim())  payload.maxBatsmen       = parseInt(limitsMaxBatsmen, 10)
                    if (limitsMaxWK.trim())       payload.maxWicketKeepers = parseInt(limitsMaxWK, 10)
                    if (limitsMaxAR.trim())       payload.maxAllRounders   = parseInt(limitsMaxAR, 10)
                    if (limitsMaxBowlers.trim())  payload.maxBowlers       = parseInt(limitsMaxBowlers, 10)
                    if (Object.keys(payload).length === 0) return
                    try {
                      await updateLeagueLimits.mutateAsync({ leagueId: id!, ...payload })
                      setLimitsMaxTeams(''); setLimitsRosterSize('')
                      setLimitsMaxBatsmen(''); setLimitsMaxWK('')
                      setLimitsMaxAR(''); setLimitsMaxBowlers('')
                    } catch (err: unknown) {
                      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update limits')
                    }
                  }}
                  style={{ backgroundColor: updateLeagueLimits.isPending ? TEXT_PLACEHOLDER : TEXT_PRIMARY, borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}
                >
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>
                    {updateLeagueLimits.isPending ? 'Saving…' : 'Save Limits'}
                  </Text>
                </TouchableOpacity>
              </View>

              {scheduleMatchups && scheduleMatchups.some(m => !m.is_final) && (
                <View style={{ backgroundColor: BG_CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER_DEFAULT, gap: 8 }}>
                  <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 15 }}>Schedule</Text>
                  <Text style={{ color: TEXT_MUTED, fontSize: 13 }}>
                    Change who plays who for any week that hasn't been finalized.
                  </Text>
                  <TouchableOpacity
                    onPress={() => setScheduleAdjustOpen(true)}
                    style={{ backgroundColor: TEXT_PRIMARY, borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}
                  >
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Adjust Schedule</Text>
                  </TouchableOpacity>
                </View>
              )}

              {(isActive || isComplete) && (
                <View style={{ backgroundColor: BG_CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER_DEFAULT, gap: 8 }}>
                  <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 15 }}>Member Lineups</Text>
                  <Text style={{ color: TEXT_MUTED, fontSize: 13 }}>Set a lineup for any league member.</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setAdminLineupUserId(null)
                      setAdminLineupWeek(null)
                      setAdminLineupDraft([])
                      setAdminLineupOpen(true)
                    }}
                    style={{ backgroundColor: TEXT_PRIMARY, borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}
                  >
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Set Lineup</Text>
                  </TouchableOpacity>
                </View>
              )}

              {(isActive || isComplete) && (
                <View style={{ backgroundColor: BG_CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER_DEFAULT, gap: 8 }}>
                  <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 15 }}>Roster Management</Text>
                  <Text style={{ color: TEXT_MUTED, fontSize: 13 }}>Add or drop a player from any league member's roster.</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setAdminRosterUserId(null)
                      setAdminRosterAction(null)
                      setAdminRosterFaSearch('')
                      setAdminRosterOpen(true)
                    }}
                    style={{ backgroundColor: TEXT_PRIMARY, borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}
                  >
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Manage Roster</Text>
                  </TouchableOpacity>
                </View>
              )}

              {(isActive || isComplete) && (
                <View style={{ backgroundColor: BG_CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER_DEFAULT, gap: 10 }}>
                  <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 15 }}>Points Override</Text>
                  <Text style={{ color: TEXT_MUTED, fontSize: 13 }}>Add bonus/penalty points to a member for a specific week.</Text>

                  {/* Member picker */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {members.map(m => {
                        const sel = overrideUserId === m.user_id
                        return (
                          <TouchableOpacity
                            key={m.user_id}
                            onPress={() => setOverrideUserId(m.user_id)}
                            style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, borderWidth: 1, backgroundColor: sel ? TEXT_PRIMARY : BG_CARD, borderColor: sel ? TEXT_PRIMARY : BORDER_MEDIUM }}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '600', color: sel ? 'white' : TEXT_SECONDARY }}>
                              {m.team_name || m.display_name || m.username}
                            </Text>
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  </ScrollView>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>WEEK</Text>
                      <TextInput
                        value={overrideWeek}
                        onChangeText={setOverrideWeek}
                        keyboardType="number-pad"
                        placeholder="1"
                        placeholderTextColor={TEXT_PLACEHOLDER}
                        style={{ borderWidth: 1, borderColor: BORDER_MEDIUM, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, color: TEXT_PRIMARY, backgroundColor: BG_PAGE }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>POINTS</Text>
                      <TextInput
                        value={overridePoints}
                        onChangeText={setOverridePoints}
                        keyboardType="numbers-and-punctuation"
                        placeholder="10"
                        placeholderTextColor={TEXT_PLACEHOLDER}
                        style={{ borderWidth: 1, borderColor: BORDER_MEDIUM, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, color: TEXT_PRIMARY, backgroundColor: BG_PAGE }}
                      />
                    </View>
                  </View>

                  <TextInput
                    value={overrideNote}
                    onChangeText={setOverrideNote}
                    placeholder="Note (optional)"
                    placeholderTextColor={TEXT_PLACEHOLDER}
                    style={{ borderWidth: 1, borderColor: BORDER_MEDIUM, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: TEXT_PRIMARY, backgroundColor: BG_PAGE }}
                  />

                  <TouchableOpacity
                    onPress={async () => {
                      const pts = parseFloat(overridePoints)
                      const wk = parseInt(overrideWeek, 10)
                      if (!overrideUserId) { Alert.alert('Error', 'Select a member'); return }
                      if (!wk || isNaN(wk)) { Alert.alert('Error', 'Enter a valid week'); return }
                      if (isNaN(pts)) { Alert.alert('Error', 'Enter valid points'); return }
                      try {
                        await setOverride.mutateAsync({ userId: overrideUserId, weekNum: wk, points: pts, note: overrideNote.trim() || undefined })
                        setOverridePoints(''); setOverrideWeek(''); setOverrideNote(''); setOverrideUserId('')
                        Alert.alert('Saved', 'Points override saved.')
                      } catch (err) {
                        Alert.alert('Error', err instanceof Error ? err.message : 'Failed')
                      }
                    }}
                    disabled={setOverride.isPending}
                    style={{ backgroundColor: TEXT_PRIMARY, borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}
                  >
                    {setOverride.isPending ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Save Override</Text>}
                  </TouchableOpacity>

                  {/* Existing overrides */}
                  {(overrides ?? []).length > 0 && (
                    <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: BORDER_DEFAULT, paddingTop: 10 }}>
                      <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, fontWeight: '700' }}>EXISTING OVERRIDES</Text>
                      {(overrides ?? []).map(o => {
                        const m = members.find(mb => mb.user_id === o.user_id)
                        const name = m ? (m.team_name || m.display_name || m.username) : o.user_id
                        return (
                          <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600' }}>
                                Wk {o.week_num} · {name}
                              </Text>
                              {o.note && <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11 }}>{o.note}</Text>}
                            </View>
                            <Text style={{ color: parseFloat(String(o.points)) >= 0 ? SUCCESS : PRIMARY, fontWeight: '700', fontSize: 14 }}>
                              {parseFloat(String(o.points)) >= 0 ? '+' : ''}{o.points}
                            </Text>
                            <TouchableOpacity
                              onPress={() => Alert.alert('Remove Override', `Remove ${o.points} pts for ${name} week ${o.week_num}?`, [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Remove', style: 'destructive', onPress: () => deleteOverride.mutate({ userId: o.user_id, weekNum: o.week_num }) },
                              ])}
                            >
                              <Text style={{ color: PRIMARY, fontSize: 13, fontWeight: '600' }}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        )
                      })}
                    </View>
                  )}
                </View>
              )}

              <View style={{ backgroundColor: BG_CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: PRIMARY_SUBTLE, gap: 8 }}>
                <Text style={{ color: PRIMARY, fontWeight: '700', fontSize: 15 }}>Danger Zone</Text>
                <Button
                  label="Reset Auction"
                  variant="danger"
                  loading={deleteAuction.isPending}
                  onPress={handleDeleteAuction}
                />
                <Button
                  label="Delete League"
                  variant="danger"
                  loading={deleteLeague.isPending}
                  onPress={handleDeleteLeague}
                />
              </View>
            </View>
          )}
        </ScrollView>
        )}

        {/* Adjust Schedule Modal */}
        <Modal visible={scheduleAdjustOpen} animationType="slide" presentationStyle="pageSheet">
          <View style={{ flex: 1, backgroundColor: BG_PAGE }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', backgroundColor: BG_CARD }}>
              <NavButton label="Close" onPress={() => { setScheduleAdjustOpen(false); setScheduleEditWeek(null) }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <Text style={{ fontWeight: '800', fontSize: 22, color: TEXT_PRIMARY }}>Adjust Schedule</Text>
              {(() => {
                const allMatchups = scheduleMatchups ?? []
                const weekNums = Array.from(new Set(allMatchups.map(m => m.week_num))).sort((a, b) => a - b)
                const unfinishedWeeks = weekNums.filter(wn =>
                  allMatchups.filter(m => m.week_num === wn).some(m => !m.is_final)
                )
                if (unfinishedWeeks.length === 0) {
                  return (
                    <View style={{ alignItems: 'center', paddingTop: 40 }}>
                      <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 14 }}>No adjustable weeks remaining.</Text>
                    </View>
                  )
                }
                return unfinishedWeeks.map(wn => {
                  const weekMatchups = allMatchups.filter(m => m.week_num === wn)
                  const isEditing = scheduleEditWeek === wn
                  const drafts = scheduleEdits[wn] ?? {}
                  return (
                    <View key={wn} style={{ backgroundColor: BG_CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER_DEFAULT, overflow: 'hidden' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT }}>
                        <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 15 }}>Week {wn}</Text>
                        {!isEditing ? (
                          <TouchableOpacity
                            onPress={() => {
                              const seed: Record<string, { id: string; home_user: string; away_user: string }> = {}
                              weekMatchups.forEach(m => {
                                seed[m.id] = { id: m.id, home_user: m.home_user, away_user: m.away_user }
                              })
                              setScheduleEdits(prev => ({ ...prev, [wn]: seed }))
                              setScheduleEditWeek(wn)
                            }}
                            style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: BORDER_DEFAULT, borderRadius: 8 }}
                          >
                            <Text style={{ color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' }}>Edit</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                              onPress={() => setScheduleEditWeek(null)}
                              style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: BORDER_DEFAULT, borderRadius: 8 }}
                            >
                              <Text style={{ color: TEXT_MUTED, fontSize: 13, fontWeight: '600' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                const matchups = Object.values(drafts)
                                const allSlots = matchups.flatMap(m => [m.home_user, m.away_user])
                                const seen = new Set<string>()
                                for (const uid of allSlots) {
                                  if (!uid) {
                                    Alert.alert('Invalid Schedule', 'All matchup slots must be filled.')
                                    return
                                  }
                                  if (seen.has(uid)) {
                                    const name = members.find(mb => mb.user_id === uid)?.display_name
                                      || members.find(mb => mb.user_id === uid)?.username || uid
                                    Alert.alert('Invalid Schedule', `${name} appears in more than one matchup this week.`)
                                    return
                                  }
                                  seen.add(uid)
                                }
                                for (const m of matchups) {
                                  if (m.home_user === m.away_user) {
                                    const name = members.find(mb => mb.user_id === m.home_user)?.display_name
                                      || members.find(mb => mb.user_id === m.home_user)?.username || m.home_user
                                    Alert.alert('Invalid Schedule', `${name} cannot play against themselves.`)
                                    return
                                  }
                                }
                                updateWeekMatchups.mutate({ leagueId: id!, weekNum: wn, matchups }, {
                                  onSuccess: () => {
                                    setScheduleEditWeek(null)
                                    Alert.alert('Saved', 'Schedule updated.')
                                  },
                                  onError: (e: unknown) => Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save'),
                                })
                              }}
                              style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: PRIMARY, borderRadius: 8 }}
                            >
                              <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>
                                {updateWeekMatchups.isPending ? 'Saving…' : 'Save'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                      {weekMatchups.map((m, mi) => {
                        const draft = drafts[m.id]
                        const homeUser = isEditing && draft ? draft.home_user : m.home_user
                        const awayUser = isEditing && draft ? draft.away_user : m.away_user
                        const homeName = members.find(mb => mb.user_id === homeUser)?.display_name
                          || members.find(mb => mb.user_id === homeUser)?.username || homeUser
                        const awayName = members.find(mb => mb.user_id === awayUser)?.display_name
                          || members.find(mb => mb.user_id === awayUser)?.username || awayUser
                        return (
                          <View key={m.id} style={{ borderTopWidth: mi > 0 ? 1 : 0, borderTopColor: BORDER_DEFAULT }}>
                            <View style={{ backgroundColor: BG_PAGE, paddingHorizontal: 14, paddingVertical: 6 }}>
                              <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, fontWeight: '600' }}>Matchup {mi + 1}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 }}>
                              {isEditing ? (
                                <>
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ color: TEXT_MUTED, fontSize: 10, fontWeight: '600', marginBottom: 4 }}>HOME</Text>
                                    <View style={{ borderWidth: 1, borderColor: BORDER_MEDIUM, borderRadius: 8, overflow: 'hidden' }}>
                                      {members.map((mb, mbi) => (
                                        <TouchableOpacity
                                          key={mb.user_id}
                                          onPress={() => setScheduleEdits(prev => ({
                                            ...prev,
                                            [wn]: { ...prev[wn], [m.id]: { id: m.id, home_user: mb.user_id, away_user: prev[wn]?.[m.id]?.away_user ?? m.away_user } },
                                          }))}
                                          style={{
                                            paddingHorizontal: 10, paddingVertical: 8,
                                            backgroundColor: homeUser === mb.user_id ? PRIMARY : BG_CARD,
                                            borderTopWidth: mbi > 0 ? 1 : 0, borderTopColor: BORDER_DEFAULT,
                                          }}
                                        >
                                          <Text style={{ fontSize: 12, fontWeight: homeUser === mb.user_id ? '700' : '400', color: homeUser === mb.user_id ? 'white' : TEXT_SECONDARY }} numberOfLines={1}>
                                            {mb.display_name || mb.username}
                                          </Text>
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                  </View>
                                  <Text style={{ color: TEXT_DISABLED, fontWeight: '700', fontSize: 13 }}>vs</Text>
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ color: TEXT_MUTED, fontSize: 10, fontWeight: '600', marginBottom: 4 }}>AWAY</Text>
                                    <View style={{ borderWidth: 1, borderColor: BORDER_MEDIUM, borderRadius: 8, overflow: 'hidden' }}>
                                      {members.map((mb, mbi) => (
                                        <TouchableOpacity
                                          key={mb.user_id}
                                          onPress={() => setScheduleEdits(prev => ({
                                            ...prev,
                                            [wn]: { ...prev[wn], [m.id]: { id: m.id, home_user: prev[wn]?.[m.id]?.home_user ?? m.home_user, away_user: mb.user_id } },
                                          }))}
                                          style={{
                                            paddingHorizontal: 10, paddingVertical: 8,
                                            backgroundColor: awayUser === mb.user_id ? BG_DARK_HEADER : BG_CARD,
                                            borderTopWidth: mbi > 0 ? 1 : 0, borderTopColor: BORDER_DEFAULT,
                                          }}
                                        >
                                          <Text style={{ fontSize: 12, fontWeight: awayUser === mb.user_id ? '700' : '400', color: awayUser === mb.user_id ? 'white' : TEXT_SECONDARY }} numberOfLines={1}>
                                            {mb.display_name || mb.username}
                                          </Text>
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                  </View>
                                </>
                              ) : (
                                <>
                                  <Text style={{ flex: 1, color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{homeName}</Text>
                                  <Text style={{ color: TEXT_DISABLED, fontWeight: '700', fontSize: 13 }}>vs</Text>
                                  <Text style={{ flex: 1, color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600', textAlign: 'right' }} numberOfLines={1}>{awayName}</Text>
                                </>
                              )}
                            </View>
                          </View>
                        )
                      })}
                    </View>
                  )
                })
              })()}
            </ScrollView>
          </View>
        </Modal>

        {/* Admin Set Lineup Modal */}
        <Modal visible={adminLineupOpen} animationType="slide" presentationStyle="pageSheet">
          <View style={{ flex: 1, backgroundColor: BG_PAGE }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', backgroundColor: BG_CARD }}>
              <NavButton label="Close" onPress={() => setAdminLineupOpen(false)} />
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
              {/* Title */}
              <View style={{ gap: 2 }}>
                <Text style={{ fontWeight: '800', fontSize: 22, color: TEXT_PRIMARY }}>Set Member Lineup</Text>
                {adminLineupUserId && adminLineupWeek && (
                  <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 13 }}>{adminLineupDraft.length} selected</Text>
                )}
              </View>
              {/* Member picker */}
              <View style={{ gap: 8 }}>
                <Text style={{ color: TEXT_MUTED, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>SELECT MEMBER</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {members.map(m => {
                    const name = m.display_name || m.username
                    const selected = adminLineupUserId === m.user_id
                    return (
                      <TouchableOpacity
                        key={m.user_id}
                        onPress={() => { setAdminLineupUserId(m.user_id); setAdminLineupDraft([]) }}
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: selected ? TEXT_PRIMARY : BG_CARD, borderWidth: 1, borderColor: selected ? TEXT_PRIMARY : BORDER_MEDIUM }}
                      >
                        <Text style={{ color: selected ? 'white' : TEXT_SECONDARY, fontWeight: '600', fontSize: 13 }}>{name}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>

              {/* Week picker */}
              {adminLineupUserId && (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: TEXT_MUTED, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>SELECT WEEK</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {Array.from(new Set((scheduleMatchups ?? []).map(m => m.week_num))).sort((a, b) => a - b).map(wn => {
                        const selected = adminLineupWeek === wn
                        return (
                          <TouchableOpacity
                            key={wn}
                            onPress={() => setAdminLineupWeek(wn)}
                            style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: selected ? TEXT_PRIMARY : BG_CARD, borderWidth: 1, borderColor: selected ? TEXT_PRIMARY : BORDER_MEDIUM }}
                          >
                            <Text style={{ color: selected ? 'white' : TEXT_SECONDARY, fontWeight: '600', fontSize: 13 }}>Week {wn}</Text>
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Player toggle list */}
              {adminLineupUserId && adminLineupWeek && (
                adminLineupLoading ? (
                  <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                    <ActivityIndicator color="#111827" />
                  </View>
                ) : (() => {
                  const memberRoster = (allRosters ?? []).filter(r => r.user_id === adminLineupUserId)
                  const adRoleColors2 = importedRoleColors
                  const adRoleLabels2 = roleLabels
                  return (
                    <View style={{ gap: 10 }}>
                      <Text style={{ color: TEXT_MUTED, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
                        TAP TO ADD / REMOVE  •  {adminLineupDraft.length}/11
                      </Text>
                      <View style={{ backgroundColor: BG_CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER_DEFAULT, overflow: 'hidden' }}>
                        {memberRoster.map((player, idx) => {
                          const inLineup = adminLineupDraft.some(e => e.playerId === player.player_id)
                          const entry = adminLineupDraft.find(e => e.playerId === player.player_id)
                          const roleColor = adRoleColors2[player.player_role] ?? TEXT_MUTED
                          const roleLabel = adRoleLabels2[player.player_role] ?? player.player_role
                          return (
                            <TouchableOpacity
                              key={player.player_id}
                              onPress={() => handleAdminTogglePlayer(player)}
                              activeOpacity={0.7}
                              style={{
                                flexDirection: 'row', alignItems: 'center',
                                paddingHorizontal: 14, paddingVertical: 13,
                                borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: BG_PAGE,
                                opacity: (!inLineup && adminLineupDraft.length >= 11) ? 0.35 : 1,
                              }}
                            >
                              <View style={{
                                width: 24, height: 24, borderRadius: 12, borderWidth: 2,
                                borderColor: inLineup ? SUCCESS : TEXT_DISABLED,
                                backgroundColor: inLineup ? SUCCESS : 'transparent',
                                alignItems: 'center', justifyContent: 'center', marginRight: 12,
                              }}>
                                {inLineup && <Text style={{ color: 'white', fontSize: 13, fontWeight: '800' }}>✓</Text>}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: TEXT_PRIMARY, fontWeight: '600', fontSize: 14 }}>{player.player_name}</Text>
                                <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 12 }}>{player.player_ipl_team}</Text>
                              </View>
                              {inLineup && entry?.slotRole === 'flex' && (
                                <View style={{ backgroundColor: TEXT_MUTED + '18', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3, marginRight: 8 }}>
                                  <Text style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: '700' }}>FLEX</Text>
                                </View>
                              )}
                              <View style={{ backgroundColor: roleColor + '18', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 }}>
                                <Text style={{ color: roleColor, fontSize: 11, fontWeight: '700' }}>{roleLabel}</Text>
                              </View>
                            </TouchableOpacity>
                          )
                        })}
                        {memberRoster.length === 0 && (
                          <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                            <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 14 }}>No players on this member's roster</Text>
                          </View>
                        )}
                      </View>

                      <TouchableOpacity
                        onPress={handleAdminSaveLineup}
                        disabled={adminSetLineup.isPending || adminLineupDraft.length === 0}
                        style={{ backgroundColor: adminLineupDraft.length > 0 ? PRIMARY : BORDER_MEDIUM, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                      >
                        {adminSetLineup.isPending ? (
                          <ActivityIndicator color="white" />
                        ) : (
                          <Text style={{ color: adminLineupDraft.length > 0 ? 'white' : TEXT_PLACEHOLDER, fontWeight: '700', fontSize: 15 }}>
                            {`Save Lineup (${adminLineupDraft.length}/11)`}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )
                })()
              )}
            </ScrollView>
          </View>
        </Modal>

        {/* Admin Roster Management Modal */}
        <Modal visible={adminRosterOpen} animationType="slide" presentationStyle="pageSheet">
          <View style={{ flex: 1, backgroundColor: BG_PAGE }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', backgroundColor: BG_CARD }}>
              <NavButton label="Close" onPress={() => setAdminRosterOpen(false)} />
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
              <Text style={{ fontWeight: '800', fontSize: 22, color: TEXT_PRIMARY }}>Roster Management</Text>
              {/* Member picker */}
              <View style={{ gap: 8 }}>
                <Text style={{ color: TEXT_MUTED, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>SELECT MEMBER</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {members.map(m => {
                    const name = m.display_name || m.username
                    const selected = adminRosterUserId === m.user_id
                    return (
                      <TouchableOpacity
                        key={m.user_id}
                        onPress={() => { setAdminRosterUserId(m.user_id); setAdminRosterAction(null); setAdminRosterFaSearch('') }}
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: selected ? TEXT_PRIMARY : BG_CARD, borderWidth: 1, borderColor: selected ? TEXT_PRIMARY : BORDER_MEDIUM }}
                      >
                        <Text style={{ color: selected ? 'white' : TEXT_SECONDARY, fontWeight: '600', fontSize: 13 }}>{name}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>

              {/* Action picker */}
              {adminRosterUserId && (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: TEXT_MUTED, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>ACTION</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {(['drop', 'add'] as const).map(action => (
                      <TouchableOpacity
                        key={action}
                        onPress={() => { setAdminRosterAction(action); setAdminRosterFaSearch('') }}
                        style={{
                          flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
                          backgroundColor: adminRosterAction === action ? TEXT_PRIMARY : BG_CARD,
                          borderWidth: 1, borderColor: adminRosterAction === action ? TEXT_PRIMARY : BORDER_MEDIUM,
                        }}
                      >
                        <Text style={{ color: adminRosterAction === action ? 'white' : TEXT_SECONDARY, fontWeight: '700', fontSize: 14 }}>
                          {action === 'drop' ? 'Drop Player' : 'Add Player'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Drop: show member roster */}
              {adminRosterUserId && adminRosterAction === 'drop' && (() => {
                const memberRoster = (allRosters ?? []).filter(r => r.user_id === adminRosterUserId)
                const adRoleColors = importedRoleColors
                const adRoleLabels = roleLabels
                return (
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: TEXT_MUTED, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>TAP TO DROP</Text>
                    <View style={{ backgroundColor: BG_CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER_DEFAULT, overflow: 'hidden' }}>
                      {memberRoster.length === 0 ? (
                        <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                          <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 14 }}>No players on this roster</Text>
                        </View>
                      ) : memberRoster.map((player, idx) => {
                        const roleColor = adRoleColors[player.player_role] ?? TEXT_MUTED
                        const roleLabel = adRoleLabels[player.player_role] ?? player.player_role
                        return (
                          <TouchableOpacity
                            key={player.player_id}
                            activeOpacity={0.7}
                            onPress={() => {
                              Alert.alert(
                                'Drop Player',
                                `Drop ${player.player_name} from this roster?`,
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Drop',
                                    style: 'destructive',
                                    onPress: () => {
                                      adminDropPlayer.mutate(
                                        { targetUserId: adminRosterUserId!, playerId: player.player_id },
                                        { onSuccess: () => Alert.alert('Done', `${player.player_name} dropped.`) }
                                      )
                                    },
                                  },
                                ]
                              )
                            }}
                            style={{
                              flexDirection: 'row', alignItems: 'center',
                              paddingHorizontal: 14, paddingVertical: 13,
                              borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: BG_PAGE,
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: TEXT_PRIMARY, fontWeight: '600', fontSize: 14 }}>{player.player_name}</Text>
                              <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 12 }}>{player.player_ipl_team}</Text>
                            </View>
                            <View style={{ backgroundColor: roleColor + '18', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 }}>
                              <Text style={{ color: roleColor, fontSize: 11, fontWeight: '700' }}>{roleLabel}</Text>
                            </View>
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  </View>
                )
              })()}

              {/* Add: search free agents */}
              {adminRosterUserId && adminRosterAction === 'add' && (() => {
                const memberRoster = (allRosters ?? []).filter(r => r.user_id === adminRosterUserId)
                const rosterFull = memberRoster.length >= (league?.roster_size ?? 16)
                const adRoleColors = importedRoleColors
                const adRoleLabels = roleLabels
                const filteredFa = (freeAgents ?? []).filter(p =>
                  !adminRosterFaSearch || p.name.toLowerCase().includes(adminRosterFaSearch.toLowerCase()) || p.ipl_team.toLowerCase().includes(adminRosterFaSearch.toLowerCase())
                )
                return (
                  <View style={{ gap: 8 }}>
                    {rosterFull && (
                      <View style={{ backgroundColor: WARNING_BG, borderRadius: 10, padding: 12 }}>
                        <Text style={{ color: WARNING_DARKER, fontSize: 13, fontWeight: '600' }}>Roster is full — adding a player will require dropping one first.</Text>
                      </View>
                    )}
                    <SearchBar
                      value={adminRosterFaSearch}
                      onChangeText={setAdminRosterFaSearch}
                      placeholder="Search free agents…"
                    />
                    <View style={{ backgroundColor: BG_CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER_DEFAULT, overflow: 'hidden' }}>
                      {filteredFa.length === 0 ? (
                        <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                          <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 14 }}>No free agents found</Text>
                        </View>
                      ) : filteredFa.slice(0, 50).map((player, idx) => {
                        const roleColor = adRoleColors[player.role] ?? TEXT_MUTED
                        const roleLabel = adRoleLabels[player.role] ?? player.role
                        return (
                          <TouchableOpacity
                            key={player.id}
                            activeOpacity={0.7}
                            onPress={() => {
                              if (rosterFull) {
                                Alert.alert(
                                  'Roster Full',
                                  `To add ${player.name}, you must first drop a player from this roster.`,
                                  [{ text: 'OK' }]
                                )
                                return
                              }
                              Alert.alert(
                                'Add Player',
                                `Add ${player.name} to this roster?`,
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Add',
                                    onPress: () => {
                                      adminAddPlayer.mutate(
                                        { targetUserId: adminRosterUserId!, playerId: player.id },
                                        { onSuccess: () => Alert.alert('Done', `${player.name} added.`) }
                                      )
                                    },
                                  },
                                ]
                              )
                            }}
                            style={{
                              flexDirection: 'row', alignItems: 'center',
                              paddingHorizontal: 14, paddingVertical: 13,
                              borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: BG_PAGE,
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: TEXT_PRIMARY, fontWeight: '600', fontSize: 14 }}>{player.name}</Text>
                              <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 12 }}>{player.ipl_team}</Text>
                            </View>
                            <View style={{ backgroundColor: roleColor + '18', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 }}>
                              <Text style={{ color: roleColor, fontSize: 11, fontWeight: '700' }}>{roleLabel}</Text>
                            </View>
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  </View>
                )
              })()}
            </ScrollView>
          </View>
        </Modal>

        <LoadingOverlay visible={adminDropPlayer.isPending} message="Dropping player…" />
        <LoadingOverlay visible={adminAddPlayer.isPending} message="Adding player…" />

        <LoadingOverlay visible={addPlayerMutation.isPending && !dropPickerVisible} message="Adding player…" />
        <LoadingOverlay visible={dropPlayerMutation.isPending} message="Dropping player…" />

        {/* Player detail modal — active league Players tab */}
        <PlayerDetailModal
          visible={lpSelectedPlayer !== null}
          player={lpSelectedPlayer ? {
            name: lpSelectedPlayer.name,
            ipl_team: lpSelectedPlayer.ipl_team,
            role: lpSelectedPlayer.role,
            nationality: lpSelectedPlayer.nationality,
            base_price: lpSelectedPlayer.base_price,
            total_points: lpSelectedPlayer.total_points,
            team_games_played: lpSelectedPlayer.team_games_played,
            image_url: lpSelectedPlayer.image_url,
          } : null}
          playerId={lpSelectedPlayer?.player_id}
          currency={league.currency}
          onClose={() => setLpSelectedPlayer(null)}
          alreadyOnTeam={lpSelectedPlayer ? myCurrentRoster.some(r => r.player_id === lpSelectedPlayer.player_id) : false}
          onAdd={lpSelectedPlayer ? () => {
            const p = lpSelectedPlayer
            setLpSelectedPlayer(null)
            setTimeout(() => handleSelectFreeAgent({
              id: p.player_id,
              name: p.name,
              role: p.role,
              ipl_team: p.ipl_team,
              base_price: p.base_price,
            }), 300)
          } : undefined}
        />

        {/* Free agent picker */}
        <Modal visible={addModalVisible} animationType="slide" presentationStyle="pageSheet">
          <View style={{ flex: 1, backgroundColor: BG_CARD }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
              <NavButton label="Cancel" onPress={() => setAddModalVisible(false)} />
            </View>
            <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 }}>
              <Text style={{ fontWeight: '800', fontSize: 22, color: TEXT_PRIMARY }}>Add Free Agent</Text>
              <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 13, marginTop: 2, marginBottom: 12 }}>
                {rosterFull ? 'Roster full — you must also drop a player' : `${myCurrentRoster.length} / ${league.roster_size} roster spots used`}
              </Text>
              <SearchBar
                value={faSearch}
                onChangeText={setFaSearch}
                placeholder="Search by name or team…"
              />
            </View>
            {faLoading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={PRIMARY} />
              </View>
            ) : (
              <FlatList
                data={filteredFreeAgents}
                keyExtractor={p => p.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handleSelectFreeAgent(item)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BG_PAGE }}
                  >
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: adRoleColors[item.role] ?? TEXT_MUTED, marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: TEXT_PRIMARY, fontWeight: '600', fontSize: 15 }}>{item.name}</Text>
                      <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 13 }}>{item.ipl_team}</Text>
                    </View>
                    <View style={{ backgroundColor: BORDER_DEFAULT, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginRight: 10 }}>
                      <Text style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: '700' }}>{adRoleLabels[item.role] ?? item.role}</Text>
                    </View>
                    <Text style={{ color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' }}>
                      {formatCurrency(item.base_price, league.currency)}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={{ padding: 48, alignItems: 'center' }}>
                    <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 15 }}>
                      {faSearch ? 'No players match your search' : 'No free agents available'}
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </Modal>

        {/* Drop picker (roster full or role limit reached) */}
        <Modal
          visible={dropPickerVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onDismiss={() => { setDropConfirmItem(null); dropConfirmItemRef.current = null; dropSlide.setValue(0) }}
        >
          <View style={{ flex: 1, backgroundColor: BG_PAGE, overflow: 'hidden' }}>
            {/* Header */}
            <View style={{ backgroundColor: BG_CARD, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER_DEFAULT, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              {dropConfirmItem ? (
                <NavButton
                  label="← Back"
                  onPress={() => {
                    Animated.timing(dropSlide, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setDropConfirmItem(null))
                  }}
                />
              ) : (
                <View />
              )}
              <NavButton label="Cancel" onPress={() => { setDropPickerVisible(false); setSelectedFreeAgent(null); setDropRoleFilter(null); setDropConfirmItem(null); dropConfirmItemRef.current = null; dropSlide.setValue(0) }} />
            </View>

            {/* Sliding pages container */}
            <View style={{ flex: 1 }}>
              {/* ── Player list page (always rendered, slides left on confirm) ── */}
              <Animated.View style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: BG_PAGE,
                transform: [{ translateX: dropSlide.interpolate({ inputRange: [0, 1], outputRange: [0, -SCREEN_W] }) }],
              }}>
                <Text style={{ fontWeight: '800', fontSize: 22, color: TEXT_PRIMARY, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 }}>Drop a Player</Text>
                {/* Adding context banner */}
                {selectedFreeAgent && (
                  <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 6 }}>
                    <Text style={{ color: '#15803d', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>Adding</Text>
                    <PlayerRow
                      role={selectedFreeAgent.role}
                      name={selectedFreeAgent.name}
                      iplTeam={selectedFreeAgent.ipl_team}
                      backgroundColor={SUCCESS_BG}
                      borderColor="#bbf7d0"
                    />
                    <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 12, textAlign: 'center', paddingBottom: 6 }}>
                      {dropRoleFilter
                        ? `${adRoleFullLabels[dropRoleFilter]} slot full — select one to drop`
                        : 'Roster full — select a player to drop'}
                    </Text>
                  </View>
                )}

                {/* Squad list grouped by role — same design as Teams tab */}
                {(() => {
                  const ROLE_ORDER_DROP = ['batsman', 'wicket_keeper', 'all_rounder', 'bowler']
                  const ROLE_GROUP_LABELS: Record<string, string> = {
                    batsman: 'Batsmen', bowler: 'Bowlers', all_rounder: 'All-Rounders', wicket_keeper: 'Wicket Keepers',
                  }
                  const source = dropRoleFilter
                    ? myCurrentRoster.filter(r => r.player_role === dropRoleFilter)
                    : myCurrentRoster
                  const byRole = ROLE_ORDER_DROP.reduce<Record<string, typeof source>>((acc, role) => {
                    acc[role] = source.filter(r => r.player_role === role)
                    return acc
                  }, {})
                  const groups = ROLE_ORDER_DROP.filter(role => (byRole[role]?.length ?? 0) > 0)

                  return (
                    <ScrollView contentContainerStyle={{ padding: 16 }}>
                      <View style={{ backgroundColor: BG_CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER_DEFAULT, overflow: 'hidden' }}>
                        {groups.map((role, groupIdx) => {
                          const group = byRole[role]!
                          const roleColor = adRoleColors[role] ?? TEXT_MUTED
                          return (
                            <View key={role}>
                              {/* Role group header */}
                              <View style={{ backgroundColor: BG_PAGE, paddingHorizontal: 16, paddingVertical: 7, borderTopWidth: groupIdx === 0 ? 0 : 1, borderTopColor: BORDER_DEFAULT, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ backgroundColor: roleColor + '20', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                                  <Text style={{ color: roleColor, fontSize: 10, fontWeight: '700' }}>{adRoleLabels[role] ?? role}</Text>
                                </View>
                                <Text style={{ color: TEXT_MUTED, fontSize: 11, fontWeight: '600' }}>{ROLE_GROUP_LABELS[role] ?? role}</Text>
                                <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, marginLeft: 'auto' }}>{group.length}</Text>
                              </View>
                              {group.map(item => {
                                const avgPts = item.team_games_played > 0 ? item.total_points / item.team_games_played : null
                                return (
                                  <View
                                    key={item.player_id}
                                    style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 12, gap: 10, borderTopWidth: 1, borderTopColor: BORDER_DEFAULT }}
                                  >
                                    <Avatar uri={item.player_image_url} name={item.player_name} size={32} neutralFallback />
                                    <View style={{ flex: 1, paddingVertical: 11 }}>
                                      <Text style={{ color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{item.player_name}</Text>
                                      <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 11, marginTop: 1 }}>{item.player_ipl_team}</Text>
                                    </View>
                                    {avgPts != null ? (
                                      <View style={{ alignItems: 'flex-end', marginRight: 12 }}>
                                        <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 13 }}>{Math.round(avgPts)}</Text>
                                        <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 9, fontWeight: '500' }}>avg pts</Text>
                                      </View>
                                    ) : (
                                      <Text style={{ color: TEXT_DISABLED, fontSize: 12, marginRight: 12 }}>—</Text>
                                    )}
                                    <TouchableOpacity
                                      onPress={() => {
                                        dropConfirmItemRef.current = item
                                        setDropConfirmItem(item)
                                        Animated.timing(dropSlide, { toValue: 1, duration: 250, useNativeDriver: true }).start()
                                      }}
                                      style={{ backgroundColor: PRIMARY_BG, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: PRIMARY_BORDER }}
                                    >
                                      <Text style={{ color: PRIMARY, fontSize: 13, fontWeight: '700' }}>Drop</Text>
                                    </TouchableOpacity>
                                  </View>
                                )
                              })}
                            </View>
                          )
                        })}
                      </View>
                    </ScrollView>
                  )
                })()}
              </Animated.View>

              {/* ── Confirmation page (slides in from the right) ── */}
              <Animated.View style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: BG_PAGE,
                transform: [{ translateX: dropSlide.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_W, 0] }) }],
              }}>
                {(() => {
                  // Use ref as fallback so content is available on every animation frame,
                  // even before the async state update commits.
                  const item = dropConfirmItem ?? dropConfirmItemRef.current
                  if (!item) return null
                  return (
                    <View style={{ flex: 1, padding: 20, gap: 16 }}>
                      <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 16, textAlign: 'center' }}>Confirm Transaction</Text>

                      {/* Adding */}
                      {selectedFreeAgent && (
                        <View style={{ gap: 6 }}>
                          <Text style={{ color: '#15803d', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>Adding</Text>
                          <PlayerRow
                            role={selectedFreeAgent.role}
                            name={selectedFreeAgent.name}
                            iplTeam={selectedFreeAgent.ipl_team}
                            imageUrl={selectedFreeAgent.image_url}
                            backgroundColor={SUCCESS_BG}
                            borderColor="#bbf7d0"
                          />
                        </View>
                      )}

                      {/* Dropping */}
                      <View style={{ gap: 6 }}>
                        <Text style={{ color: PRIMARY, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>Dropping</Text>
                        <PlayerRow
                          role={item.player_role}
                          name={item.player_name}
                          iplTeam={item.player_ipl_team}
                          imageUrl={item.player_image_url}
                          avgPts={item.team_games_played > 0 ? item.total_points / item.team_games_played : null}
                          backgroundColor={PRIMARY_BG}
                          borderColor={PRIMARY_BORDER}
                        />
                      </View>

                      {/* Confirm button */}
                      <TouchableOpacity
                        onPress={() => confirmAddPlayer(selectedFreeAgent!.id, item.player_id)}
                        disabled={addPlayerMutation.isPending}
                        style={{ backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 }}
                      >
                        {addPlayerMutation.isPending ? (
                          <ActivityIndicator color="white" />
                        ) : (
                          <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Confirm</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )
                })()}
              </Animated.View>
            </View>
          </View>
        </Modal>
      </View>
    )
  }

  // ── Pre-draft / draft-active: existing layout ──

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollRef}
        className="flex-1 bg-gray-50"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={PRIMARY_SOFT} />}
      >
        <View className="p-4 gap-4">
          {/* Header */}
          <View className="bg-white rounded-2xl p-4 gap-3 border border-gray-100 shadow-sm">
            <View className="flex-row items-start justify-between">
              <Text className="text-gray-900 text-2xl font-bold flex-1 mr-3">{league.name}</Text>
            </View>

            <View className="flex-row gap-2 items-center">
              <Text className="text-gray-500 text-sm">Invite Code:</Text>
              <View className="bg-gray-100 rounded-lg px-3 py-1.5">
                <Text className="text-red-600 text-base font-mono font-bold tracking-widest">
                  {league.invite_code}
                </Text>
              </View>
            </View>

            <View className="flex-row flex-wrap gap-4">
              <View>
                <Text className="text-gray-400 text-xs">Teams</Text>
                <Text className="text-gray-900 font-medium">{members.length}/{league.max_teams}</Text>
              </View>
              <View>
                <Text className="text-gray-400 text-xs">Roster Size</Text>
                <Text className="text-gray-900 font-medium">{league.roster_size}</Text>
              </View>
              <View>
                <Text className="text-gray-400 text-xs">Timer</Text>
                <Text className="text-gray-900 font-medium">{league.bid_timeout_secs}s</Text>
              </View>
            </View>
          </View>

          {/* Members */}
          <View className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <Text className="text-gray-900 font-bold text-lg mb-3">Members ({members.length})</Text>
            <MemberList
              members={members}
              adminId={league.admin_id}
            />
          </View>

          {/* Draft Wishlist card (draft_pending only) */}
          {isDraftPending && (
            <View
              onLayout={(e) => setWishlistY(e.nativeEvent.layout.y)}
              style={{ backgroundColor: BG_CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER_DEFAULT, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, overflow: 'hidden' }}
            >
              <View style={{ padding: 16, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, marginRight: 12, gap: 2 }}>
                    <Text style={{ color: TEXT_PRIMARY, fontWeight: '700', fontSize: 17 }}>Draft Wishlist</Text>
                    <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 12 }}>
                      Tap players you want — they'll be called up first in the draft.
                    </Text>
                  </View>
                  {myInterests.size > 0 && (
                    <View style={{ backgroundColor: SUCCESS, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, flexShrink: 0 }}>
                      <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>{myInterests.size} added</Text>
                    </View>
                  )}
                </View>
                <SearchBar
                  value={playerSearch}
                  onChangeText={setPlayerSearch}
                  onFocus={() => scrollRef.current?.scrollTo({ y: wishlistY, animated: true })}
                  placeholder="Search by name or team…"
                />

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row' }}>
                    {wishlistRoleChips.map(({ label, value }) => (
                      <TouchableOpacity
                        key={label}
                        onPress={() => setPlayerRoleFilter(value)}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: playerRoleFilter === value ? PRIMARY : BORDER_DEFAULT, borderWidth: 1, borderColor: playerRoleFilter === value ? PRIMARY : BORDER_MEDIUM, marginRight: 6 }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: playerRoleFilter === value ? BG_CARD : TEXT_MUTED }}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity
                      onPress={() => setPlayerTeamFilter(null)}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: playerTeamFilter === null ? PRIMARY : BORDER_DEFAULT, borderWidth: 1, borderColor: playerTeamFilter === null ? PRIMARY : BORDER_MEDIUM, marginRight: 6 }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: playerTeamFilter === null ? BG_CARD : TEXT_MUTED }}>All Teams</Text>
                    </TouchableOpacity>
                    {[...new Set((playersData ?? []).map(p => p.ipl_team))].sort().map(team => (
                      <TouchableOpacity
                        key={team}
                        onPress={() => setPlayerTeamFilter(team)}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: playerTeamFilter === team ? PRIMARY : BORDER_DEFAULT, borderWidth: 1, borderColor: playerTeamFilter === team ? PRIMARY : BORDER_MEDIUM, marginRight: 6 }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: playerTeamFilter === team ? BG_CARD : TEXT_MUTED }}>{team}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {!playersData ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Text style={{ color: TEXT_PLACEHOLDER }}>Loading players...</Text>
                </View>
              ) : filteredPlayers.length === 0 ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Text style={{ color: TEXT_PLACEHOLDER }}>No players found</Text>
                </View>
              ) : (
                <>
                  {interested.length > 0 && (
                    <>
                      <TouchableOpacity
                        onPress={() => setInterestedCollapsed(c => !c)}
                        activeOpacity={0.7}
                        style={{ backgroundColor: SUCCESS_BG, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: BORDER_DEFAULT, borderBottomWidth: interestedCollapsed ? 0 : 1, borderBottomColor: '#bbf7d0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <Text style={{ color: SUCCESS, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
                          INTERESTED PLAYERS ({interested.length})
                        </Text>
                        <Text style={{ color: '#4ade80', fontSize: 12 }}>{interestedCollapsed ? '▼' : '▲'}</Text>
                      </TouchableOpacity>
                      {!interestedCollapsed && interested.map((p, i) => renderPlayer(p, i, 'interested'))}
                    </>
                  )}

                  {others.length > 0 && (
                    <>
                      <TouchableOpacity
                        onPress={() => setAllPlayersCollapsed(c => !c)}
                        activeOpacity={0.7}
                        style={{ backgroundColor: BG_PAGE, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: BORDER_DEFAULT, borderBottomWidth: allPlayersCollapsed ? 0 : 1, borderBottomColor: BORDER_DEFAULT, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <Text style={{ color: TEXT_MUTED, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
                          ALL PLAYERS ({others.length})
                        </Text>
                        <Text style={{ color: TEXT_PLACEHOLDER, fontSize: 12 }}>{allPlayersCollapsed ? '▼' : '▲'}</Text>
                      </TouchableOpacity>
                      {!allPlayersCollapsed && others.map((p, i) => renderPlayer(p, i, 'others'))}
                    </>
                  )}
                </>
              )}
            </View>
          )}

          {/* Navigation */}
          <View className="gap-2">
            {isDraftPending && isAdmin && (
              <Button
                label="Start Draft"
                variant="primary"
                size="lg"
                loading={advanceStatus.isPending}
                onPress={handleStartDraft}
              />
            )}

            {isDraftPending && !isAdmin && (
              <View className="bg-white rounded-xl p-3 items-center border border-gray-100">
                <Text className="text-gray-500 text-sm">Waiting for admin to start the draft...</Text>
              </View>
            )}

            {isDraftActive && (
              <Button
                label="Enter Draft Room"
                variant="primary"
                size="lg"
                onPress={() => router.push(`/(app)/auction/${id}`)}
              />
            )}
          </View>

          {/* Leave */}
          {!isAdmin && (
            <Button label="Leave League" variant="danger" onPress={handleLeave} />
          )}

          {/* Delete Auction — admin only, only after draft has started */}
          {isAdmin && !isDraftPending && (
            <Button
              label="Reset Auction"
              variant="danger"
              loading={deleteAuction.isPending}
              onPress={handleDeleteAuction}
            />
          )}

          {/* Delete League — admin only */}
          {isAdmin && (
            <Button
              label="Delete League"
              variant="danger"
              loading={deleteLeague.isPending}
              onPress={handleDeleteLeague}
            />
          )}
        </View>
      </ScrollView>

    </KeyboardAvoidingView>
  )
}
