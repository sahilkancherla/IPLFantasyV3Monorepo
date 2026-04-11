import { useState, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  ScrollView, Modal, ActivityIndicator, Alert, Switch,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { Stack } from 'expo-router'
import {
  useAdminMatches, useAdminMatchDetail, useAdminPatchMatch,
  useAdminSaveStats, useAdminImportScorecard, useAdminClearStats,
  type AdminMatch, type AdminPlayer, type PlayerStatPayload,
} from '../../hooks/useAdminOps'
import type { AdminStatRow } from '../../hooks/useAdminOps'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerStatForm {
  isInXI: boolean
  runs: string; ballsFaced: string; fours: string; sixes: string; isOut: boolean
  wickets: string; ballsBowled: string; runsConceded: string; maidens: string; lbwBowledWickets: string
  catches: string; stumpings: string; runOutsDirect: string; runOutsIndirect: string
  dismissalText: string
}

const emptyForm = (): PlayerStatForm => ({
  isInXI: false,
  runs: '0', ballsFaced: '0', fours: '0', sixes: '0', isOut: false,
  wickets: '0', ballsBowled: '0', runsConceded: '0', maidens: '0', lbwBowledWickets: '0',
  catches: '0', stumpings: '0', runOutsDirect: '0', runOutsIndirect: '0',
  dismissalText: '',
})

function dbToForm(s: AdminStatRow): PlayerStatForm {
  return {
    isInXI: s.is_in_xi ?? false,
    runs: String(s.runs_scored ?? 0), ballsFaced: String(s.balls_faced ?? 0),
    fours: String(s.fours ?? 0), sixes: String(s.sixes ?? 0), isOut: s.is_out ?? false,
    wickets: String(s.wickets_taken ?? 0), ballsBowled: String(s.balls_bowled ?? 0),
    runsConceded: String(s.runs_conceded ?? 0), maidens: String(s.maidens ?? 0),
    lbwBowledWickets: String(s.lbw_bowled_wickets ?? 0),
    catches: String(s.catches ?? 0), stumpings: String(s.stumpings ?? 0),
    runOutsDirect: String(s.run_outs_direct ?? 0), runOutsIndirect: String(s.run_outs_indirect ?? 0),
    dismissalText: s.dismissal_text ?? '',
  }
}

function formToPayload(playerId: string, f: PlayerStatForm): PlayerStatPayload {
  const n = (v: string) => parseInt(v, 10) || 0
  return {
    playerId, isInXI: f.isInXI, isOut: f.isOut, dismissalText: f.dismissalText,
    runs: n(f.runs), ballsFaced: n(f.ballsFaced), fours: n(f.fours), sixes: n(f.sixes),
    wickets: n(f.wickets), ballsBowled: n(f.ballsBowled), runsConceded: n(f.runsConceded),
    maidens: n(f.maidens), lbwBowledWickets: n(f.lbwBowledWickets),
    catches: n(f.catches), stumpings: n(f.stumpings),
    runOutsDirect: n(f.runOutsDirect), runOutsIndirect: n(f.runOutsIndirect),
  }
}

function statSummary(f: PlayerStatForm): string {
  if (!f.isInXI) return '—'
  const parts: string[] = []
  const runs = parseInt(f.runs) || 0, bf = parseInt(f.ballsFaced) || 0
  const wk = parseInt(f.wickets) || 0, bb = parseInt(f.ballsBowled) || 0, rc = parseInt(f.runsConceded) || 0
  if (bf > 0 || runs > 0) parts.push(`${runs}(${bf})`)
  if (bb > 0) parts.push(`${wk}/${rc}(${Math.floor(bb / 6)}.${bb % 6}ov)`)
  const c = parseInt(f.catches) || 0, st = parseInt(f.stumpings) || 0
  if (c > 0) parts.push(`${c}c`)
  if (st > 0) parts.push(`${st}st`)
  return parts.join(' ') || 'In XI'
}

// ─── Player Stats Editor Modal ────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  batsman: '#2563eb', bowler: '#dc2626', all_rounder: '#16a34a', wicket_keeper: '#d97706',
}
const ROLE_SHORT: Record<string, string> = {
  batsman: 'BAT', bowler: 'BOW', all_rounder: 'AR', wicket_keeper: 'WK',
}

function NumInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1, minWidth: 70 }}>
      <Text style={{ color: '#9ca3af', fontSize: 10, fontWeight: '600', marginBottom: 3 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        style={{
          backgroundColor: '#f9fafb', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb',
          paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, color: '#111827', textAlign: 'center',
        }}
      />
    </View>
  )
}

interface PlayerEditorProps {
  player: AdminPlayer | null
  form: PlayerStatForm
  onChange: (f: PlayerStatForm) => void
  onClose: () => void
}

function PlayerStatsEditorModal({ player, form, onChange, onClose }: PlayerEditorProps) {
  const [local, setLocal] = useState<PlayerStatForm>(form)
  useEffect(() => { setLocal(form) }, [player?.id])

  if (!player) return null
  const set = (k: keyof PlayerStatForm) => (v: string | boolean) =>
    setLocal(prev => ({ ...prev, [k]: v }))

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          {/* Header */}
          <View style={{
            backgroundColor: 'white', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#111827', fontWeight: '700', fontSize: 16 }}>{player.name}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 3 }}>
                <View style={{ backgroundColor: (ROLE_COLORS[player.role] ?? '#6b7280') + '20', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: ROLE_COLORS[player.role] ?? '#6b7280', fontSize: 11, fontWeight: '700' }}>{ROLE_SHORT[player.role] ?? player.role}</Text>
                </View>
                <Text style={{ color: '#9ca3af', fontSize: 12 }}>{player.ipl_team}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => { onChange(local); onClose() }} style={{ paddingLeft: 16 }}>
              <Text style={{ color: '#dc2626', fontSize: 15, fontWeight: '700' }}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            {/* In XI toggle */}
            <View style={{
              backgroundColor: 'white', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#f3f4f6',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <Text style={{ color: '#111827', fontWeight: '600', fontSize: 14 }}>Played (In XI)</Text>
              <Switch
                value={local.isInXI}
                onValueChange={set('isInXI')}
                trackColor={{ true: '#dc2626', false: '#d1d5db' }}
              />
            </View>

            {local.isInXI && (
              <>
                {/* Batting */}
                <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#f3f4f6', gap: 10 }}>
                  <Text style={{ color: '#374151', fontWeight: '700', fontSize: 13, marginBottom: 2 }}>Batting</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <NumInput label="Runs" value={local.runs} onChange={set('runs')} />
                    <NumInput label="Balls" value={local.ballsFaced} onChange={set('ballsFaced')} />
                    <NumInput label="4s" value={local.fours} onChange={set('fours')} />
                    <NumInput label="6s" value={local.sixes} onChange={set('sixes')} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#374151', fontSize: 13 }}>Out</Text>
                    <Switch
                      value={local.isOut}
                      onValueChange={set('isOut')}
                      trackColor={{ true: '#dc2626', false: '#d1d5db' }}
                    />
                  </View>
                  {local.isOut && (
                    <TextInput
                      value={local.dismissalText}
                      onChangeText={set('dismissalText')}
                      placeholder="Dismissal (e.g. c Smith b Lee)"
                      placeholderTextColor="#9ca3af"
                      style={{
                        backgroundColor: '#f9fafb', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb',
                        paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#111827',
                      }}
                    />
                  )}
                </View>

                {/* Bowling */}
                <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#f3f4f6', gap: 10 }}>
                  <Text style={{ color: '#374151', fontWeight: '700', fontSize: 13, marginBottom: 2 }}>Bowling</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <NumInput label="Balls" value={local.ballsBowled} onChange={set('ballsBowled')} />
                    <NumInput label="Runs" value={local.runsConceded} onChange={set('runsConceded')} />
                    <NumInput label="Wkts" value={local.wickets} onChange={set('wickets')} />
                    <NumInput label="Maidens" value={local.maidens} onChange={set('maidens')} />
                    <NumInput label="LBW/Bld" value={local.lbwBowledWickets} onChange={set('lbwBowledWickets')} />
                  </View>
                </View>

                {/* Fielding */}
                <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#f3f4f6', gap: 10 }}>
                  <Text style={{ color: '#374151', fontWeight: '700', fontSize: 13, marginBottom: 2 }}>Fielding</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <NumInput label="Catches" value={local.catches} onChange={set('catches')} />
                    <NumInput label="Stumpings" value={local.stumpings} onChange={set('stumpings')} />
                    <NumInput label="RO Direct" value={local.runOutsDirect} onChange={set('runOutsDirect')} />
                    <NumInput label="RO Indirect" value={local.runOutsIndirect} onChange={set('runOutsIndirect')} />
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Match Detail Modal ───────────────────────────────────────────────────────

interface MatchDetailProps {
  matchId: string | null
  onClose: () => void
}

function MatchDetailModal({ matchId, onClose }: MatchDetailProps) {
  const { data: detail, isLoading } = useAdminMatchDetail(matchId)
  const patchMatch = useAdminPatchMatch()
  const saveStats = useAdminSaveStats()
  const importScorecard = useAdminImportScorecard()
  const clearStats = useAdminClearStats()

  const [activeTab, setActiveTab] = useState<'status' | 'stats'>('status')
  const [scorecardUrl, setScorecardUrl] = useState('')
  const [statsMap, setStatsMap] = useState<Record<string, PlayerStatForm>>({})
  const [editingPlayer, setEditingPlayer] = useState<AdminPlayer | null>(null)

  // Initialise statsMap whenever the match detail loads
  useEffect(() => {
    if (!detail) return
    const map: Record<string, PlayerStatForm> = {}
    const allPlayers = [...detail.homePlayers, ...detail.awayPlayers]
    for (const p of allPlayers) {
      map[p.id] = detail.stats[p.id] ? dbToForm(detail.stats[p.id]) : emptyForm()
    }
    setStatsMap(map)
    if (detail.match.scorecard_url) setScorecardUrl(detail.match.scorecard_url)
  }, [detail?.match.id])

  if (!matchId) return null

  const match = detail?.match
  const allPlayers = detail ? [...detail.homePlayers, ...detail.awayPlayers] : []

  const handleStatusChange = async (status: AdminMatch['status']) => {
    if (!matchId) return
    patchMatch.mutate({ matchId, data: { status } }, {
      onError: (e) => Alert.alert('Error', (e as Error).message),
    })
  }

  const handleImport = async () => {
    if (!matchId || !scorecardUrl.trim()) return
    importScorecard.mutate({ matchId, url: scorecardUrl.trim() }, {
      onSuccess: (res) => {
        // Merge imported stats into local map
        setStatsMap(prev => {
          const next = { ...prev }
          for (const s of res.matched) {
            next[s.playerId] = {
              isInXI: s.isInXI,
              runs: String(s.runs), ballsFaced: String(s.ballsFaced),
              fours: String(s.fours), sixes: String(s.sixes), isOut: s.isOut,
              wickets: String(s.wickets), ballsBowled: String(s.ballsBowled),
              runsConceded: String(s.runsConceded), maidens: String(s.maidens),
              lbwBowledWickets: String(s.lbwBowledWickets),
              catches: String(s.catches), stumpings: String(s.stumpings),
              runOutsDirect: String(s.runOutsDirect), runOutsIndirect: String(s.runOutsIndirect),
              dismissalText: s.dismissalText,
            }
          }
          return next
        })
        const unmatched = res.unmatched?.length ?? 0
        Alert.alert(
          'Import Complete',
          `Matched ${res.matched.length} players.${unmatched > 0 ? ` ${unmatched} unmatched: ${res.unmatched.join(', ')}` : ''}\n\nReview stats below and tap Save.`
        )
        setActiveTab('stats')
      },
      onError: (e) => Alert.alert('Import Failed', (e as Error).message),
    })
  }

  const handleSaveStats = () => {
    if (!matchId) return
    const playerStats = Object.entries(statsMap)
      .filter(([, f]) => f.isInXI || Object.values(f).some(v => typeof v === 'string' && parseInt(v) > 0))
      .map(([playerId, f]) => formToPayload(playerId, f))

    if (playerStats.length === 0) {
      Alert.alert('No stats', 'Mark at least one player as In XI before saving.')
      return
    }

    saveStats.mutate({ matchId, playerStats }, {
      onSuccess: (res) => Alert.alert('Saved', `Saved stats for ${res.saved} players.`),
      onError: (e) => Alert.alert('Error', (e as Error).message),
    })
  }

  const handleClearStats = () => {
    Alert.alert('Clear Stats', 'Delete all stats for this match?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: () => clearStats.mutate(matchId, {
          onSuccess: () => Alert.alert('Done', 'Stats cleared.'),
          onError: (e) => Alert.alert('Error', (e as Error).message),
        }),
      },
    ])
  }

  const STATUS_OPTS: Array<{ value: AdminMatch['status']; label: string; color: string; bg: string }> = [
    { value: 'pending',   label: 'Pending',   color: '#6b7280', bg: '#f3f4f6' },
    { value: 'upcoming',  label: 'Next',      color: '#1d4ed8', bg: '#dbeafe' },
    { value: 'live',      label: '● Live',    color: '#b45309', bg: '#fef9c3' },
    { value: 'completed', label: '✓ Done',    color: '#15803d', bg: '#f0fdf4' },
  ]

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        {/* Header */}
        <View style={{
          backgroundColor: 'white', padding: 16, paddingTop: 20,
          borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              {isLoading ? (
                <ActivityIndicator color="#dc2626" />
              ) : (
                <>
                  <Text style={{ color: '#111827', fontWeight: '800', fontSize: 17 }}>
                    {match?.home_team} vs {match?.away_team}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'center' }}>
                    {match?.match_number != null && (
                      <Text style={{ color: '#9ca3af', fontSize: 12 }}>M{match.match_number}</Text>
                    )}
                    <Text style={{ color: '#9ca3af', fontSize: 12 }}>{match?.match_date}</Text>
                    {match?.venue && <Text style={{ color: '#9ca3af', fontSize: 12 }} numberOfLines={1}>{match.venue}</Text>}
                  </View>
                </>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={{ paddingLeft: 16 }}>
              <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 15 }}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={{ flexDirection: 'row', gap: 0, marginTop: 14 }}>
            {(['status', 'stats'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={{
                  flex: 1, paddingVertical: 8, alignItems: 'center',
                  borderBottomWidth: 2,
                  borderBottomColor: activeTab === tab ? '#dc2626' : 'transparent',
                }}
              >
                <Text style={{
                  fontSize: 13, fontWeight: '700',
                  color: activeTab === tab ? '#dc2626' : '#9ca3af',
                  textTransform: 'capitalize',
                }}>{tab === 'status' ? 'Match' : 'Player Stats'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Match tab */}
        {activeTab === 'status' && (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            {/* Status selector */}
            <View style={{ backgroundColor: 'white', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f3f4f6', gap: 10 }}>
              <Text style={{ color: '#374151', fontWeight: '700', fontSize: 13 }}>Match Status</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {STATUS_OPTS.map(opt => {
                  const active = match?.status === opt.value
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => handleStatusChange(opt.value)}
                      disabled={patchMatch.isPending}
                      style={{
                        flex: 1, minWidth: 80, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                        backgroundColor: active ? opt.bg : 'white',
                        borderWidth: 1.5, borderColor: active ? opt.color : '#e5e7eb',
                      }}
                    >
                      <Text style={{ color: active ? opt.color : '#6b7280', fontWeight: '700', fontSize: 13 }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              {patchMatch.isPending && <ActivityIndicator color="#dc2626" />}
            </View>

            {/* Scorecard import */}
            <View style={{ backgroundColor: 'white', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f3f4f6', gap: 10 }}>
              <Text style={{ color: '#374151', fontWeight: '700', fontSize: 13 }}>Import Scorecard</Text>
              <Text style={{ color: '#9ca3af', fontSize: 12 }}>Paste an ESPNcricinfo scorecard URL. Stats are parsed by AI and loaded into the Stats tab for review.</Text>
              <TextInput
                value={scorecardUrl}
                onChangeText={setScorecardUrl}
                placeholder="https://www.espncricinfo.com/series/..."
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                keyboardType="url"
                style={{
                  backgroundColor: '#f9fafb', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb',
                  paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#111827',
                }}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => {
                    if (!matchId || !scorecardUrl.trim()) return
                    patchMatch.mutate({ matchId, data: { scorecardUrl: scorecardUrl.trim() } }, {
                      onSuccess: () => Alert.alert('Saved', 'Scorecard URL saved.'),
                      onError: (e) => Alert.alert('Error', (e as Error).message),
                    })
                  }}
                  disabled={patchMatch.isPending || !scorecardUrl.trim()}
                  style={{
                    flex: 1, backgroundColor: scorecardUrl.trim() ? '#f9fafb' : '#f3f4f6',
                    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
                    borderWidth: 1, borderColor: scorecardUrl.trim() ? '#e5e7eb' : '#f3f4f6',
                  }}
                >
                  {patchMatch.isPending
                    ? <ActivityIndicator color="#111827" />
                    : <Text style={{ color: scorecardUrl.trim() ? '#111827' : '#9ca3af', fontWeight: '700' }}>Save URL</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleImport}
                  disabled={importScorecard.isPending || !scorecardUrl.trim()}
                  style={{
                    flex: 2, backgroundColor: scorecardUrl.trim() ? '#111827' : '#e5e7eb',
                    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
                  }}
                >
                  {importScorecard.isPending ? (
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <ActivityIndicator color="white" />
                      <Text style={{ color: 'white', fontWeight: '700' }}>Importing…</Text>
                    </View>
                  ) : (
                    <Text style={{ color: scorecardUrl.trim() ? 'white' : '#9ca3af', fontWeight: '700' }}>Import Scorecard</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Clear stats */}
            {match?.is_completed && (
              <TouchableOpacity
                onPress={handleClearStats}
                style={{ borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
              >
                <Text style={{ color: '#dc2626', fontWeight: '700' }}>Clear All Stats</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        {/* Stats tab */}
        {activeTab === 'stats' && (
          <View style={{ flex: 1 }}>
            {isLoading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="#dc2626" />
              </View>
            ) : (
              <>
                <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}>
                  {(['home', 'away'] as const).map(side => {
                    const players = side === 'home' ? detail!.homePlayers : detail!.awayPlayers
                    const teamName = side === 'home' ? match?.home_team : match?.away_team
                    return (
                      <View key={side}>
                        <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>
                          {teamName}
                        </Text>
                        <View style={{ backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}>
                          {players.map((p, idx) => {
                            const f = statsMap[p.id] ?? emptyForm()
                            const roleColor = ROLE_COLORS[p.role] ?? '#6b7280'
                            return (
                              <TouchableOpacity
                                key={p.id}
                                onPress={() => setEditingPlayer(p)}
                                activeOpacity={0.7}
                                style={{
                                  flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12,
                                  borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: '#f9fafb',
                                  backgroundColor: f.isInXI ? 'white' : '#fafafa',
                                }}
                              >
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: f.isInXI ? '#16a34a' : '#d1d5db', marginRight: 10 }} />
                                <View style={{ flex: 1 }}>
                                  <Text style={{ color: '#111827', fontWeight: '600', fontSize: 13 }}>{p.name}</Text>
                                  <Text style={{ color: '#9ca3af', fontSize: 11, marginTop: 1 }}>{statSummary(f)}</Text>
                                </View>
                                <View style={{ backgroundColor: roleColor + '18', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, marginRight: 8 }}>
                                  <Text style={{ color: roleColor, fontSize: 10, fontWeight: '700' }}>{ROLE_SHORT[p.role] ?? p.role}</Text>
                                </View>
                                <Text style={{ color: '#9ca3af', fontSize: 13 }}>›</Text>
                              </TouchableOpacity>
                            )
                          })}
                        </View>
                      </View>
                    )
                  })}
                </ScrollView>

                {/* Save button */}
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#f9fafb', borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
                  <TouchableOpacity
                    onPress={handleSaveStats}
                    disabled={saveStats.isPending}
                    style={{ backgroundColor: '#dc2626', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                  >
                    {saveStats.isPending
                      ? <ActivityIndicator color="white" />
                      : <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>Save All Stats</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}

        {/* Player editor */}
        {editingPlayer && (
          <PlayerStatsEditorModal
            player={editingPlayer}
            form={statsMap[editingPlayer.id] ?? emptyForm()}
            onChange={(f) => setStatsMap(prev => ({ ...prev, [editingPlayer.id]: f }))}
            onClose={() => setEditingPlayer(null)}
          />
        )}
      </View>
    </Modal>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { label: 'All', value: null },
  { label: 'Live', value: 'live' },
  { label: 'Next', value: 'upcoming' },
  { label: 'Pending', value: 'pending' },
  { label: 'Done', value: 'completed' },
] as const

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'PENDING',   color: '#6b7280', bg: '#f3f4f6' },
  upcoming:  { label: 'NEXT',      color: '#1d4ed8', bg: '#dbeafe' },
  live:      { label: 'LIVE',      color: '#b45309', bg: '#fef9c3' },
  completed: { label: 'FINAL',     color: '#15803d', bg: '#f0fdf4' },
}

export default function SuperAdminScreen() {
  const { data: matches, isLoading, refetch, isRefetching } = useAdminMatches()
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)

  const filtered = (matches ?? []).filter(m => !statusFilter || m.status === statusFilter)

  const chipStyle = (active: boolean) => ({
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: active ? '#111827' : 'white',
    borderWidth: 1, borderColor: active ? '#111827' : '#e5e7eb',
    marginRight: 7,
  })

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <Stack.Screen options={{ title: 'Super Admin', headerShown: true }} />
      <FlatList
        data={filtered}
        keyExtractor={m => m.id}
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: '#111827', fontWeight: '800', fontSize: 20, marginBottom: 12 }}>Matches</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row' }}>
                {STATUS_FILTERS.map(f => (
                  <TouchableOpacity key={String(f.value)} onPress={() => setStatusFilter(f.value)} style={chipStyle(statusFilter === f.value)}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: statusFilter === f.value ? 'white' : '#374151' }}>{f.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingTop: 60, alignItems: 'center' }}>
              <ActivityIndicator color="#dc2626" />
            </View>
          ) : (
            <View style={{ paddingTop: 60, alignItems: 'center' }}>
              <Text style={{ color: '#9ca3af', fontSize: 14 }}>No matches found</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.pending
          return (
            <TouchableOpacity
              onPress={() => setSelectedMatchId(item.id)}
              activeOpacity={0.7}
              style={{
                backgroundColor: 'white', borderRadius: 14, borderWidth: 1,
                borderColor: item.status === 'live' ? '#fde68a' : item.status === 'upcoming' ? '#bfdbfe' : '#f3f4f6',
                padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#111827', fontWeight: '700', fontSize: 14 }}>
                  {item.home_team} vs {item.away_team}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'center' }}>
                  {item.match_number != null && (
                    <Text style={{ color: '#d1d5db', fontSize: 11 }}>M{item.match_number}</Text>
                  )}
                  <Text style={{ color: '#9ca3af', fontSize: 12 }}>{item.match_date}</Text>
                  {item.week_num != null && (
                    <Text style={{ color: '#9ca3af', fontSize: 12 }}>Week {item.week_num}</Text>
                  )}
                </View>
              </View>
              <View style={{ backgroundColor: badge.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: badge.color, fontSize: 11, fontWeight: '700' }}>{badge.label}</Text>
              </View>
            </TouchableOpacity>
          )
        }}
      />

      <MatchDetailModal
        matchId={selectedMatchId}
        onClose={() => setSelectedMatchId(null)}
      />
    </View>
  )
}
