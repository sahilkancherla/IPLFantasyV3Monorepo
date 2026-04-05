import { useState, useRef, useEffect } from 'react'
import {
  View, Text, ScrollView, Alert, RefreshControl, TouchableOpacity,
  TextInput, FlatList, KeyboardAvoidingView, Platform, Modal, ActivityIndicator,
} from 'react-native'
import { formatCurrency, playerBasePrice } from '../../../lib/currency'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { MemberList } from '../../../components/league/MemberList'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { useLeague, useLeaveLeague, useAdvanceLeagueStatus, useDeleteAuction, useDeleteLeague, useUpdateWeekMatchups } from '../../../hooks/useLeague'
import { usePlayerInterests, useToggleInterest, useAvailablePlayers } from '../../../hooks/useAuctionInterests'
import { useAllTeams, useLeaderboard, useDropPlayer, useAddPlayer, type RosterEntry } from '../../../hooks/useTeam'
import { useFreeAgents, type FreeAgent } from '../../../hooks/useWaivers'
import { useLeagueHome } from '../../../hooks/useLeagueHome'
import { useLeagueSchedule, useAllWeeks } from '../../../hooks/useMatchup'
import { SquadGrid } from '../../../components/team/SquadGrid'
import { MatchupsTab } from '../../../components/league/MatchupsTab'
import { PlayerDetailModal } from '../../../components/league/PlayerDetailModal'
import { LoadingScreen, LoadingOverlay } from '../../../components/ui/Loading'
import { Avatar } from '../../../components/ui/Avatar'
import { useAuthStore } from '../../../stores/authStore'
import { api } from '../../../lib/api'
import { useQuery } from '@tanstack/react-query'
import { useAdminSetLineup, useUserLineup } from '../../../hooks/useLineup'


interface PlayerRow {
  id: string
  name: string
  ipl_team: string
  role: string
  base_price: number
  nationality: string
}

const roleLabels: Record<string, string> = {
  batsman: 'BAT',
  bowler: 'BOW',
  all_rounder: 'AR',
  wicket_keeper: 'WK',
}

