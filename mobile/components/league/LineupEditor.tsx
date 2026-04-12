import { useState, useEffect, useMemo } from 'react'
import { View, Text, TouchableOpacity, Modal, FlatList } from 'react-native'
import { NavButton } from '../ui/NavButton'
import { useMyTeam } from '../../hooks/useTeam'
import { useSetLineup } from '../../hooks/useLineup'
import type { LineupEntry } from '../../hooks/useLineup'
import type { RosterEntry } from '../../hooks/useTeam'

const SLOT_COUNTS = { batsman: 3, wicket_keeper: 1, all_rounder: 1, bowler: 3, flex: 3 } as const
const ROLE_LABELS: Record<string, string> = {
  batsman: 'Batsmen', wicket_keeper: 'Wicket Keeper',
  all_rounder: 'All-Rounders', bowler: 'Bowlers', flex: 'Flex (Any)',
}
const ROLE_SHORT: Record<string, string> = {
  batsman: 'BAT', wicket_keeper: 'WK', all_rounder: 'AR', bowler: 'BOW', flex: 'FLEX',
}
const ROLE_ORDER = ['batsman', 'wicket_keeper', 'all_rounder', 'bowler', 'flex'] as const
type SlotRole = typeof ROLE_ORDER[number]

interface Slot {
  role: SlotRole
  index: number  // 0-based within role
  player: RosterEntry | null
}

function buildSlots(lineup: LineupEntry[], roster: RosterEntry[]): Slot[] {
  const rosterMap = new Map(roster.map(r => [r.player_id, r]))
  const byRole: Record<string, LineupEntry[]> = { batsman: [], wicket_keeper: [], all_rounder: [], bowler: [], flex: [] }
  for (const e of lineup) {
    if (e.slot_role in byRole) byRole[e.slot_role].push(e)
  }

  const slots: Slot[] = []
  for (const role of ROLE_ORDER) {
    for (let i = 0; i < SLOT_COUNTS[role]; i++) {
      const entry = byRole[role][i]
      slots.push({ role, index: i, player: entry ? (rosterMap.get(entry.player_id) ?? null) : null })
    }
  }
  return slots
}

function globalIdx(role: SlotRole, subIdx: number): number {
  let idx = 0
  for (const r of ROLE_ORDER) {
    if (r === role) return idx + subIdx
    idx += SLOT_COUNTS[r]
  }
  return -1
}

// Stable empty arrays — prevents new references on every parent render
const EMPTY_LINEUP: LineupEntry[] = []
const EMPTY_ROSTER: RosterEntry[] = []

interface Props {
  leagueId: string
  weekNum: number
  locked: boolean
  lineup: LineupEntry[]
}

