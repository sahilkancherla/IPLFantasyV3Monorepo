import { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  Alert,
  TouchableOpacity,
  Animated,
  FlatList,
  TextInput as RNTextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { PlayerCard } from '../../../components/auction/PlayerCard'
import { CountdownTimer } from '../../../components/auction/CountdownTimer'
import { BidHistory } from '../../../components/auction/BidHistory'
import { BidPanel } from '../../../components/auction/BidPanel'
import { BudgetBar } from '../../../components/auction/BudgetBar'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Avatar } from '../../../components/ui/Avatar'
import { useAuction } from '../../../hooks/useAuction'
import { useAuthStore } from '../../../stores/authStore'
import { useLeague } from '../../../hooks/useLeague'
import { useAvailablePlayers } from '../../../hooks/useAuctionInterests'
import { api } from '../../../lib/api'
import type { AuctionHistoryEntry } from '../../../stores/auctionStore'
import { formatCurrency, playerBasePrice } from '../../../lib/currency'

// ─── Inline dropdown selector ────────────────────────────────────────────────

interface SelectOption {
  id: string
  label: string
  sublabel?: string
}

function InlineSelector({
  label,
  value,
  options,
  onSelect,
  placeholder,
}: {
  label: string
  value: string | null
  options: SelectOption[]
  onSelect: (id: string) => void
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.id === value)
  return (
    <View>
      <Text style={{ color: '#6b7280', fontSize: 12, marginBottom: 4, fontWeight: '500' }}>{label}</Text>
      <TouchableOpacity
        onPress={() => setOpen(v => !v)}
        style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
          paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#f9fafb',
        }}
      >
        <View style={{ flex: 1 }}>
          {selected ? (
            <>
              <Text style={{ color: '#111827', fontSize: 14 }}>{selected.label}</Text>
              {selected.sublabel ? (
                <Text style={{ color: '#9ca3af', fontSize: 11, marginTop: 1 }}>{selected.sublabel}</Text>
              ) : null}
            </>
          ) : (
            <Text style={{ color: '#9ca3af', fontSize: 14 }}>{placeholder}</Text>
          )}
        </View>
        <Text style={{ color: '#6b7280', fontSize: 11, marginLeft: 8 }}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={{
          borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, marginTop: 2,
          backgroundColor: '#ffffff', maxHeight: 200, overflow: 'hidden',
        }}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {options.length === 0 ? (
              <View style={{ padding: 12 }}>
                <Text style={{ color: '#9ca3af', fontSize: 14 }}>No options available</Text>
              </View>
            ) : (
              options.map((opt, i) => (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => { onSelect(opt.id); setOpen(false) }}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 10,
                    borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#f3f4f6',
                  }}
                >
                  <Text style={{ color: '#111827', fontSize: 14 }}>{opt.label}</Text>
                  {opt.sublabel ? (
                    <Text style={{ color: '#9ca3af', fontSize: 11, marginTop: 1 }}>{opt.sublabel}</Text>
                  ) : null}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </View>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Tab = 'bidding' | 'teams' | 'players' | 'admin'

const roleLabels: Record<string, string> = {
  batsman: 'BAT', bowler: 'BOW', all_rounder: 'AR', wicket_keeper: 'WK',
}
const roleFullLabels: Record<string, string> = {
  batsman: 'Batsmen', bowler: 'Bowlers', all_rounder: 'All-Rounders', wicket_keeper: 'Wicket-Keepers',
}
const roleBadgeColors: Record<string, 'blue' | 'red' | 'green' | 'yellow'> = {
  batsman: 'blue', bowler: 'red', all_rounder: 'green', wicket_keeper: 'yellow',
}
const ROLE_ORDER = ['batsman', 'wicket_keeper', 'all_rounder', 'bowler'] as const


function getRosterForMember(auctionHistory: AuctionHistoryEntry[], userId: string) {
  return auctionHistory.filter(h => h.type === 'sold' && h.winner?.userId === userId)
}
function getRoleGroups(roster: AuctionHistoryEntry[]) {
  return {
    batsman: roster.filter(h => h.player.role === 'batsman'),
    bowler: roster.filter(h => h.player.role === 'bowler'),
    all_rounder: roster.filter(h => h.player.role === 'all_rounder'),
    wicket_keeper: roster.filter(h => h.player.role === 'wicket_keeper'),
  }
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function AuctionScreen() {
  const insets = useSafeAreaInsets()
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>()
  const router = useRouter()
  const { user } = useAuthStore()
  const { data: leagueData } = useLeague(leagueId!)
  const { data: availableData, refetch: refetchAvailable } = useAvailablePlayers(leagueId!)

  const [activeTab, setActiveTab] = useState<Tab>('bidding')
  const [playersSubTab, setPlayersSubTab] = useState<'available' | 'history'>('available')
  const [squadExpanded, setSquadExpanded] = useState(false)

  // Available players filters
  const [availSearch, setAvailSearch] = useState('')
  const [availRoleFilter, setAvailRoleFilter] = useState<string | null>(null)
  const [availTeamFilter, setAvailTeamFilter] = useState<string | null>(null)
  const [availMaxPrice, setAvailMaxPrice] = useState('')
  const [availUnsoldOnly, setAvailUnsoldOnly] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

  // Admin bid-timer setting
  const [bidTimeoutInput, setBidTimeoutInput] = useState<string>('')
  const [savingTimeout, setSavingTimeout] = useState(false)

  // Assign player (bidding tab — admin)
  const [assignPlayerId, setAssignPlayerId] = useState<string | null>(null)
  const [assignUserId, setAssignUserId] = useState<string | null>(null)
  const [assignPrice, setAssignPrice] = useState('')
  const [assignLoading, setAssignLoading] = useState(false)

  // Move player (admin tab)
  const [movePlayerId, setMovePlayerId] = useState<string | null>(null)
  const [moveToUserId, setMoveToUserId] = useState<string | null>(null)
  const [movePrice, setMovePrice] = useState('')
  const [moveLoading, setMoveLoading] = useState(false)

  // Nominate modal
  const [showNominateModal, setShowNominateModal] = useState(false)
  const [nominateSearch, setNominateSearch] = useState('')
  const [nominateRoleFilter, setNominateRoleFilter] = useState<string | null>(null)
  const [nominateTeamFilter, setNominateTeamFilter] = useState<string | null>(null)

  // Pre-bid countdown modal
  const [showPreBidModal, setShowPreBidModal] = useState(false)
  const [preCountdown, setPreCountdown] = useState(3)
  const [previewPlayer, setPreviewPlayer] = useState<{ name: string; ipl_team: string; role: string; base_price: number; nationality: string } | null>(null)
  const preCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const skipNominationTickRef = useRef(false)

  const {
    wsStatus, sessionStatus, currentPlayer, currentBid, currentBidder,
    timerExpiresAt, awaitingConfirmation, nominationTick, members, queueRemaining,
    bidHistory, auctionHistory, lastSoldPlayer, lastUnsoldPlayer,
    placeBid, nominatePlayer, passPlayer, confirmPlayer, resetPlayer, clearToasts,
  } = useAuction(leagueId!)

  const league = leagueData?.league
  const currency = league?.currency ?? 'lakhs'
  const isAdmin = league?.admin_id === user?.id
  const myMember = members.find(m => m.userId === user?.id)
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (league?.bid_timeout_secs != null && bidTimeoutInput === '') {
      setBidTimeoutInput(String(league.bid_timeout_secs))
    }
  }, [league?.bid_timeout_secs])

  useEffect(() => {
    if (selectedMemberId === null && user?.id) setSelectedMemberId(user.id)
  }, [members, user?.id])

  // My squad (bidding tab inline)
  const myRoster = getRosterForMember(auctionHistory, user?.id ?? '')
  const myRoleGroups = getRoleGroups(myRoster)

  // Teams tab
  const effectiveSelectedId = selectedMemberId ?? user?.id ?? members[0]?.userId ?? ''
  const selectedMember = members.find(m => m.userId === effectiveSelectedId)
  const selectedRoster = getRosterForMember(auctionHistory, effectiveSelectedId)
  const selectedRoleGroups = getRoleGroups(selectedRoster)

  // Dropdown options
  const memberOptions: SelectOption[] = members.map(m => ({
    id: m.userId,
    label: (m.displayName ?? m.username) + (m.userId === user?.id ? ' (you)' : ''),
    sublabel: `${formatCurrency(m.remainingBudget, currency)} remaining · ${m.rosterCount} players`,
  }))

  const availablePlayerOptions: SelectOption[] = (availableData?.players ?? [])
    .filter(p => p.status === 'pending' || p.status === 'unsold')
    .map(p => ({
      id: p.player_id,
      label: p.name,
      sublabel: `${p.ipl_team} · ${roleLabels[p.role] ?? p.role} · ${formatCurrency(playerBasePrice(p, currency), currency)} base`,
    }))

  const assignedPlayerOptions: SelectOption[] = auctionHistory
    .filter(h => h.type === 'sold')
    .map(h => ({
      id: h.player.id,
      label: h.player.name,
      sublabel: `${h.player.ipl_team} · owned by ${h.winner?.displayName ?? h.winner?.username ?? '?'}`,
    }))

  // Non-admin viewers: show countdown when PLAYER_NOMINATED arrives via WS
  useEffect(() => {
    if (nominationTick === 0) return
    if (skipNominationTickRef.current) {
      // Admin already started the countdown directly — skip this WS echo
      skipNominationTickRef.current = false
      return
    }
    // For non-admin viewers: grab player info from the store's currentPlayer
    setPreCountdown(3)
    setShowPreBidModal(true)
    if (preCountdownRef.current) clearInterval(preCountdownRef.current)
    preCountdownRef.current = setInterval(() => {
      setPreCountdown(prev => {
        if (prev <= 1) {
          clearInterval(preCountdownRef.current!)
          setShowPreBidModal(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [nominationTick])

  // Hide modal if player is cleared (sold/unsold) before countdown finishes
  useEffect(() => {
    if (!currentPlayer) {
      if (preCountdownRef.current) clearInterval(preCountdownRef.current)
      setShowPreBidModal(false)
      setPreviewPlayer(null)
    }
  }, [currentPlayer])

  useEffect(() => () => {
    if (preCountdownRef.current) clearInterval(preCountdownRef.current)
  }, [])

  useEffect(() => {
    if (lastSoldPlayer || lastUnsoldPlayer) {
      refetchAvailable()
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(3000),
        Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start(() => clearToasts())
    }
  }, [lastSoldPlayer, lastUnsoldPlayer])

  // ── Handlers ──

  const handleStartBidding = async () => {
    try { await api.post(`/auction/${leagueId}/start`, {}) }
    catch (err: any) { Alert.alert('Error', err?.message ?? 'Failed to start auction') }
  }

  const startPreBidCountdown = (player: { name: string; ipl_team: string; role: string; base_price: number; nationality: string }) => {
    setPreviewPlayer(player)
    setPreCountdown(3)
    setShowPreBidModal(true)
    if (preCountdownRef.current) clearInterval(preCountdownRef.current)
    preCountdownRef.current = setInterval(() => {
      setPreCountdown(prev => {
        if (prev <= 1) {
          clearInterval(preCountdownRef.current!)
          setShowPreBidModal(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleNominate = () => {
    setNominateSearch('')
    setNominateRoleFilter(null)
    setNominateTeamFilter(null)
    setShowNominateModal(true)
  }

  const handleNominateRandom = async () => {
    setShowNominateModal(false)
    try {
      const { player: next } = await api.get<{ player: { player_id: string; name: string; ipl_team: string; role: string; base_price: number; nationality: string } | null }>(
        `/auction/${leagueId}/next-player`
      )
      if (!next) { Alert.alert('No players', 'All players have been nominated'); return }
      skipNominationTickRef.current = true
      startPreBidCountdown(next)
      nominatePlayer(next.player_id)
    } catch (err: any) { Alert.alert('Error', err?.message ?? 'Failed to nominate player') }
  }

  const handleNominateSpecific = (playerId: string) => {
    const player = availableData?.players.find(p => p.player_id === playerId)
    setShowNominateModal(false)
    if (player) {
      skipNominationTickRef.current = true
      startPreBidCountdown(player)
    }
    nominatePlayer(playerId)
  }

  const handleCancelPreBid = () => {
    if (preCountdownRef.current) clearInterval(preCountdownRef.current)
    setShowPreBidModal(false)
    passPlayer()
  }

  const handlePause = async () => {
    try { await api.post(`/auction/${leagueId}/pause`, {}) }
    catch (err: any) { Alert.alert('Error', err?.message ?? 'Failed to pause auction') }
  }

  const handleResume = async () => {
    try { await api.post(`/auction/${leagueId}/resume`, {}) }
    catch (err: any) { Alert.alert('Error', err?.message ?? 'Failed to resume auction') }
  }

  const handleSaveBidTimeout = async () => {
    const secs = parseInt(bidTimeoutInput, 10)
    if (isNaN(secs) || secs < 5 || secs > 120) {
      Alert.alert('Invalid', 'Bid timer must be between 5 and 120 seconds'); return
    }
    try {
      setSavingTimeout(true)
      await api.patch(`/auction/${leagueId}/bid-timeout`, { bidTimeoutSecs: secs })
      Alert.alert('Saved', `Bid timer updated to ${secs}s — takes effect on next nomination`)
    } catch (err: any) { Alert.alert('Error', err?.message ?? 'Failed to update bid timer') }
    finally { setSavingTimeout(false) }
  }

  const handleEndAuction = () => {
    Alert.alert(
      'End Auction',
      'This will end the draft immediately and move the league to the active phase. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Auction', style: 'destructive', onPress: async () => {
          try { await api.post(`/auction/${leagueId}/end`, {}) }
          catch (err: any) { Alert.alert('Error', err?.message ?? 'Failed to end auction') }
        }},
      ]
    )
  }

  const handleAssignPlayer = async () => {
    if (!assignPlayerId || !assignUserId) {
      Alert.alert('Incomplete', 'Select a player and a team'); return
    }
    const price = parseInt(assignPrice, 10)
    if (isNaN(price) || price < 0) { Alert.alert('Invalid', 'Enter a valid price'); return }
    try {
      setAssignLoading(true)
      await api.post(`/auction/${leagueId}/admin/assign`, {
        playerId: assignPlayerId, userId: assignUserId, price,
      })
      setAssignPlayerId(null); setAssignUserId(null); setAssignPrice('')
      refetchAvailable()
    } catch (err: any) { Alert.alert('Error', err?.message ?? 'Failed to assign player') }
    finally { setAssignLoading(false) }
  }

  const handleMovePlayer = async () => {
    if (!movePlayerId || !moveToUserId) {
      Alert.alert('Incomplete', 'Select a player and a target team'); return
    }
    const price = parseInt(movePrice, 10)
    if (isNaN(price) || price < 0) { Alert.alert('Invalid', 'Enter a valid price'); return }
    try {
      setMoveLoading(true)
      await api.post(`/auction/${leagueId}/admin/move`, {
        playerId: movePlayerId, toUserId: moveToUserId, price,
      })
      setMovePlayerId(null); setMoveToUserId(null); setMovePrice('')
    } catch (err: any) { Alert.alert('Error', err?.message ?? 'Failed to move player') }
    finally { setMoveLoading(false) }
  }

  const wsStatusColor = wsStatus === 'connected' ? 'green' : wsStatus === 'connecting' ? 'yellow' : 'red'
  const wsStatusLabel = wsStatus === 'connected' ? 'Connected' : wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected'

  const tabs: { key: Tab; label: string }[] = [
    { key: 'bidding', label: 'Bidding' },
    { key: 'teams', label: 'Teams' },
    { key: 'players', label: 'Players' },
    ...(isAdmin ? [{ key: 'admin' as Tab, label: 'Admin' }] : []),
  ]

  const squadSummaryParts = ROLE_ORDER
    .map(role => ({ role, count: myRoleGroups[role].length }))
    .filter(r => r.count > 0)
    .map(r => `${r.count} ${roleLabels[r.role]}`)
  const squadSummary = squadSummaryParts.length > 0 ? squadSummaryParts.join(' · ') : 'No players yet'

  // ── Shared chip helpers ──
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
  const roleChips: { label: string; value: string | null }[] = [
    { label: 'All', value: null },
    { label: 'BAT', value: 'batsman' },
    { label: 'WK', value: 'wicket_keeper' },
    { label: 'AR', value: 'all_rounder' },
    { label: 'BOWL', value: 'bowler' },
  ]

  // ── Render ──

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb', paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-gray-500">← Back</Text>
        </TouchableOpacity>
        <View className="flex-row gap-2 items-center">
          <Badge label={wsStatusLabel} color={wsStatusColor} />
          {sessionStatus && (
            <Badge
              label={sessionStatus === 'live' ? '🔴 LIVE' : sessionStatus.toUpperCase()}
              color={sessionStatus === 'live' ? 'red' : sessionStatus === 'paused' ? 'yellow' : 'gray'}
            />
          )}
        </View>
        <Text className="text-gray-500 text-sm">{queueRemaining} left</Text>
      </View>

      {/* Tab bar */}
      <View className="flex-row bg-white border-b border-gray-200">
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 items-center border-b-2 ${activeTab === tab.key ? 'border-red-600' : 'border-transparent'}`}
          >
            <Text className={`text-xs font-medium ${activeTab === tab.key ? 'text-red-600' : 'text-gray-400'}`}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Toast */}
      {(lastSoldPlayer || lastUnsoldPlayer) && (
        <Animated.View style={{ opacity: fadeAnim }} className="absolute top-24 left-4 right-4 z-50">
          <View className={`rounded-2xl p-4 ${lastSoldPlayer ? 'bg-green-600' : 'bg-gray-700'}`}>
            {lastSoldPlayer ? (
              <Text className="text-white text-base font-bold text-center">
                🎉 {lastSoldPlayer.player.name} SOLD to{' '}
                {lastSoldPlayer.winner.displayName ?? lastSoldPlayer.winner.username}{' '}
                for {formatCurrency(lastSoldPlayer.price, currency)}!
              </Text>
            ) : (
              <Text className="text-white text-base text-center">{lastUnsoldPlayer?.name} went unsold</Text>
            )}
          </View>
        </Animated.View>
      )}

      {/* ── BIDDING TAB ── */}
      {activeTab === 'bidding' && (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 12 }}>
          {sessionStatus === 'completed' && (
            <View className="bg-green-50 rounded-2xl p-6 items-center gap-3 border border-green-200">
              <Text className="text-4xl">🏆</Text>
              <Text className="text-gray-900 text-xl font-bold">Auction Complete!</Text>
              <Button label="My Squad" variant="primary" onPress={() => router.push(`/(app)/team/${leagueId}`)} />
              <Button label="All Teams" variant="secondary" onPress={() => router.push(`/(app)/team/${leagueId}?tab=all`)} />
              <Button label="Back to League" variant="ghost" onPress={() => router.replace(`/(app)/league/${leagueId}`)} />
            </View>
          )}
          {sessionStatus === 'paused' && (
            <View className="bg-yellow-50 rounded-2xl p-4 items-center border border-yellow-200">
              <Text className="text-yellow-700 font-bold">⏸ Auction Paused</Text>
            </View>
          )}

          <PlayerCard player={currentPlayer} currency={currency} />

          {currentPlayer && !showPreBidModal && (
            <View className="flex-row items-center justify-between bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <View>
                <Text className="text-gray-500 text-xs mb-1">Current Bid</Text>
                <Text className="text-gray-900 text-3xl font-bold">
                  {formatCurrency(currentBid ?? playerBasePrice(currentPlayer, currency), currency)}
                </Text>
                {currentBidder && (
                  <Text className="text-gray-400 text-sm mt-0.5">
                    by {currentBidder.displayName ?? currentBidder.username}
                  </Text>
                )}
              </View>
              <CountdownTimer expiresAt={timerExpiresAt} totalSeconds={league?.bid_timeout_secs ?? 15} />
            </View>
          )}

          {currentPlayer && bidHistory.length > 0 && (
            <View className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <Text className="text-gray-400 text-xs font-medium mb-2">BID HISTORY</Text>
              <BidHistory history={bidHistory} currency={currency} />
            </View>
          )}

          <View className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <BudgetBar member={myMember} startingBudget={league?.starting_budget ?? 1000} currency={currency} />
          </View>

          {sessionStatus === 'live' && currentPlayer && myMember && !awaitingConfirmation && !showPreBidModal && (() => {
            const roleMaxMap: Record<string, number> = {
              batsman: league?.max_batsmen ?? Infinity,
              wicket_keeper: league?.max_wicket_keepers ?? Infinity,
              all_rounder: league?.max_all_rounders ?? Infinity,
              bowler: league?.max_bowlers ?? Infinity,
            }
            const roleMax = roleMaxMap[currentPlayer.role] ?? Infinity
            const myRoleCount = myRoleGroups[currentPlayer.role]?.length ?? 0
            const atRoleLimit = myRoleCount >= roleMax

            const roleDisplayNames: Record<string, string> = {
              batsman: 'Batsman',
              wicket_keeper: 'Wicket-Keeper',
              all_rounder: 'All-Rounder',
              bowler: 'Bowler',
            }

            if (atRoleLimit) {
              return (
                <View className="rounded-2xl p-4 border border-red-200" style={{ backgroundColor: '#fef2f2' }}>
                  <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 13, textAlign: 'center' }}>
                    You've filled your {roleDisplayNames[currentPlayer.role] ?? currentPlayer.role} slots ({roleMax}/{roleMax})
                  </Text>
                  <Text style={{ color: '#ef4444', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                    You cannot bid on this player
                  </Text>
                </View>
              )
            }

            return (
              <View className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <BidPanel
                  currentBid={currentBid}
                  basePrice={playerBasePrice(currentPlayer, currency)}
                  remainingBudget={myMember.remainingBudget}
                  onBid={placeBid}
                  disabled={currentBidder?.userId === user?.id}
                  currency={currency}
                />
              </View>
            )
          })()}

          {/* Admin: timer expired — confirm / pass / reset */}
          {isAdmin && awaitingConfirmation && currentPlayer && (
            <View className="rounded-2xl p-4 gap-3 border border-orange-200" style={{ backgroundColor: '#fff7ed' }}>
              <Text className="text-orange-700 text-xs font-semibold">⏰ TIMER ENDED — ACTION REQUIRED</Text>
              {currentBidder ? (
                <>
                  <Text className="text-gray-900 text-sm">
                    Highest bid: {formatCurrency(currentBid!, currency)} by {currentBidder.displayName ?? currentBidder.username}
                  </Text>
                  <Button
                    label={`Confirm — ${formatCurrency(currentBid!, currency)} to ${currentBidder.displayName ?? currentBidder.username}`}
                    variant="primary" onPress={confirmPlayer}
                  />
                </>
              ) : (
                <>
                  <Text className="text-gray-500 text-sm">No bids placed</Text>
                  <Button label="Pass Player (Unsold)" variant="danger" onPress={confirmPlayer} />
                </>
              )}
              <Button label="Reset — Restart Bidding" variant="secondary" onPress={resetPlayer} />
            </View>
          )}

          {/* Admin: nominate next player */}
          {isAdmin && sessionStatus === 'live' && !currentPlayer && !awaitingConfirmation && (
            <View className="bg-white rounded-2xl p-4 gap-3 border border-gray-100 shadow-sm">
              <Text className="text-gray-900 font-bold">Admin Controls</Text>
              <Button label="Nominate Next Player" variant="primary" onPress={handleNominate} />
            </View>
          )}

          {/* My Squad (collapsible) */}
          <View className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <TouchableOpacity
              onPress={() => setSquadExpanded(v => !v)}
              className="flex-row items-center justify-between p-4"
            >
              <View className="flex-row items-center gap-2">
                <Text className="text-gray-400 text-xs font-medium">MY SQUAD</Text>
                <Text className="text-gray-300 text-xs">·</Text>
                <Text className="text-gray-500 text-xs">{myRoster.length} players</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-gray-400 text-xs">{squadSummary}</Text>
                <Text className="text-gray-400 text-xs">{squadExpanded ? '▲' : '▼'}</Text>
              </View>
            </TouchableOpacity>
            {squadExpanded && (
              <View style={{ borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
                {myRoster.length === 0 ? (
                  <View className="p-4 items-center">
                    <Text className="text-gray-400 text-sm">No players acquired yet</Text>
                  </View>
                ) : (
                  ROLE_ORDER.map(role => {
                    const players = myRoleGroups[role]
                    if (players.length === 0) return null
                    return (
                      <View key={role} style={{ borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
                        <Text className="text-gray-400 text-xs font-medium px-4 pt-3 pb-1">
                          {roleFullLabels[role].toUpperCase()} ({players.length})
                        </Text>
                        {players.map(h => (
                          <View key={h.player.id} className="flex-row items-center justify-between px-4 py-2">
                            <View className="flex-1">
                              <Text className="text-gray-900 text-sm font-medium">{h.player.name}</Text>
                              <Text className="text-gray-400 text-xs">{h.player.ipl_team}</Text>
                            </View>
                            <Text className="text-green-600 text-sm font-semibold">{formatCurrency(h.price ?? 0, currency)}</Text>
                          </View>
                        ))}
                      </View>
                    )
                  })
                )}
                <View className="h-3" />
              </View>
            )}
          </View>

          {/* Participants */}
          <View className="bg-white rounded-2xl p-4 gap-2 border border-gray-100 shadow-sm">
            <Text className="text-gray-400 text-xs font-medium">PARTICIPANTS</Text>
            {members.map(m => (
              <View key={m.userId} className="flex-row items-center justify-between py-1">
                <Text className="text-gray-900 text-sm">
                  {m.displayName ?? m.username}
                  {m.userId === user?.id && <Text className="text-gray-400"> (you)</Text>}
                </Text>
                <Text className="text-green-600 text-sm font-medium">{formatCurrency(m.remainingBudget, currency)}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── TEAMS TAB ── */}
      {activeTab === 'teams' && (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 12 }}>
          {/* Member selector dropdown */}
          <InlineSelector
            label="Viewing team"
            value={effectiveSelectedId}
            options={memberOptions}
            onSelect={setSelectedMemberId}
            placeholder="Select a team…"
          />

          {/* Budget card */}
          {selectedMember && (
            <View className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <View className="flex-row items-center justify-between">
                <View className="gap-1">
                  <Text className="text-gray-500 text-xs font-medium">REMAINING BUDGET</Text>
                  <Text className="text-gray-900 text-3xl font-bold">{formatCurrency(selectedMember.remainingBudget, currency)}</Text>
                </View>
                <View className="items-end gap-1">
                  <Text className="text-gray-400 text-xs">{selectedMember.rosterCount} players</Text>
                  <View className="flex-row gap-1 flex-wrap justify-end">
                    {ROLE_ORDER.map(role => {
                      const count = selectedRoleGroups[role].length
                      if (count === 0) return null
                      return <Badge key={role} label={`${count} ${roleLabels[role]}`} color={roleBadgeColors[role]} />
                    })}
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Roster by role — always show all 4 sections */}
          {ROLE_ORDER.map(role => {
            const players = selectedRoleGroups[role]
            const max = league
              ? { batsman: league.max_batsmen, wicket_keeper: league.max_wicket_keepers, all_rounder: league.max_all_rounders, bowler: league.max_bowlers }[role] ?? '?'
              : '?'
            return (
              <View key={role} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
                  <View>
                    <Text className="text-gray-500 text-xs font-semibold">{roleFullLabels[role].toUpperCase()}</Text>
                    <Text className="text-gray-400 text-xs mt-0.5">Max {max}</Text>
                  </View>
                  <Badge label={String(players.length)} color={players.length > 0 ? roleBadgeColors[role] : 'gray'} />
                </View>
                {players.length === 0 ? (
                  <View style={{ borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingVertical: 12, alignItems: 'center' }}>
                    <Text className="text-gray-400 text-sm">No players picked yet</Text>
                  </View>
                ) : (
                  players.map(h => (
                    <View
                      key={h.player.id}
                      className="flex-row items-center justify-between px-4 py-2.5"
                      style={{ borderTopWidth: 1, borderTopColor: '#f3f4f6' }}
                    >
                      <View className="flex-1">
                        <Text className="text-gray-900 font-semibold text-sm">{h.player.name}</Text>
                        <Text className="text-gray-400 text-xs">{h.player.ipl_team}</Text>
                      </View>
                      <Text className="text-green-600 font-bold text-sm">{formatCurrency(h.price ?? 0, currency)}</Text>
                    </View>
                  ))
                )}
              </View>
            )
          })}
        </ScrollView>
      )}

      {/* ── PLAYERS TAB ── */}
      {activeTab === 'players' && (
        <View className="flex-1">
          {/* Sub-tab toggle */}
          <View className="flex-row mx-4 mt-3 mb-1 bg-gray-100 rounded-xl p-1">
            {(['available', 'history'] as const).map(sub => (
              <TouchableOpacity
                key={sub}
                onPress={() => setPlayersSubTab(sub)}
                style={{ flex: 1, paddingVertical: 7, borderRadius: 9, alignItems: 'center',
                  backgroundColor: playersSubTab === sub ? '#ffffff' : 'transparent' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600',
                  color: playersSubTab === sub ? '#111827' : '#6b7280' }}>
                  {sub === 'available' ? 'Available' : 'History'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {playersSubTab === 'available' && (() => {
            const allPlayers = availableData?.players ?? []
            const uniqueTeams = [...new Set(allPlayers.map(p => p.ipl_team))].sort()
            const maxPriceNum = availMaxPrice ? parseInt(availMaxPrice, 10) : null

            const filtered = allPlayers.filter(p => {
              if (availSearch && !p.name.toLowerCase().includes(availSearch.toLowerCase()) &&
                  !p.ipl_team.toLowerCase().includes(availSearch.toLowerCase())) return false
              if (availRoleFilter && p.role !== availRoleFilter) return false
              if (availTeamFilter && p.ipl_team !== availTeamFilter) return false
              if (maxPriceNum !== null && !isNaN(maxPriceNum) && playerBasePrice(p, currency) > maxPriceNum) return false
              if (availUnsoldOnly && p.status !== 'unsold') return false
              return true
            })

            return (
              <FlatList
                data={filtered}
                keyExtractor={p => p.player_id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                  <View style={{ gap: 10, paddingTop: 12, paddingBottom: 4 }}>
                    {/* Search */}
                    <RNTextInput
                      value={availSearch}
                      onChangeText={setAvailSearch}
                      placeholder="Search by name or team…"
                      placeholderTextColor="#9ca3af"
                      style={{
                        backgroundColor: '#ffffff', borderRadius: 12,
                        paddingHorizontal: 14, paddingVertical: 10,
                        fontSize: 14, color: '#111827',
                        borderWidth: 1, borderColor: '#e5e7eb',
                      }}
                    />

                    {/* Role filter */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row' }}>
                        {roleChips.map(({ label, value }) => (
                          <TouchableOpacity
                            key={label}
                            onPress={() => setAvailRoleFilter(value)}
                            style={chipStyle(availRoleFilter === value)}
                          >
                            <Text style={chipText(availRoleFilter === value)}>{label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    {/* Team filter */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row' }}>
                        <TouchableOpacity
                          onPress={() => setAvailTeamFilter(null)}
                          style={chipStyle(availTeamFilter === null)}
                        >
                          <Text style={chipText(availTeamFilter === null)}>All Teams</Text>
                        </TouchableOpacity>
                        {uniqueTeams.map(team => (
                          <TouchableOpacity
                            key={team}
                            onPress={() => setAvailTeamFilter(team)}
                            style={chipStyle(availTeamFilter === team)}
                          >
                            <Text style={chipText(availTeamFilter === team)}>{team}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    {/* Price + Unsold + Clear row */}
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <View style={{
                        flex: 1, flexDirection: 'row', alignItems: 'center',
                        backgroundColor: '#ffffff', borderRadius: 12,
                        borderWidth: 1, borderColor: '#e5e7eb',
                        paddingHorizontal: 12, paddingVertical: 8,
                      }}>
                        <Text style={{ color: '#9ca3af', fontSize: 13, marginRight: 4 }}>{currency === 'usd' ? 'Max $' : 'Max ₹'}</Text>
                        <RNTextInput
                          value={availMaxPrice}
                          onChangeText={setAvailMaxPrice}
                          placeholder="any"
                          placeholderTextColor="#9ca3af"
                          keyboardType="number-pad"
                          style={{ flex: 1, fontSize: 13, color: '#111827', padding: 0 }}
                        />
                        <Text style={{ color: '#9ca3af', fontSize: 13 }}>L</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setAvailUnsoldOnly(v => !v)}
                        style={chipStyle(availUnsoldOnly)}
                      >
                        <Text style={chipText(availUnsoldOnly)}>Unsold only</Text>
                      </TouchableOpacity>
                      {(availSearch || availRoleFilter || availTeamFilter || availMaxPrice || availUnsoldOnly) && (
                        <TouchableOpacity
                          onPress={() => {
                            setAvailSearch('')
                            setAvailRoleFilter(null)
                            setAvailTeamFilter(null)
                            setAvailMaxPrice('')
                            setAvailUnsoldOnly(false)
                          }}
                          style={{ paddingHorizontal: 10, paddingVertical: 6 }}
                        >
                          <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Clear</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                }
                ListEmptyComponent={
                  <View className="bg-white rounded-2xl p-8 items-center border border-gray-100">
                    <Text className="text-gray-400 text-base">No players found</Text>
                  </View>
                }
                renderItem={({ item, index }) => {
                  const statusColor = item.status === 'pending' ? 'gray' :
                    item.status === 'live' ? 'red' : item.status === 'unsold' ? 'yellow' : 'green'
                  return (
                    <View style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingVertical: 9, paddingHorizontal: 4,
                      borderTopWidth: index === 0 ? 0 : 1, borderTopColor: '#f3f4f6',
                      gap: 8,
                    }}>
                      {/* Name + meta */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#111827', fontWeight: '600', fontSize: 13 }}>{item.name}</Text>
                        <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', marginTop: 2 }}>
                          <Text style={{ color: '#9ca3af', fontSize: 11 }}>{item.ipl_team}</Text>
                          <Badge label={roleLabels[item.role] ?? item.role} color={roleBadgeColors[item.role] ?? 'gray'} />
                          {item.nationality !== 'Indian' && <Badge label="OS" color="yellow" />}
                        </View>
                      </View>
                      {/* Right side */}
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <Text style={{ color: '#6b7280', fontSize: 12 }}>{formatCurrency(playerBasePrice(item, currency), currency)}</Text>
                        {item.status !== 'pending' && <Badge label={item.status.toUpperCase()} color={statusColor} />}
                        {item.status === 'sold' && item.sold_price && (
                          <Text style={{ color: '#16a34a', fontSize: 11, fontWeight: '700' }}>{formatCurrency(item.sold_price, currency)}</Text>
                        )}
                      </View>
                    </View>
                  )
                }}
              />
            )
          })()}

          {playersSubTab === 'history' && (
            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 8 }}>
              {auctionHistory.length === 0 ? (
                <View className="bg-white rounded-2xl p-8 items-center border border-gray-100">
                  <Text className="text-gray-400 text-base">No players auctioned yet</Text>
                </View>
              ) : (
                auctionHistory.map((entry, index) => {
                  const pickNum = auctionHistory.length - index
                  const isMyPick = entry.type === 'sold' && entry.winner?.userId === user?.id
                  return (
                    <View
                      key={`${entry.player.id}-${index}`}
                      style={{
                        borderRadius: 16, padding: 12,
                        backgroundColor: isMyPick ? '#f0fdf4' : '#ffffff',
                        borderWidth: 1, borderColor: isMyPick ? '#86efac' : '#f3f4f6',
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                      }}
                    >
                      {/* Pick number */}
                      <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '600', width: 28, textAlign: 'right' }}>
                        {pickNum}
                      </Text>

                      {/* Player info */}
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ color: '#111827', fontWeight: '600', fontSize: 14 }}>{entry.player.name}</Text>
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                          <Text style={{ color: '#9ca3af', fontSize: 12 }}>{entry.player.ipl_team}</Text>
                          <Badge label={roleLabels[entry.player.role] ?? entry.player.role} color={roleBadgeColors[entry.player.role] ?? 'gray'} />
                        </View>
                      </View>

                      {/* Result */}
                      {entry.type === 'sold' ? (
                        <View style={{ alignItems: 'flex-end', gap: 2 }}>
                          <Text style={{ color: '#16a34a', fontWeight: '700', fontSize: 14 }}>{formatCurrency(entry.price ?? 0, currency)}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Avatar uri={entry.winner?.avatarUrl} name={entry.winner?.displayName ?? entry.winner?.username} size={16} />
                            <Text style={{ color: '#6b7280', fontSize: 11 }}>{entry.winner?.displayName ?? entry.winner?.username}</Text>
                          </View>
                        </View>
                      ) : (
                        <Badge label="UNSOLD" color="gray" />
                      )}
                    </View>
                  )
                })
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* ── PRE-BID COUNTDOWN MODAL ── */}
      <Modal visible={showPreBidModal} transparent animationType="fade">
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
          alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32,
        }}>
          <View style={{
            backgroundColor: '#ffffff', borderRadius: 28, width: '100%',
            alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24,
            shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3, shadowRadius: 24,
          }}>
            {/* Player info — use previewPlayer immediately (before WS echo) or currentPlayer */}
            {(() => {
              const p = previewPlayer ?? currentPlayer
              if (!p) return null
              return (
                <>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    <Badge label={roleLabels[p.role] ?? p.role} color={roleBadgeColors[p.role] ?? 'gray'} />
                    {p.nationality !== 'Indian' && <Badge label="OS" color="yellow" />}
                    <Text style={{ color: '#9ca3af', fontSize: 13 }}>{p.ipl_team}</Text>
                  </View>
                  <Text style={{ color: '#111827', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 4 }}>
                    {p.name}
                  </Text>
                  <Text style={{ color: '#6b7280', fontSize: 13, marginBottom: 28 }}>
                    Base price {formatCurrency(playerBasePrice(p, currency), currency)}
                  </Text>
                </>
              )
            })()}

            {/* Countdown ring */}
            <View style={{
              width: 100, height: 100, borderRadius: 50,
              backgroundColor: '#16a34a',
              alignItems: 'center', justifyContent: 'center', marginBottom: 20,
            }}>
              <Text style={{ color: '#ffffff', fontSize: 52, fontWeight: '900', lineHeight: 60 }}>
                {preCountdown}
              </Text>
            </View>

            <Text style={{ color: '#374151', fontSize: 15, fontWeight: '700', letterSpacing: 1, marginBottom: 28 }}>
              BIDDING STARTS SOON
            </Text>

            {/* Admin-only cancel */}
            {isAdmin && (
              <TouchableOpacity
                onPress={handleCancelPreBid}
                style={{
                  borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 14,
                  paddingVertical: 11, paddingHorizontal: 28,
                }}
              >
                <Text style={{ color: '#6b7280', fontWeight: '600', fontSize: 14 }}>Cancel Nomination</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* ── NOMINATE MODAL ── */}
      <Modal
        visible={showNominateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNominateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
            activeOpacity={1}
            onPress={() => setShowNominateModal(false)}
          />
          <View style={{
            backgroundColor: '#ffffff',
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            maxHeight: '75%',
            paddingBottom: insets.bottom + 8,
          }}>
            {/* Handle */}
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb' }} />
            </View>

            {/* Title row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>Nominate Player</Text>
              <TouchableOpacity onPress={() => setShowNominateModal(false)}>
                <Text style={{ fontSize: 22, color: '#9ca3af', lineHeight: 24 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Random button */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
              <TouchableOpacity
                onPress={handleNominateRandom}
                style={{
                  backgroundColor: '#dc2626', borderRadius: 14,
                  paddingVertical: 14, alignItems: 'center',
                  flexDirection: 'row', justifyContent: 'center', gap: 8,
                }}
              >
                <Text style={{ fontSize: 18 }}>🎲</Text>
                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>
                  Select by Interest / Queue Order
                </Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, gap: 10 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: '#f3f4f6' }} />
              <Text style={{ color: '#9ca3af', fontSize: 12 }}>or pick manually</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: '#f3f4f6' }} />
            </View>

            {/* Search */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
              <RNTextInput
                value={nominateSearch}
                onChangeText={setNominateSearch}
                placeholder="Search by name or team…"
                placeholderTextColor="#9ca3af"
                autoCorrect={false}
                style={{
                  backgroundColor: '#f3f4f6', borderRadius: 12,
                  paddingHorizontal: 14, paddingVertical: 10,
                  fontSize: 15, color: '#111827',
                  borderWidth: 1, borderColor: '#e5e7eb',
                }}
              />
            </View>

            {/* Role filter chips */}
            <View style={{ marginBottom: 8 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, flexDirection: 'row' }}>
                {roleChips.map(({ label, value }) => (
                  <TouchableOpacity key={label} onPress={() => setNominateRoleFilter(value)} style={chipStyle(nominateRoleFilter === value)}>
                    <Text style={chipText(nominateRoleFilter === value)}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Team filter chips */}
            {(() => {
              const nomTeams = [...new Set((availableData?.players ?? [])
                .filter(p => p.status === 'pending' || p.status === 'unsold')
                .map(p => p.ipl_team))].sort()
              return (
                <View style={{ marginBottom: 10 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, flexDirection: 'row' }}>
                    <TouchableOpacity onPress={() => setNominateTeamFilter(null)} style={chipStyle(nominateTeamFilter === null)}>
                      <Text style={chipText(nominateTeamFilter === null)}>All Teams</Text>
                    </TouchableOpacity>
                    {nomTeams.map(team => (
                      <TouchableOpacity key={team} onPress={() => setNominateTeamFilter(team)} style={chipStyle(nominateTeamFilter === team)}>
                        <Text style={chipText(nominateTeamFilter === team)}>{team}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )
            })()}

            {/* Player list */}
            {(() => {
              const nominatePlayers = (availableData?.players ?? []).filter(
                p => p.status === 'pending' || p.status === 'unsold'
              )
              const filtered = nominatePlayers.filter(p => {
                if (nominateSearch.trim() && !p.name.toLowerCase().includes(nominateSearch.toLowerCase()) &&
                    !p.ipl_team.toLowerCase().includes(nominateSearch.toLowerCase())) return false
                if (nominateRoleFilter && p.role !== nominateRoleFilter) return false
                if (nominateTeamFilter && p.ipl_team !== nominateTeamFilter) return false
                return true
              })
              return (
                <FlatList
                  data={filtered}
                  keyExtractor={p => p.player_id}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
                  ListEmptyComponent={
                    <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                      <Text style={{ color: '#9ca3af' }}>No players found</Text>
                    </View>
                  }
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      onPress={() => handleNominateSpecific(item.player_id)}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 12,
                        paddingVertical: 11,
                        borderTopWidth: index > 0 ? 1 : 0, borderTopColor: '#f3f4f6',
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#111827', fontWeight: '600', fontSize: 14 }}>{item.name}</Text>
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 2 }}>
                          <Text style={{ color: '#9ca3af', fontSize: 12 }}>{item.ipl_team}</Text>
                          <Badge label={roleLabels[item.role] ?? item.role} color={roleBadgeColors[item.role] ?? 'gray'} />
                          {item.nationality !== 'Indian' && <Badge label="OS" color="yellow" />}
                          <Text style={{ color: '#9ca3af', fontSize: 12 }}>{formatCurrency(playerBasePrice(item, currency), currency)}</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        {item.status === 'unsold' && (
                          <Badge label="UNSOLD" color="yellow" />
                        )}
                        {item.interest_count > 0 && (
                          <Text style={{ color: '#9ca3af', fontSize: 11 }}>{item.interest_count} want</Text>
                        )}
                        <Text style={{ color: '#dc2626', fontSize: 13 }}>▶</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )
            })()}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── ADMIN TAB ── */}
      {activeTab === 'admin' && isAdmin && (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 12 }}>
          {/* Pause / Resume */}
          {sessionStatus === 'live' && (
            <View className="bg-white rounded-2xl p-4 gap-3 border border-gray-100 shadow-sm">
              <Text className="text-gray-900 font-bold">Session Control</Text>
              <Button label="Pause Auction" variant="secondary" onPress={handlePause} />
            </View>
          )}
          {sessionStatus === 'paused' && (
            <View className="rounded-2xl p-4 gap-3 border border-yellow-200" style={{ backgroundColor: '#fefce8' }}>
              <Text className="text-yellow-700 font-bold">⏸ Auction Paused</Text>
              <Button label="Resume Auction" variant="primary" onPress={handleResume} />
            </View>
          )}

          {/* Move player between teams */}
          {auctionHistory.some(h => h.type === 'sold') && (
            <View className="bg-white rounded-2xl p-4 gap-3 border border-gray-100 shadow-sm">
              <Text className="text-gray-900 font-bold">Move Player Between Teams</Text>
              <Text className="text-gray-500 text-sm">
                Reassign an already-drafted player to a different team. The original owner's budget is restored; the new owner is charged the new price.
              </Text>
              <InlineSelector
                label="Player (current roster)"
                value={movePlayerId}
                options={assignedPlayerOptions}
                onSelect={id => {
                  setMovePlayerId(id)
                  const entry = auctionHistory.find(h => h.type === 'sold' && h.player.id === id)
                  if (entry?.price != null) setMovePrice(String(entry.price))
                }}
                placeholder="Select player…"
              />
              <InlineSelector
                label="Move to team"
                value={moveToUserId}
                options={memberOptions}
                onSelect={setMoveToUserId}
                placeholder="Select team…"
              />
              <View>
                <Text style={{ color: '#6b7280', fontSize: 12, marginBottom: 4, fontWeight: '500' }}>
                  New Price (L)
                </Text>
                <RNTextInput
                  value={movePrice}
                  onChangeText={setMovePrice}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#9ca3af"
                  style={{
                    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
                    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
                    color: '#111827', backgroundColor: '#f9fafb',
                  }}
                />
              </View>
              <Button
                label={moveLoading ? 'Moving…' : 'Move Player'}
                variant="primary"
                onPress={handleMovePlayer}
                disabled={moveLoading}
              />
            </View>
          )}

          {/* Assign player to team */}
          {sessionStatus !== null && sessionStatus !== 'completed' && (
            <View className="bg-white rounded-2xl p-4 gap-3 border border-gray-100 shadow-sm">
              <Text className="text-gray-900 font-bold">Assign Player to Team</Text>
              <Text className="text-gray-500 text-sm">
                Bypass the auction and assign any pending or unsold player directly to a team.
              </Text>
              <InlineSelector
                label="Player"
                value={assignPlayerId}
                options={availablePlayerOptions}
                onSelect={id => {
                  setAssignPlayerId(id)
                  const p = availableData?.players.find(pl => pl.player_id === id)
                  if (p) setAssignPrice(String(playerBasePrice(p, currency)))
                }}
                placeholder="Select player…"
              />
              <InlineSelector
                label="Team"
                value={assignUserId}
                options={memberOptions}
                onSelect={setAssignUserId}
                placeholder="Select team…"
              />
              <View>
                <Text style={{ color: '#6b7280', fontSize: 12, marginBottom: 4, fontWeight: '500' }}>
                  Price (L)
                </Text>
                <RNTextInput
                  value={assignPrice}
                  onChangeText={setAssignPrice}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#9ca3af"
                  style={{
                    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
                    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
                    color: '#111827', backgroundColor: '#f9fafb',
                  }}
                />
              </View>
              <Button
                label={assignLoading ? 'Assigning…' : 'Assign Player'}
                variant="primary"
                onPress={handleAssignPlayer}
                disabled={assignLoading}
              />
            </View>
          )}

          {/* Bid timer */}
          <View className="bg-white rounded-2xl p-4 gap-3 border border-gray-100 shadow-sm">
            <Text className="text-gray-900 font-bold">Bid Timer</Text>
            <Text className="text-gray-500 text-sm">
              Seconds per player. Takes effect on the next nomination.
            </Text>
            <View className="flex-row items-center gap-3">
              <RNTextInput
                value={bidTimeoutInput}
                onChangeText={setBidTimeoutInput}
                keyboardType="number-pad"
                style={{
                  flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12,
                  paddingHorizontal: 12, paddingVertical: 10, fontSize: 16,
                  color: '#111827', backgroundColor: '#f9fafb',
                }}
                placeholder="15"
                placeholderTextColor="#9ca3af"
                maxLength={3}
              />
              <Text className="text-gray-400 text-sm">sec</Text>
            </View>
            <Button
              label={savingTimeout ? 'Saving…' : 'Save Timer'}
              variant="secondary"
              onPress={handleSaveBidTimeout}
              disabled={savingTimeout}
            />
          </View>

          {/* End auction */}
          {sessionStatus !== 'completed' && (
            <View className="rounded-2xl p-4 gap-3 border border-red-200" style={{ backgroundColor: '#fef2f2' }}>
              <Text className="text-gray-900 font-bold">End Auction</Text>
              <Text className="text-gray-500 text-sm">
                Immediately ends the draft and transitions the league to the active phase. Any player on the clock goes unsold. This cannot be undone.
              </Text>
              <Button label="End Auction Now" variant="danger" onPress={handleEndAuction} />
            </View>
          )}

          {sessionStatus === 'completed' && (
            <View className="rounded-2xl p-6 items-center gap-3 border border-green-200" style={{ backgroundColor: '#f0fdf4' }}>
              <Text className="text-4xl">🏆</Text>
              <Text className="text-gray-900 text-xl font-bold">Auction Complete</Text>
              <Text className="text-gray-500 text-sm text-center">League is now in active phase.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  )
}