const ROLE_ORDER: Record<string, number> = {
  batsman: 0, wicket_keeper: 1, all_rounder: 2, bowler: 3, flex: 4,
}
function sortByRole<T extends { playerRole?: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => (ROLE_ORDER[a.playerRole ?? ''] ?? 5) - (ROLE_ORDER[b.playerRole ?? ''] ?? 5))
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
  const [activeLeagueTab, setActiveLeagueTab] = useState('home')

  // Teams tab state
  const [teamsSubTab, setTeamsSubTab] = useState<'squads' | 'points'>('squads')
  const [selectedTeamUserId, setSelectedTeamUserId] = useState<string | null>(null)

  // Add/drop state
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [faSearch, setFaSearch] = useState('')
  const [selectedFreeAgent, setSelectedFreeAgent] = useState<FreeAgent | null>(null)
  const [dropPickerVisible, setDropPickerVisible] = useState(false)
  const [dropRoleFilter, setDropRoleFilter] = useState<string | null>(null)

  // Player detail modal (active league Players tab)
  const [lpSelectedPlayer, setLpSelectedPlayer] = useState<{
    player_id: string; name: string; ipl_team: string; role: string
    nationality: string; base_price: number; sold_price?: number | null; status: string
  } | null>(null)

  // Admin Set Lineup state
  const [adminLineupOpen, setAdminLineupOpen] = useState(false)
  const [adminLineupUserId, setAdminLineupUserId] = useState<string | null>(null)
  const [adminLineupWeek, setAdminLineupWeek] = useState<number | null>(null)
  const [adminLineupDraft, setAdminLineupDraft] = useState<Array<{ playerId: string; slotRole: string }>>([])

  // Players tab filters (active league state)
  const [lpSearch, setLpSearch] = useState('')
  const [lpRoleFilter, setLpRoleFilter] = useState<string | null>(null)
  const [lpTeamFilter, setLpTeamFilter] = useState<string | null>(null)
  const [lpMaxPrice, setLpMaxPrice] = useState('')
  const [lpHideSold, setLpHideSold] = useState(true)

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
  const { data: availableData } = useAvailablePlayers((isActive || isComplete) ? id! : '')
  const { data: allRosters } = useAllTeams((isActive || isComplete) ? id! : '')
  const { data: leaderboard } = useLeaderboard((isActive || isComplete) ? id! : '')
  const { data: homeData, refetch: refetchHome } = useLeagueHome(id!)
  const { data: scheduleMatchups, isLoading: matchupsLoading } = useLeagueSchedule((isActive || isComplete) ? id! : '')
  const { data: allWeeks, isLoading: weeksLoading } = useAllWeeks()
  const { data: interestData } = usePlayerInterests(isDraftPending ? id! : '')
  const toggleInterest = useToggleInterest(id!)
  const { data: freeAgents, isLoading: faLoading } = useFreeAgents(id!)
  const dropPlayerMutation = useDropPlayer(id!)
  const addPlayerMutation = useAddPlayer(id!)
  const adminSetLineup = useAdminSetLineup(id!)
  const { data: adminLineupData, isLoading: adminLineupLoading } = useUserLineup(
    id!, adminLineupUserId ?? '', adminLineupWeek ?? 0
  )

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
          borderTopWidth: index > 0 ? 1 : 0, borderTopColor: '#f3f4f6',
          backgroundColor: isInterested ? '#f0fdf4' : 'white',
        }}
      >
        <View style={{
          width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
          backgroundColor: isInterested ? '#16a34a' : '#f3f4f6',
          flexShrink: 0,
        }}>
          <Text style={{ fontSize: 13, color: isInterested ? 'white' : '#9ca3af' }}>
            {isInterested ? '★' : '☆'}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: '#111827', fontWeight: '600', fontSize: 14 }}>{item.name}</Text>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <Text style={{ color: '#9ca3af', fontSize: 12 }}>{item.ipl_team}</Text>
            <Badge label={roleLabels[item.role] ?? item.role} color={roleBadgeColors[item.role] ?? 'gray'} />
            {item.nationality !== 'Indian' && <Badge label="OS" color="yellow" />}
            <Text style={{ color: '#9ca3af', fontSize: 12 }}>{formatCurrency(item.base_price, league!.currency)}</Text>
          </View>
        </View>
        {count > 1 && <Text style={{ color: '#9ca3af', fontSize: 11 }}>{count} want</Text>}
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
  const adRoleColors: Record<string, string> = {
    batsman: '#2563eb', bowler: '#dc2626', all_rounder: '#16a34a', wicket_keeper: '#d97706',
  }
  const adRoleLabels: Record<string, string> = {
    batsman: 'BAT', bowler: 'BOW', all_rounder: 'AR', wicket_keeper: 'WK',
  }
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
      { key: 'home',     label: 'Home' },
      { key: 'matchups', label: 'Matchups' },
      { key: 'players',  label: 'Players' },
      { key: 'teams',    label: 'Teams' },
      { key: 'schedule', label: 'Schedule' },
      { key: 'settings', label: 'Settings' },
      ...(isAdmin ? [{ key: 'admin', label: 'Admin' }] : []),
    ]

    return (
      <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        <Stack.Screen options={{
          title: league.name,
          headerBackVisible: false,
          headerLeft: () => (
            <Text
              onPress={() => router.back()}
              style={{ color: '#9ca3af', fontSize: 14 }}
            >← Home</Text>
          ),
        }} />

        {/* Tab bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', flexGrow: 0 }}
          contentContainerStyle={{ flexDirection: 'row' }}
        >
          {leagueTabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveLeagueTab(tab.key)}
              style={{
                paddingHorizontal: 16, paddingVertical: 12,
                borderBottomWidth: 2,
                borderBottomColor: activeLeagueTab === tab.key ? '#dc2626' : 'transparent',
              }}
            >
              <Text style={{
                fontSize: 13, fontWeight: '600',
                color: activeLeagueTab === tab.key ? '#dc2626' : '#9ca3af',
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
          />
        )}

        {/* Players tab — FlatList takes full flex:1 directly, no wrapping ScrollView */}
        {activeLeagueTab === 'players' && (() => {
          const allPlayers = availableData?.players ?? []
          const uniqueTeams = [...new Set(allPlayers.map(p => p.ipl_team))].sort()
          const currency = league.currency
          const maxPriceNum = lpMaxPrice ? parseInt(lpMaxPrice, 10) : null

          const filtered = allPlayers.filter(p => {
            if (lpHideSold && p.status === 'sold') return false
            if (lpSearch && !p.name.toLowerCase().includes(lpSearch.toLowerCase()) &&
                !p.ipl_team.toLowerCase().includes(lpSearch.toLowerCase())) return false
            if (lpRoleFilter && p.role !== lpRoleFilter) return false
            if (lpTeamFilter && p.ipl_team !== lpTeamFilter) return false
            if (maxPriceNum !== null && !isNaN(maxPriceNum) && playerBasePrice(p, currency) > maxPriceNum) return false
            return true
          })

          const chipStyle = (active: boolean) => ({
            paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20,
            backgroundColor: active ? '#dc2626' : '#ffffff',
            borderWidth: 1, borderColor: active ? '#dc2626' : '#e5e7eb',
            marginRight: 7,
          })
          const chipText = (active: boolean) => ({
            fontSize: 12, fontWeight: '600' as const,
            color: active ? '#ffffff' : '#374151',
          })
          const roleChips = [
            { label: 'All', value: null },
            { label: 'BAT', value: 'batsman' },
            { label: 'WK', value: 'wicket_keeper' },
            { label: 'AR', value: 'all_rounder' },
            { label: 'BOWL', value: 'bowler' },
          ]

          return (
            <FlatList
              style={{ flex: 1 }}
              data={filtered}
              keyExtractor={p => p.player_id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <View style={{ gap: 10, paddingTop: 12, paddingBottom: 8 }}>
                  <TextInput
                    value={lpSearch}
                    onChangeText={setLpSearch}
                    placeholder="Search by name or team…"
                    placeholderTextColor="#9ca3af"
                    style={{
                      backgroundColor: '#ffffff', borderRadius: 12,
                      paddingHorizontal: 14, paddingVertical: 10,
                      fontSize: 14, color: '#111827',
                      borderWidth: 1, borderColor: '#e5e7eb',
                    }}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row' }}>
                      {roleChips.map(({ label, value }) => (
                        <TouchableOpacity key={label} onPress={() => setLpRoleFilter(value)} style={chipStyle(lpRoleFilter === value)}>
                          <Text style={chipText(lpRoleFilter === value)}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row' }}>
                      <TouchableOpacity onPress={() => setLpTeamFilter(null)} style={chipStyle(lpTeamFilter === null)}>
                        <Text style={chipText(lpTeamFilter === null)}>All Teams</Text>
                      </TouchableOpacity>
                      {uniqueTeams.map(team => (
                        <TouchableOpacity key={team} onPress={() => setLpTeamFilter(team)} style={chipStyle(lpTeamFilter === team)}>
                          <Text style={chipText(lpTeamFilter === team)}>{team}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <View style={{
                      flex: 1, flexDirection: 'row', alignItems: 'center',
                      backgroundColor: '#ffffff', borderRadius: 12,
                      borderWidth: 1, borderColor: '#e5e7eb',
                      paddingHorizontal: 12, paddingVertical: 8,
                    }}>
                      <Text style={{ color: '#9ca3af', fontSize: 13, marginRight: 4 }}>{currency === 'usd' ? 'Max $' : 'Max ₹'}</Text>
                      <TextInput
                        value={lpMaxPrice}
                        onChangeText={setLpMaxPrice}
                        placeholder="any"
                        placeholderTextColor="#9ca3af"
                        keyboardType="number-pad"
                        style={{ flex: 1, fontSize: 13, color: '#111827', padding: 0 }}
                      />
                      <Text style={{ color: '#9ca3af', fontSize: 13 }}>L</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setLpHideSold(v => !v)}
                      style={{
                        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
                        backgroundColor: lpHideSold ? '#f3f4f6' : '#dc2626',
                        borderWidth: 1, borderColor: lpHideSold ? '#e5e7eb' : '#dc2626',
                      }}
                    >
                      <Text style={{ color: lpHideSold ? '#6b7280' : 'white', fontSize: 12, fontWeight: '600' }}>
                        {lpHideSold ? 'Show Sold' : 'Hide Sold'}
                      </Text>
                    </TouchableOpacity>
                    {(lpSearch || lpRoleFilter || lpTeamFilter || lpMaxPrice) && (
                      <TouchableOpacity
                        onPress={() => { setLpSearch(''); setLpRoleFilter(null); setLpTeamFilter(null); setLpMaxPrice('') }}
                        style={{ paddingHorizontal: 10, paddingVertical: 6 }}
                      >
                        <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Clear</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              }
              ListEmptyComponent={
                <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6' }}>
                  <Text style={{ color: '#9ca3af', fontSize: 15 }}>
                    {allPlayers.length === 0 ? 'Loading players…' : 'No players found'}
                  </Text>
                </View>
              }
              renderItem={({ item, index }) => {
                const statusColor = item.status === 'pending' ? 'gray' :
                  item.status === 'live' ? 'red' : item.status === 'unsold' ? 'yellow' : 'green'
                return (
                  <TouchableOpacity
                    onPress={() => setLpSelectedPlayer(item)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingVertical: 9, paddingHorizontal: 4,
                      borderTopWidth: index === 0 ? 0 : 1, borderTopColor: '#f3f4f6',
                      gap: 8,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#111827', fontWeight: '600', fontSize: 13 }}>{item.name}</Text>
                      <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', marginTop: 2 }}>
                        <Text style={{ color: '#9ca3af', fontSize: 11 }}>{item.ipl_team}</Text>
                        <Badge label={roleLabels[item.role] ?? item.role} color={roleBadgeColors[item.role] ?? 'gray'} />
                        {item.nationality !== 'Indian' && <Badge label="OS" color="yellow" />}
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Text style={{ color: '#6b7280', fontSize: 12 }}>{formatCurrency(playerBasePrice(item, currency), currency)}</Text>
                      {item.status !== 'pending' && <Badge label={item.status.toUpperCase()} color={statusColor} />}
                      {item.status === 'sold' && item.sold_price != null && item.sold_price > 0 && (
                        <Text style={{ color: '#16a34a', fontSize: 11, fontWeight: '700' }}>{formatCurrency(item.sold_price, currency)}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )
              }}
            />
          )
        })()}

        {/* All other tabs — wrapped in ScrollView */}
        {activeLeagueTab !== 'players' && activeLeagueTab !== 'matchups' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); refetchHome() }} tintColor="#ef4444" />}
        >
          {activeLeagueTab === 'home' && (() => {
            const { currentMatch, matchup, roster, currentWeekNum, myPlayers: rawMyPlayers = [], oppPlayers: rawOppPlayers = [], myWeekPoints = 0, oppWeekPoints = 0 } = homeData ?? {}
            const myPlayers = sortByRole(rawMyPlayers)
            const oppPlayers = sortByRole(rawOppPlayers)
            const currency = league.currency

            // Determine opponent in matchup
            const isHome = matchup?.home_user === user?.id
            const myName = matchup
              ? (isHome
                  ? (matchup.home_full_name || matchup.home_username)
                  : (matchup.away_full_name || matchup.away_username))
              : null
            const oppName = matchup
              ? (isHome
                  ? (matchup.away_full_name || matchup.away_username)
                  : (matchup.home_full_name || matchup.home_username))
              : null
            const myPoints = myWeekPoints || 0
            const oppPoints = oppWeekPoints || 0

            const matchStatus = currentMatch?.status ?? (currentMatch?.is_completed ? 'completed' : 'pending')
            const statusBg = matchStatus === 'live' ? '#fef9c3' : matchStatus === 'completed' ? '#f0fdf4' : matchStatus === 'upcoming' ? '#dbeafe' : '#f3f4f6'
            const statusColor = matchStatus === 'live' ? '#b45309' : matchStatus === 'completed' ? '#16a34a' : matchStatus === 'upcoming' ? '#1d4ed8' : '#6b7280'
            const statusLabel = matchStatus === 'live' ? 'LIVE' : matchStatus === 'completed' ? 'FINAL' : matchStatus === 'upcoming' ? 'NEXT UP' : 'UPCOMING'
            const isLiveOrDone = matchStatus === 'live' || matchStatus === 'completed'

            const matchDateStr = currentMatch?.start_time_utc
              ? new Date(currentMatch.start_time_utc).toLocaleString('en-US', {
                  month: 'short', day: 'numeric',
                  hour: 'numeric', minute: '2-digit',
                  timeZone: 'Asia/Kolkata',
                }) + ' IST'
              : currentMatch?.match_date ?? null

            const hasPlayers = myPlayers.length > 0 || oppPlayers.length > 0

            const gameStatLine = (p: { runsScored: number; ballsFaced: number; fours: number; sixes: number; isOut: boolean; ballsBowled: number; runsConceded: number; wicketsTaken: number; maidens: number; catches: number; stumpings: number; runOutsDirect: number; runOutsIndirect: number }) => {
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

            return (
              <View style={{ gap: 16 }}>
                {/* ── Combined Matchup + Current Match card ── */}
                <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}>
                  <View style={{ backgroundColor: '#1f2937', paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>
                      {currentWeekNum ? `Week ${currentWeekNum}` : 'This Week'}
                    </Text>
                  </View>

                  {/* Matchup section */}
                  {matchup ? (
                    <View style={{ padding: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                          <Avatar uri={user?.avatar_url ?? null} name={user?.display_name ?? user?.username} size={44} />
                          <Text style={{ color: '#111827', fontWeight: '700', fontSize: 13, textAlign: 'center' }} numberOfLines={1}>
                            {user?.display_name ?? user?.username}
                          </Text>
                          <Text style={{ color: '#dc2626', fontWeight: '800', fontSize: 28 }}>{Number(myPoints || 0).toFixed(1)}</Text>
                          <Text style={{ color: '#9ca3af', fontSize: 11 }}>pts</Text>
                        </View>

                        <View style={{ alignItems: 'center', paddingHorizontal: 16 }}>
                          <Text style={{ color: '#d1d5db', fontWeight: '700', fontSize: 16 }}>VS</Text>
                          {matchup.is_final && (
                            <View style={{ marginTop: 6, backgroundColor: matchup.winner_id === user?.id ? '#d1fae5' : matchup.winner_id ? '#fee2e2' : '#f3f4f6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: matchup.winner_id === user?.id ? '#16a34a' : matchup.winner_id ? '#dc2626' : '#6b7280' }}>
                                {matchup.winner_id === user?.id ? 'WIN' : matchup.winner_id ? 'LOSS' : 'TIE'}
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                          <Avatar uri={null} name={oppName ?? ''} size={44} />
                          <Text style={{ color: '#111827', fontWeight: '700', fontSize: 13, textAlign: 'center' }} numberOfLines={1}>
                            {oppName}
                          </Text>
                          <Text style={{ color: '#374151', fontWeight: '800', fontSize: 28 }}>{Number(oppPoints || 0).toFixed(1)}</Text>
                          <Text style={{ color: '#9ca3af', fontSize: 11 }}>pts</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <Text style={{ color: '#9ca3af', fontSize: 14 }}>No matchup scheduled yet</Text>
                    </View>
                  )}

                  {/* Current match section — inside same card */}
                  {currentMatch && (
                    <View style={{ borderTopWidth: 1, borderTopColor: '#f3f4f6', padding: 14, gap: 10 }}>
                      {/* Status + match number */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ backgroundColor: statusBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                          <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700' }}>{statusLabel}</Text>
                        </View>
                        {currentMatch.match_number != null && (
                          <Text style={{ color: '#d1d5db', fontSize: 11 }}>Match {currentMatch.match_number}</Text>
                        )}
                      </View>

                      {/* Teams */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ flex: 1, color: '#111827', fontWeight: '700', fontSize: 13, textAlign: 'center' }} numberOfLines={2}>
                          {currentMatch.home_team}
                        </Text>
                        <Text style={{ color: '#d1d5db', fontWeight: '700', fontSize: 12 }}>vs</Text>
                        <Text style={{ flex: 1, color: '#111827', fontWeight: '700', fontSize: 13, textAlign: 'center' }} numberOfLines={2}>
                          {currentMatch.away_team}
                        </Text>
                      </View>

                      {/* Date + venue */}
                      <View style={{ gap: 2 }}>
                        {matchDateStr && (
                          <Text style={{ color: '#9ca3af', fontSize: 11, textAlign: 'center' }}>{matchDateStr}</Text>
                        )}
                        {currentMatch.venue != null && (
                          <Text style={{ color: '#d1d5db', fontSize: 10, textAlign: 'center' }} numberOfLines={1}>
                            {currentMatch.venue}
                          </Text>
                        )}
                      </View>

                      {/* Players in this game */}
                      <View style={{ borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 10, gap: 10 }}>
                        {!hasPlayers ? (
                          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }}>
                            <Text style={{ color: '#d1d5db', fontSize: 12 }}>No lineup players in this match</Text>
                          </View>
                        ) : (
                          <>
                            {myPlayers.length > 0 && (
                              <View style={{ gap: 6 }}>
                                <Text style={{ color: '#dc2626', fontSize: 10, fontWeight: '700' }}>{myName ?? 'You'}</Text>
                                {myPlayers.map((p: any) => (
                                  <View key={p.playerId} style={{ gap: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                      <Text style={{ color: '#6b7280', fontSize: 10, fontWeight: '700', width: 28 }}>
                                        {roleLabels[p.playerRole] ?? p.playerRole}
                                      </Text>
                                      <Text style={{ flex: 1, color: '#111827', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                                        {p.playerName}
                                      </Text>
                                      <Text style={{ color: p.points > 0 ? '#16a34a' : '#9ca3af', fontSize: 12, fontWeight: '700' }}>
                                        {p.points > 0 ? `+${p.points.toFixed(1)}` : '\u2014'}
                                      </Text>
                                    </View>
                                    {isLiveOrDone && gameStatLine(p) !== '' && (
                                      <Text style={{ color: '#9ca3af', fontSize: 11, paddingLeft: 28 }}>{gameStatLine(p)}</Text>
                                    )}
                                  </View>
                                ))}
                              </View>
                            )}
                            {myPlayers.length > 0 && oppPlayers.length > 0 && (
                              <View style={{ height: 1, backgroundColor: '#f3f4f6' }} />
                            )}
                            {oppPlayers.length > 0 && (
                              <View style={{ gap: 6 }}>
                                <Text style={{ color: '#6b7280', fontSize: 10, fontWeight: '700' }}>{oppName ?? 'Opponent'}</Text>
                                {oppPlayers.map((p: any) => (
                                  <View key={p.playerId} style={{ gap: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                      <Text style={{ color: '#6b7280', fontSize: 10, fontWeight: '700', width: 28 }}>
                                        {roleLabels[p.playerRole] ?? p.playerRole}
                                      </Text>
                                      <Text style={{ flex: 1, color: '#111827', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                                        {p.playerName}
                                      </Text>
                                      <Text style={{ color: p.points > 0 ? '#16a34a' : '#9ca3af', fontSize: 12, fontWeight: '700' }}>
                                        {p.points > 0 ? `+${p.points.toFixed(1)}` : '\u2014'}
                                      </Text>
                                    </View>
                                    {isLiveOrDone && gameStatLine(p) !== '' && (
                                      <Text style={{ color: '#9ca3af', fontSize: 11, paddingLeft: 28 }}>{gameStatLine(p)}</Text>
                                    )}
                                  </View>
                                ))}
                              </View>
                            )}
                          </>
                        )}
                      </View>
                    </View>
                  )}
                </View>

                {/* ── My Squad ── */}
                <View style={{ gap: 10 }}>
                  {roster && roster.length > 0
                    ? <SquadGrid roster={roster} currency={currency} />
                    : <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6' }}>
                        <Text style={{ color: '#9ca3af', fontSize: 14 }}>No players acquired yet</Text>
                      </View>
                  }
                </View>
              </View>
            )
          })()}


          {activeLeagueTab === 'teams' && (() => {
            const rostersByUser = (allRosters ?? []).reduce<Record<string, typeof allRosters>>((acc, e) => {
              if (!acc[e!.user_id]) acc[e!.user_id] = []
              acc[e!.user_id]!.push(e!)
              return acc
            }, {})
            const pointsMap = (leaderboard ?? []).reduce<Record<string, number>>((acc, e) => {
              acc[e.user_id] = e.total_points; return acc
            }, {})
            const effectiveUserId = selectedTeamUserId ?? user?.id ?? (members[0]?.user_id ?? null)
            const selectedMember = members.find(m => m.user_id === effectiveUserId)
            const selectedRoster = effectiveUserId ? (rostersByUser[effectiveUserId] ?? []) : []
            const currency = league.currency

            return (
              <View style={{ gap: 12 }}>
                {/* Sub-tab toggle */}
                <View style={{ flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 12, padding: 4 }}>
                  {(['squads', 'points'] as const).map(sub => (
                    <TouchableOpacity
                      key={sub}
                      onPress={() => setTeamsSubTab(sub)}
                      style={{
                        flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
                        backgroundColor: teamsSubTab === sub ? '#ffffff' : 'transparent',
                      }}
                    >
                      <Text style={{ fontWeight: '600', fontSize: 14, color: teamsSubTab === sub ? '#111827' : '#9ca3af' }}>
                        {sub === 'squads' ? 'Squads' : 'Points Table'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

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
                                backgroundColor: isSelected ? '#dc2626' : 'white',
                                borderWidth: 1, borderColor: isSelected ? '#dc2626' : '#e5e7eb',
                              }}
                            >
                              <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? 'white' : '#374151' }}>
                                {m.display_name ?? m.username}{isMe ? ' (You)' : ''}
                              </Text>
                            </TouchableOpacity>
                          )
                        })}
                      </View>
                    </ScrollView>

                    {/* Team card */}
                    {selectedMember && (
                      <View style={{
                        backgroundColor: 'white', borderRadius: 16, padding: 16,
                        borderWidth: 1, borderColor: '#f3f4f6', gap: 12,
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <Avatar
                            uri={selectedMember.avatar_url}
                            name={selectedMember.display_name ?? selectedMember.username}
                            size={44}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: '#111827', fontWeight: '700', fontSize: 18 }}>
                              {selectedMember.display_name ?? selectedMember.username}
                              {selectedMember.user_id === user?.id ? ' (You)' : ''}
                            </Text>
                            <Text style={{ color: '#9ca3af', fontSize: 13 }}>
                              {selectedRoster.length} / {league.roster_size} players
                            </Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 0 }}>
                          {[
                            { label: 'Purse Left', value: formatCurrency(selectedMember.remaining_budget, currency) },
                            { label: 'Total Pts', value: pointsMap[selectedMember.user_id] != null ? String(pointsMap[selectedMember.user_id]) : '—' },
                            { label: 'Record', value: '—' },
                          ].map(({ label, value }, i, arr) => (
                            <View
                              key={label}
                              style={{
                                flex: 1, alignItems: 'center',
                                borderRightWidth: i < arr.length - 1 ? 1 : 0,
                                borderRightColor: '#f3f4f6',
                              }}
                            >
                              <Text style={{ color: '#111827', fontWeight: '700', fontSize: 18 }}>{value}</Text>
                              <Text style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>{label}</Text>
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
                  <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}>
                    {/* Header row */}
                    <View style={{ flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#f9fafb', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                      <Text style={{ width: 28, color: '#9ca3af', fontSize: 11, fontWeight: '700' }}>#</Text>
                      <Text style={{ flex: 1, color: '#9ca3af', fontSize: 11, fontWeight: '700' }}>TEAM</Text>
                      <Text style={{ width: 52, color: '#9ca3af', fontSize: 11, fontWeight: '700', textAlign: 'right' }}>PLAYERS</Text>
                      <Text style={{ width: 72, color: '#9ca3af', fontSize: 11, fontWeight: '700', textAlign: 'right' }}>BUDGET</Text>
                      <Text style={{ width: 48, color: '#9ca3af', fontSize: 11, fontWeight: '700', textAlign: 'right' }}>PTS</Text>
                    </View>

                    {/* Sorted rows */}
                    {members
                      .slice()
                      .sort((a, b) => (pointsMap[b.user_id] ?? 0) - (pointsMap[a.user_id] ?? 0))
                      .map((m, i) => {
                        const isMe = m.user_id === user?.id
                        const pts = pointsMap[m.user_id]
                        return (
                          <View
                            key={m.user_id}
                            style={{
                              flexDirection: 'row', alignItems: 'center',
                              paddingVertical: 12, paddingHorizontal: 16,
                              borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#f9fafb',
                              backgroundColor: isMe ? '#fef2f2' : 'white',
                            }}
                          >
                            <Text style={{ width: 28, color: i < 3 ? '#dc2626' : '#9ca3af', fontSize: 13, fontWeight: '700' }}>
                              {i + 1}
                            </Text>
                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Avatar uri={m.avatar_url} name={m.display_name ?? m.username} size={28} />
                              <Text style={{ color: '#111827', fontSize: 13, fontWeight: isMe ? '700' : '500' }} numberOfLines={1}>
                                {m.display_name ?? m.username}{isMe ? ' ★' : ''}
                              </Text>
                            </View>
                            <Text style={{ width: 52, color: '#6b7280', fontSize: 13, textAlign: 'right' }}>
                              {m.roster_count}
                            </Text>
                            <Text style={{ width: 72, color: '#6b7280', fontSize: 12, textAlign: 'right' }} numberOfLines={1}>
                              {formatCurrency(m.remaining_budget, currency)}
                            </Text>
                            <Text style={{ width: 48, color: pts != null ? '#111827' : '#d1d5db', fontSize: 14, fontWeight: '700', textAlign: 'right' }}>
                              {pts != null ? pts : '—'}
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

            // Group matchups by week_num
            const byWeek = matchups.reduce<Record<number, typeof matchups>>((acc, m) => {
              if (!acc[m.week_num]) acc[m.week_num] = []
              acc[m.week_num].push(m)
              return acc
            }, {})

            const weekNums = Object.keys(byWeek).map(Number).sort((a, b) => a - b)

            if (weekNums.length === 0) {
              return (
                <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6' }}>
                  <Text style={{ color: '#9ca3af', fontSize: 15 }}>No schedule generated yet</Text>
                </View>
              )
            }

            return (
              <View style={{ gap: 16 }}>
                {weekNums.map(weekNum => {
                  const weekMatchups = byWeek[weekNum]!
                  const weekInfo = weeks.find(w => w.week_num === weekNum)
                  return (
                    <View key={weekNum} style={{ gap: 8 }}>
                      {/* Week header */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: '#111827', fontWeight: '700', fontSize: 15 }}>
                          Week {weekNum}
                        </Text>
                        {weekInfo?.label ? (
                          <Text style={{ color: '#9ca3af', fontSize: 13 }}>{weekInfo.label}</Text>
                        ) : null}
                        {weekInfo?.week_type && weekInfo.week_type !== 'regular' && (
                          <View style={{
                            backgroundColor: weekInfo.week_type === 'finals' ? '#fef3c7' : '#fee2e2',
                            borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
                          }}>
                            <Text style={{
                              fontSize: 10, fontWeight: '700',
                              color: weekInfo.week_type === 'finals' ? '#b45309' : '#dc2626',
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
                          ? (m.home_full_name || m.home_username)
                          : (m.away_full_name || m.away_username)
                        const oppName = isHome
                          ? (m.away_full_name || m.away_username)
                          : (m.home_full_name || m.home_username)
                        const myPts = isHome ? m.home_points : m.away_points
                        const oppPts = isHome ? m.away_points : m.home_points
                        const hasResult = m.is_final

                        const resultLabel = hasResult
                          ? (m.winner_id === user?.id ? 'WIN' : m.winner_id ? 'LOSS' : 'TIE')
                          : null
                        const resultBg = resultLabel === 'WIN' ? '#d1fae5' : resultLabel === 'LOSS' ? '#fee2e2' : '#f3f4f6'
                        const resultColor = resultLabel === 'WIN' ? '#16a34a' : resultLabel === 'LOSS' ? '#dc2626' : '#6b7280'

                        return (
                          <View
                            key={m.id}
                            style={{
                              backgroundColor: 'white',
                              borderRadius: 14,
                              borderWidth: 1,
                              borderColor: isMyMatchup ? '#fca5a5' : '#f3f4f6',
                              overflow: 'hidden',
                            }}
                          >
                            {isMyMatchup && (
                              <View style={{ backgroundColor: '#dc2626', paddingHorizontal: 14, paddingVertical: 5 }}>
                                <Text style={{ color: 'white', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>YOUR MATCHUP</Text>
                              </View>
                            )}

                            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 }}>
                              {/* Left team */}
                              <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                                <Avatar
                                  uri={null}
                                  name={isMyMatchup ? (user?.display_name ?? user?.username ?? myName) : (m.home_full_name || m.home_username)}
                                  size={36}
                                />
                                <Text style={{ color: '#111827', fontWeight: isMyMatchup ? '700' : '500', fontSize: 12, textAlign: 'center' }} numberOfLines={1}>
                                  {isMyMatchup ? (user?.display_name ?? user?.username) : (m.home_full_name || m.home_username)}
                                  {isMyMatchup ? ' ★' : ''}
                                </Text>
                                <Text style={{ color: isMyMatchup ? '#dc2626' : '#374151', fontWeight: '800', fontSize: 22 }}>
                                  {isMyMatchup ? myPts : m.home_points}
                                </Text>
                              </View>

                              {/* Middle */}
                              <View style={{ alignItems: 'center', gap: 4 }}>
                                <Text style={{ color: '#d1d5db', fontWeight: '700', fontSize: 13 }}>VS</Text>
                                {resultLabel && isMyMatchup && (
                                  <View style={{ backgroundColor: resultBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                                    <Text style={{ fontSize: 10, fontWeight: '700', color: resultColor }}>{resultLabel}</Text>
                                  </View>
                                )}
                                {hasResult && !isMyMatchup && (
                                  <View style={{ backgroundColor: '#f3f4f6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#6b7280' }}>FINAL</Text>
                                  </View>
                                )}
                              </View>

                              {/* Right team */}
                              <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                                <Avatar
                                  uri={null}
                                  name={isMyMatchup ? oppName : (m.away_full_name || m.away_username)}
                                  size={36}
                                />
                                <Text style={{ color: '#111827', fontWeight: '500', fontSize: 12, textAlign: 'center' }} numberOfLines={1}>
                                  {isMyMatchup ? oppName : (m.away_full_name || m.away_username)}
                                </Text>
                                <Text style={{ color: '#374151', fontWeight: '800', fontSize: 22 }}>
                                  {isMyMatchup ? oppPts : m.away_points}
                                </Text>
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
              <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f3f4f6', gap: 12 }}>
                <Text style={{ fontWeight: '700', fontSize: 16, color: '#111827' }}>League Info</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                  <View>
                    <Text style={{ color: '#9ca3af', fontSize: 12 }}>Invite Code</Text>
                    <Text style={{ color: '#dc2626', fontWeight: '700', fontFamily: 'monospace', fontSize: 16, letterSpacing: 2 }}>
                      {league.invite_code}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ color: '#9ca3af', fontSize: 12 }}>Budget</Text>
                    <Text style={{ color: '#111827', fontWeight: '600' }}>{formatCurrency(league.starting_budget, league.currency)}</Text>
                  </View>
                  <View>
                    <Text style={{ color: '#9ca3af', fontSize: 12 }}>Teams</Text>
                    <Text style={{ color: '#111827', fontWeight: '600' }}>{members.length}/{league.max_teams}</Text>
                  </View>
                  <View>
                    <Text style={{ color: '#9ca3af', fontSize: 12 }}>Roster Size</Text>
                    <Text style={{ color: '#111827', fontWeight: '600' }}>{league.roster_size}</Text>
                  </View>
                </View>
              </View>

              {!isAdmin && (
                <Button label="Leave League" variant="danger" onPress={handleLeave} />
              )}
            </View>
          )}

          {activeLeagueTab === 'admin' && isAdmin && (
            <View style={{ gap: 12 }}>
              {scheduleMatchups && scheduleMatchups.some(m => !m.is_final) && (
                <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f3f4f6', gap: 8 }}>
                  <Text style={{ color: '#111827', fontWeight: '700', fontSize: 15 }}>Schedule</Text>
                  <Text style={{ color: '#6b7280', fontSize: 13 }}>
                    Change who plays who for any week that hasn't been finalized.
                  </Text>
                  <TouchableOpacity
                    onPress={() => setScheduleAdjustOpen(true)}
                    style={{ backgroundColor: '#111827', borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}
                  >
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Adjust Schedule</Text>
                  </TouchableOpacity>
                </View>
              )}

              {(isActive || isComplete) && (
                <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f3f4f6', gap: 8 }}>
                  <Text style={{ color: '#111827', fontWeight: '700', fontSize: 15 }}>Member Lineups</Text>
                  <Text style={{ color: '#6b7280', fontSize: 13 }}>Set a lineup for any league member.</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setAdminLineupUserId(null)
                      setAdminLineupWeek(null)
                      setAdminLineupDraft([])
                      setAdminLineupOpen(true)
                    }}
                    style={{ backgroundColor: '#111827', borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}
                  >
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Set Lineup</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#fee2e2', gap: 8 }}>
                <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 15 }}>Danger Zone</Text>
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
          <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white' }}>
              <Text style={{ fontWeight: '700', fontSize: 17, color: '#111827' }}>Adjust Schedule</Text>
              <TouchableOpacity onPress={() => { setScheduleAdjustOpen(false); setScheduleEditWeek(null) }}>
                <Text style={{ color: '#dc2626', fontSize: 15, fontWeight: '600' }}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              {(() => {
                const allMatchups = scheduleMatchups ?? []
                const weekNums = Array.from(new Set(allMatchups.map(m => m.week_num))).sort((a, b) => a - b)
                const unfinishedWeeks = weekNums.filter(wn =>
                  allMatchups.filter(m => m.week_num === wn).some(m => !m.is_final)
                )
                if (unfinishedWeeks.length === 0) {
                  return (
                    <View style={{ alignItems: 'center', paddingTop: 40 }}>
                      <Text style={{ color: '#9ca3af', fontSize: 14 }}>No adjustable weeks remaining.</Text>
                    </View>
                  )
                }
                return unfinishedWeeks.map(wn => {
                  const weekMatchups = allMatchups.filter(m => m.week_num === wn)
                  const isEditing = scheduleEditWeek === wn
                  const drafts = scheduleEdits[wn] ?? {}
                  return (
                    <View key={wn} style={{ backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                        <Text style={{ color: '#111827', fontWeight: '700', fontSize: 15 }}>Week {wn}</Text>
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
                            style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f3f4f6', borderRadius: 8 }}
                          >
                            <Text style={{ color: '#374151', fontSize: 13, fontWeight: '600' }}>Edit</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                              onPress={() => setScheduleEditWeek(null)}
                              style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f3f4f6', borderRadius: 8 }}
                            >
                              <Text style={{ color: '#6b7280', fontSize: 13, fontWeight: '600' }}>Cancel</Text>
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
                              style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#dc2626', borderRadius: 8 }}
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
                          <View key={m.id} style={{ borderTopWidth: mi > 0 ? 1 : 0, borderTopColor: '#f3f4f6' }}>
                            <View style={{ backgroundColor: '#f9fafb', paddingHorizontal: 14, paddingVertical: 6 }}>
                              <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '600' }}>Matchup {mi + 1}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 }}>
                              {isEditing ? (
                                <>
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#6b7280', fontSize: 10, fontWeight: '600', marginBottom: 4 }}>HOME</Text>
                                    <View style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                                      {members.map((mb, mbi) => (
                                        <TouchableOpacity
                                          key={mb.user_id}
                                          onPress={() => setScheduleEdits(prev => ({
                                            ...prev,
                                            [wn]: { ...prev[wn], [m.id]: { id: m.id, home_user: mb.user_id, away_user: prev[wn]?.[m.id]?.away_user ?? m.away_user } },
                                          }))}
                                          style={{
                                            paddingHorizontal: 10, paddingVertical: 8,
                                            backgroundColor: homeUser === mb.user_id ? '#dc2626' : 'white',
                                            borderTopWidth: mbi > 0 ? 1 : 0, borderTopColor: '#f3f4f6',
                                          }}
                                        >
                                          <Text style={{ fontSize: 12, fontWeight: homeUser === mb.user_id ? '700' : '400', color: homeUser === mb.user_id ? 'white' : '#374151' }} numberOfLines={1}>
                                            {mb.display_name || mb.username}
                                          </Text>
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                  </View>
                                  <Text style={{ color: '#d1d5db', fontWeight: '700', fontSize: 13 }}>vs</Text>
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#6b7280', fontSize: 10, fontWeight: '600', marginBottom: 4 }}>AWAY</Text>
                                    <View style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                                      {members.map((mb, mbi) => (
                                        <TouchableOpacity
                                          key={mb.user_id}
                                          onPress={() => setScheduleEdits(prev => ({
                                            ...prev,
                                            [wn]: { ...prev[wn], [m.id]: { id: m.id, home_user: prev[wn]?.[m.id]?.home_user ?? m.home_user, away_user: mb.user_id } },
                                          }))}
                                          style={{
                                            paddingHorizontal: 10, paddingVertical: 8,
                                            backgroundColor: awayUser === mb.user_id ? '#1f2937' : 'white',
                                            borderTopWidth: mbi > 0 ? 1 : 0, borderTopColor: '#f3f4f6',
                                          }}
                                        >
                                          <Text style={{ fontSize: 12, fontWeight: awayUser === mb.user_id ? '700' : '400', color: awayUser === mb.user_id ? 'white' : '#374151' }} numberOfLines={1}>
                                            {mb.display_name || mb.username}
                                          </Text>
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                  </View>
                                </>
                              ) : (
                                <>
                                  <Text style={{ flex: 1, color: '#374151', fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{homeName}</Text>
                                  <Text style={{ color: '#d1d5db', fontWeight: '700', fontSize: 13 }}>vs</Text>
                                  <Text style={{ flex: 1, color: '#374151', fontSize: 14, fontWeight: '600', textAlign: 'right' }} numberOfLines={1}>{awayName}</Text>
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
          <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white' }}>
              <View>
                <Text style={{ fontWeight: '700', fontSize: 17, color: '#111827' }}>Set Member Lineup</Text>
                {adminLineupUserId && adminLineupWeek && (
                  <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 2 }}>{adminLineupDraft.length} selected</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setAdminLineupOpen(false)}>
                <Text style={{ color: '#dc2626', fontSize: 15, fontWeight: '600' }}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
              {/* Member picker */}
              <View style={{ gap: 8 }}>
                <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>SELECT MEMBER</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {members.map(m => {
                    const name = m.display_name || m.username
                    const selected = adminLineupUserId === m.user_id
                    return (
                      <TouchableOpacity
                        key={m.user_id}
                        onPress={() => { setAdminLineupUserId(m.user_id); setAdminLineupDraft([]) }}
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: selected ? '#111827' : 'white', borderWidth: 1, borderColor: selected ? '#111827' : '#e5e7eb' }}
                      >
                        <Text style={{ color: selected ? 'white' : '#374151', fontWeight: '600', fontSize: 13 }}>{name}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>

              {/* Week picker */}
              {adminLineupUserId && (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>SELECT WEEK</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {Array.from(new Set((scheduleMatchups ?? []).map(m => m.week_num))).sort((a, b) => a - b).map(wn => {
                        const selected = adminLineupWeek === wn
                        return (
                          <TouchableOpacity
                            key={wn}
                            onPress={() => setAdminLineupWeek(wn)}
                            style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: selected ? '#111827' : 'white', borderWidth: 1, borderColor: selected ? '#111827' : '#e5e7eb' }}
                          >
                            <Text style={{ color: selected ? 'white' : '#374151', fontWeight: '600', fontSize: 13 }}>Week {wn}</Text>
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
                  const adRoleColors2: Record<string, string> = { batsman: '#2563eb', bowler: '#dc2626', all_rounder: '#16a34a', wicket_keeper: '#d97706' }
                  const adRoleLabels2: Record<string, string> = { batsman: 'BAT', bowler: 'BOW', all_rounder: 'AR', wicket_keeper: 'WK' }
                  return (
                    <View style={{ gap: 10 }}>
                      <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
                        TAP TO ADD / REMOVE  •  {adminLineupDraft.length}/11
                      </Text>
                      <View style={{ backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}>
                        {memberRoster.map((player, idx) => {
                          const inLineup = adminLineupDraft.some(e => e.playerId === player.player_id)
                          const entry = adminLineupDraft.find(e => e.playerId === player.player_id)
                          const roleColor = adRoleColors2[player.player_role] ?? '#6b7280'
                          const roleLabel = adRoleLabels2[player.player_role] ?? player.player_role
                          return (
                            <TouchableOpacity
                              key={player.player_id}
                              onPress={() => handleAdminTogglePlayer(player)}
                              activeOpacity={0.7}
                              style={{
                                flexDirection: 'row', alignItems: 'center',
                                paddingHorizontal: 14, paddingVertical: 13,
                                borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: '#f9fafb',
                                opacity: (!inLineup && adminLineupDraft.length >= 11) ? 0.35 : 1,
                              }}
                            >
                              <View style={{
                                width: 24, height: 24, borderRadius: 12, borderWidth: 2,
                                borderColor: inLineup ? '#16a34a' : '#d1d5db',
                                backgroundColor: inLineup ? '#16a34a' : 'transparent',
                                alignItems: 'center', justifyContent: 'center', marginRight: 12,
                              }}>
                                {inLineup && <Text style={{ color: 'white', fontSize: 13, fontWeight: '800' }}>✓</Text>}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: '#111827', fontWeight: '600', fontSize: 14 }}>{player.player_name}</Text>
                                <Text style={{ color: '#9ca3af', fontSize: 12 }}>{player.player_ipl_team}</Text>
                              </View>
                              {inLineup && entry?.slotRole === 'flex' && (
                                <View style={{ backgroundColor: '#6b728018', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3, marginRight: 8 }}>
                                  <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700' }}>FLEX</Text>
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
                            <Text style={{ color: '#9ca3af', fontSize: 14 }}>No players on this member's roster</Text>
                          </View>
                        )}
                      </View>

                      <TouchableOpacity
                        onPress={handleAdminSaveLineup}
                        disabled={adminSetLineup.isPending || adminLineupDraft.length === 0}
                        style={{ backgroundColor: adminLineupDraft.length > 0 ? '#dc2626' : '#e5e7eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                      >
                        {adminSetLineup.isPending ? (
                          <ActivityIndicator color="white" />
                        ) : (
                          <Text style={{ color: adminLineupDraft.length > 0 ? 'white' : '#9ca3af', fontWeight: '700', fontSize: 15 }}>
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
            sold_price: lpSelectedPlayer.sold_price,
            status: lpSelectedPlayer.status,
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
          <View style={{ flex: 1, backgroundColor: 'white' }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontWeight: '700', fontSize: 17, color: '#111827' }}>Add Free Agent</Text>
                <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 2 }}>
                  {rosterFull ? 'Roster full — you must also drop a player' : `${myCurrentRoster.length} / ${league.roster_size} roster spots used`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Text style={{ color: '#dc2626', fontSize: 15, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
              <TextInput
                value={faSearch}
                onChangeText={setFaSearch}
                placeholder="Search by name or team…"
                placeholderTextColor="#9ca3af"
                style={{ backgroundColor: '#f9fafb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', borderWidth: 1, borderColor: '#f3f4f6' }}
                autoCapitalize="none"
              />
            </View>
            {faLoading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="#dc2626" />
              </View>
            ) : (
              <FlatList
                data={filteredFreeAgents}
                keyExtractor={p => p.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handleSelectFreeAgent(item)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f9fafb' }}
                  >
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: adRoleColors[item.role] ?? '#6b7280', marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#111827', fontWeight: '600', fontSize: 15 }}>{item.name}</Text>
                      <Text style={{ color: '#9ca3af', fontSize: 13 }}>{item.ipl_team}</Text>
                    </View>
                    <View style={{ backgroundColor: '#f3f4f6', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginRight: 10 }}>
                      <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700' }}>{adRoleLabels[item.role] ?? item.role}</Text>
                    </View>
                    <Text style={{ color: '#374151', fontSize: 13, fontWeight: '600' }}>
                      {formatCurrency(item.base_price, league.currency)}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={{ padding: 48, alignItems: 'center' }}>
                    <Text style={{ color: '#9ca3af', fontSize: 15 }}>
                      {faSearch ? 'No players match your search' : 'No free agents available'}
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </Modal>

        {/* Drop picker (roster full or role limit reached) */}
        <Modal visible={dropPickerVisible} animationType="slide" presentationStyle="pageSheet">
          <View style={{ flex: 1, backgroundColor: 'white' }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontWeight: '700', fontSize: 17, color: '#111827' }}>Drop a Player</Text>
                <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 2 }}>
                  {dropRoleFilter
                    ? `${adRoleFullLabels[dropRoleFilter] ?? dropRoleFilter} limit reached — drop a ${adRoleFullLabels[dropRoleFilter] ?? dropRoleFilter} to add ${selectedFreeAgent?.name}`
                    : `Roster full — drop anyone to add ${selectedFreeAgent?.name}`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setDropPickerVisible(false); setSelectedFreeAgent(null); setDropRoleFilter(null) }}>
                <Text style={{ color: '#dc2626', fontSize: 15, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={dropRoleFilter ? myCurrentRoster.filter(r => r.player_role === dropRoleFilter) : myCurrentRoster}
              keyExtractor={p => p.player_id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => confirmAddPlayer(selectedFreeAgent!.id, item.player_id)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f9fafb' }}
                >
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: adRoleColors[item.player_role] ?? '#6b7280', marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#111827', fontWeight: '600', fontSize: 15 }}>{item.player_name}</Text>
                    <Text style={{ color: '#9ca3af', fontSize: 13 }}>{item.player_ipl_team}</Text>
                  </View>
                  <View style={{ backgroundColor: '#f3f4f6', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginRight: 10 }}>
                    <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700' }}>{adRoleLabels[item.player_role] ?? item.player_role}</Text>
                  </View>
                  <Text style={{ color: '#dc2626', fontSize: 13, fontWeight: '700' }}>Drop</Text>
                </TouchableOpacity>
              )}
            />
            {addPlayerMutation.isPending && (
              <View style={{ padding: 20, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
                <ActivityIndicator color="#dc2626" />
                <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 8 }}>Processing…</Text>
              </View>
            )}
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
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#ef4444" />}
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
                <Text className="text-gray-400 text-xs">Budget</Text>
                <Text className="text-gray-900 font-medium">{formatCurrency(league.starting_budget, league.currency)}</Text>
              </View>
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
              startingBudget={league.starting_budget}
              currency={league.currency}
            />
          </View>

          {/* Draft Wishlist card (draft_pending only) */}
          {isDraftPending && (
            <View
              onLayout={(e) => setWishlistY(e.nativeEvent.layout.y)}
              style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, overflow: 'hidden' }}
            >
              <View style={{ padding: 16, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, marginRight: 12, gap: 2 }}>
                    <Text style={{ color: '#111827', fontWeight: '700', fontSize: 17 }}>Draft Wishlist</Text>
                    <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                      Tap players you want — they'll be called up first in the draft.
                    </Text>
                  </View>
                  {myInterests.size > 0 && (
                    <View style={{ backgroundColor: '#16a34a', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, flexShrink: 0 }}>
                      <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>{myInterests.size} added</Text>
                    </View>
                  )}
                </View>
                <TextInput
                  value={playerSearch}
                  onChangeText={setPlayerSearch}
                  onFocus={() => scrollRef.current?.scrollTo({ y: wishlistY, animated: true })}
                  placeholder="Search by name or team..."
                  placeholderTextColor="#9ca3af"
                  style={{ backgroundColor: '#f3f4f6', color: '#111827', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, borderWidth: 1, borderColor: '#e5e7eb' }}
                />

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row' }}>
                    {wishlistRoleChips.map(({ label, value }) => (
                      <TouchableOpacity
                        key={label}
                        onPress={() => setPlayerRoleFilter(value)}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: playerRoleFilter === value ? '#dc2626' : '#f3f4f6', borderWidth: 1, borderColor: playerRoleFilter === value ? '#dc2626' : '#e5e7eb', marginRight: 6 }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: playerRoleFilter === value ? '#ffffff' : '#6b7280' }}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity
                      onPress={() => setPlayerTeamFilter(null)}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: playerTeamFilter === null ? '#dc2626' : '#f3f4f6', borderWidth: 1, borderColor: playerTeamFilter === null ? '#dc2626' : '#e5e7eb', marginRight: 6 }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: playerTeamFilter === null ? '#ffffff' : '#6b7280' }}>All Teams</Text>
                    </TouchableOpacity>
                    {[...new Set((playersData ?? []).map(p => p.ipl_team))].sort().map(team => (
                      <TouchableOpacity
                        key={team}
                        onPress={() => setPlayerTeamFilter(team)}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: playerTeamFilter === team ? '#dc2626' : '#f3f4f6', borderWidth: 1, borderColor: playerTeamFilter === team ? '#dc2626' : '#e5e7eb', marginRight: 6 }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: playerTeamFilter === team ? '#ffffff' : '#6b7280' }}>{team}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {!playersData ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Text style={{ color: '#9ca3af' }}>Loading players...</Text>
                </View>
              ) : filteredPlayers.length === 0 ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Text style={{ color: '#9ca3af' }}>No players found</Text>
                </View>
              ) : (
                <>
                  {interested.length > 0 && (
                    <>
                      <TouchableOpacity
                        onPress={() => setInterestedCollapsed(c => !c)}
                        activeOpacity={0.7}
                        style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6', borderBottomWidth: interestedCollapsed ? 0 : 1, borderBottomColor: '#bbf7d0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <Text style={{ color: '#16a34a', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
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
                        style={{ backgroundColor: '#f9fafb', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6', borderBottomWidth: allPlayersCollapsed ? 0 : 1, borderBottomColor: '#f3f4f6', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
                          ALL PLAYERS ({others.length})
                        </Text>
                        <Text style={{ color: '#9ca3af', fontSize: 12 }}>{allPlayersCollapsed ? '▼' : '▲'}</Text>
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