export function LineupEditor({ leagueId, weekNum, locked, lineup }: Props) {
  const teamData = useMyTeam(leagueId)
  const roster = teamData.data ?? EMPTY_ROSTER
  const { mutate: saveLineup, isPending: isSaving } = useSetLineup(leagueId)

  const [slots, setSlots] = useState<Slot[]>(() => buildSlots(lineup, roster))
  const [hasEdited, setHasEdited] = useState(false)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Re-init from server data when lineup/roster loads, but not after user edits.
  // Depend on stable keys derived from content — not array references — to avoid
  // infinite re-renders when the parent passes a new [] reference each render.
  const lineupKey = lineup.map(e => `${e.player_id}:${e.slot_role}`).join(',')
  const rosterKey = roster.map(r => r.player_id).join(',')
  useEffect(() => {
    if (!hasEdited) {
      setSlots(buildSlots(lineup, roster))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineupKey, rosterKey, hasEdited])

  const assignedIds = useMemo(
    () => new Set(slots.filter(s => s.player).map(s => s.player!.player_id)),
    [slots]
  )

  const allFilled = slots.length === 11 && slots.every(s => s.player !== null)
  const filledCount = slots.filter(s => s.player).length

  const activeSlot = activeIdx !== null ? slots[activeIdx] : null
  // Flex slots can take any player role
  const eligiblePlayers = activeSlot
    ? (activeSlot.role === 'flex' ? roster : roster.filter(r => r.player_role === activeSlot.role))
    : []

  const handleSlotPress = (idx: number) => {
    if (locked) return
    setActiveIdx(idx)
  }

  const selectPlayer = (player: RosterEntry) => {
    if (activeIdx === null) return
    setSlots(prev => {
      const next = [...prev]
      // Move player out of any other slot they're in
      const existingIdx = next.findIndex(s => s.player?.player_id === player.player_id)
      if (existingIdx !== -1 && existingIdx !== activeIdx) {
        next[existingIdx] = { ...next[existingIdx], player: null }
      }
      next[activeIdx] = { ...next[activeIdx], player }
      return next
    })
    setHasEdited(true)
    setSaved(false)
    setSaveError(null)
    setActiveIdx(null)
  }

  const clearSlot = (idx: number) => {
    setSlots(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], player: null }
      return next
    })
    setHasEdited(true)
    setSaved(false)
  }

  const save = () => {
    setSaveError(null)
    const entries = slots.map(s => ({
      playerId: s.player!.player_id,
      slotRole: s.role,
    }))
    saveLineup(
      { weekNum, entries },
      {
        onSuccess: () => {
          setSaved(true)
          setHasEdited(false)
        },
        onError: (e: any) => {
          const msg = e?.message ?? 'Failed to save lineup'
          setSaveError(msg)
        },
      }
    )
  }

  return (
    <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#1f2937', paddingHorizontal: 16, paddingVertical: 10,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>
          {locked ? 'Your Lineup (Locked)' : 'Set Your Lineup'}
        </Text>
        {!locked && (
          <Text style={{ color: '#9ca3af', fontSize: 11 }}>Tap a slot to pick</Text>
        )}
      </View>

      {/* Slot rows grouped by role */}
      {ROLE_ORDER.map(role => (
        <View key={role}>
          <View style={{ backgroundColor: '#f9fafb', paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
            <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {ROLE_LABELS[role]}
            </Text>
          </View>
          {Array.from({ length: SLOT_COUNTS[role] }, (_, i) => {
            const idx = globalIdx(role, i)
            const slot = slots[idx]
            if (!slot) return null
            const isActive = activeIdx === idx

            return (
              <TouchableOpacity
                key={i}
                disabled={locked}
                onPress={() => handleSlotPress(idx)}
                onLongPress={() => !locked && slot.player && clearSlot(idx)}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 12, paddingVertical: 11,
                  borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#f9fafb',
                  backgroundColor: isActive ? '#fef2f2' : 'white',
                }}
              >
                <View style={{
                  width: 30, height: 30, borderRadius: 15,
                  backgroundColor: slot.player ? '#dc2626' : '#f3f4f6',
                  alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0,
                }}>
                  <Text style={{ color: slot.player ? 'white' : '#9ca3af', fontSize: 9, fontWeight: '700' }}>
                    {ROLE_SHORT[role]}
                  </Text>
                </View>

                {slot.player ? (
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#111827', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                      {slot.player.player_name}
                    </Text>
                    <Text style={{ color: '#9ca3af', fontSize: 11 }}>
                      {slot.player.player_ipl_team}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ color: '#9ca3af', fontSize: 13, flex: 1 }}>
                    {locked ? '— Not set' : '— Tap to select'}
                  </Text>
                )}

                {!locked && (
                  <Text style={{ color: '#d1d5db', fontSize: 18, marginLeft: 4 }}>›</Text>
                )}
              </TouchableOpacity>
            )
          })}
        </View>
      ))}

      {/* Save button (only shown when not locked) */}
      {!locked && (
        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
          {saveError && (
            <Text style={{ color: '#dc2626', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>
              {saveError}
            </Text>
          )}
          {saved && !hasEdited && (
            <Text style={{ color: '#16a34a', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>
              Lineup saved!
            </Text>
          )}
          <TouchableOpacity
            onPress={save}
            disabled={!allFilled || isSaving}
            style={{
              backgroundColor: allFilled && !isSaving ? '#dc2626' : '#f3f4f6',
              borderRadius: 10, paddingVertical: 12, alignItems: 'center',
            }}
          >
            <Text style={{ color: allFilled && !isSaving ? 'white' : '#9ca3af', fontWeight: '700', fontSize: 14 }}>
              {isSaving ? 'Saving…' : allFilled ? 'Save Lineup' : `${filledCount}/11 players selected`}
            </Text>
          </TouchableOpacity>
          {!locked && filledCount > 0 && (
            <Text style={{ color: '#9ca3af', fontSize: 11, textAlign: 'center', marginTop: 6 }}>
              Long-press a slot to clear it
            </Text>
          )}
        </View>
      )}

      {/* Player picker modal */}
      <Modal
        visible={activeIdx !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveIdx(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'white' }}>
          {/* Modal header */}
          <View style={{
            paddingHorizontal: 16, paddingVertical: 14,
            borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
            flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
          }}>
            <NavButton label="Cancel" onPress={() => setActiveIdx(null)} />
          </View>

          <FlatList
            data={eligiblePlayers}
            keyExtractor={p => p.player_id}
            ListHeaderComponent={
              <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 }}>
                <Text style={{ fontWeight: '800', fontSize: 22, color: '#111827' }}>
                  Select {activeSlot ? ROLE_LABELS[activeSlot.role].replace(/s$/, '') : ''}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isSelected = activeSlot?.player?.player_id === item.player_id
              const isUsedElsewhere = !isSelected && assignedIds.has(item.player_id)
              return (
                <TouchableOpacity
                  onPress={() => selectPlayer(item)}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 14,
                    borderBottomWidth: 1, borderBottomColor: '#f9fafb',
                    backgroundColor: isSelected ? '#fef2f2' : 'white',
                    opacity: isUsedElsewhere ? 0.45 : 1,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#111827', fontWeight: '600', fontSize: 15 }}>
                      {item.player_name}
                    </Text>
                    <Text style={{ color: '#9ca3af', fontSize: 13 }}>
                      {item.player_ipl_team}
                      {isUsedElsewhere ? ' · Already in lineup' : ''}
                    </Text>
                  </View>
                  {isSelected && (
                    <Text style={{ color: '#dc2626', fontSize: 18, marginLeft: 8 }}>✓</Text>
                  )}
                </TouchableOpacity>
              )
            }}
            ListEmptyComponent={
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ color: '#9ca3af', fontSize: 15 }}>
                  No {activeSlot ? ROLE_LABELS[activeSlot.role].toLowerCase() : 'players'} on your roster
                </Text>
              </View>
            }
          />
        </View>
      </Modal>
    </View>
  )
}
