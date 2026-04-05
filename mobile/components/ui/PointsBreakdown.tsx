import { useState } from 'react'
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, type TextStyle } from 'react-native'

export interface BreakdownStats {
  runsScored: number
  ballsFaced: number
  fours: number
  sixes: number
  isOut: boolean
  wicketsTaken: number
  ballsBowled: number
  runsConceded: number
  maidens: number
  lbwBowledWickets?: number
  catches: number
  stumpings: number
  runOutsDirect: number
  runOutsIndirect: number
  playerRole?: string
  /** Whether the player was in the playing XI (defaults true if absent) */
  isInXI?: boolean
}

interface BreakdownItem {
  label: string
  detail: string
  pts: number
  section: 'General' | 'Batting' | 'Bowling' | 'Fielding'
}

export function calcBreakdown(s: BreakdownStats): BreakdownItem[] {
  const items: BreakdownItem[] = []
  const role = s.playerRole ?? 'batsman'
  const hasBatting = s.runsScored > 0 || s.ballsFaced > 0 || s.isOut
  const hasBowling = s.ballsBowled > 0 || s.wicketsTaken > 0

  // ── GENERAL ──────────────────────────────────────────────────────────────
  if (s.isInXI !== false) {
    items.push({ section: 'General', label: 'Playing XI', detail: 'in the starting lineup', pts: 4 })
  }

  // ── BATTING ──────────────────────────────────────────────────────────────
  if (hasBatting) {
    if (s.runsScored > 0) {
      items.push({ section: 'Batting', label: 'Runs', detail: `${s.runsScored} × 1`, pts: s.runsScored })
    }
    if (s.fours > 0) {
      items.push({ section: 'Batting', label: '4s bonus', detail: `${s.fours} × 1`, pts: s.fours })
    }
    if (s.sixes > 0) {
      items.push({ section: 'Batting', label: '6s bonus', detail: `${s.sixes} × 2`, pts: s.sixes * 2 })
    }
    // Milestone (mutually exclusive — highest wins)
    if (s.runsScored >= 100) {
      items.push({ section: 'Batting', label: 'Century bonus', detail: '100+ runs', pts: 16 })
    } else if (s.runsScored >= 50) {
      items.push({ section: 'Batting', label: 'Half-century bonus', detail: '50+ runs', pts: 8 })
    } else if (s.runsScored >= 30) {
      items.push({ section: 'Batting', label: '30+ bonus', detail: '30–49 runs', pts: 4 })
    }
    // Duck
    if (s.isOut && s.runsScored === 0) {
      items.push({ section: 'Batting', label: 'Duck', detail: 'dismissed for 0', pts: -2 })
    }
    // Strike rate (batsman / WK / AR only; threshold: 10 balls or 20 runs)
    if (role !== 'bowler' && (s.ballsFaced >= 10 || s.runsScored >= 20)) {
      const sr = s.ballsFaced > 0 ? (s.runsScored / s.ballsFaced) * 100 : 0
      let srPts = 0
      let srRange = ''
      if (sr < 50)       { srPts = -6; srRange = '< 50' }
      else if (sr < 60)  { srPts = -4; srRange = '50–59' }
      else if (sr < 70)  { srPts = -2; srRange = '60–69' }
      else if (sr < 130) { srPts =  0 }
      else if (sr < 150) { srPts =  2; srRange = '130–149' }
      else if (sr < 170) { srPts =  4; srRange = '150–169' }
      else               { srPts =  6; srRange = '170+' }
      if (srPts !== 0) {
        items.push({ section: 'Batting', label: 'Strike rate', detail: `${sr.toFixed(0)} (range ${srRange})`, pts: srPts })
      }
    }
  }

  // ── BOWLING ──────────────────────────────────────────────────────────────
  if (hasBowling) {
    if (s.wicketsTaken > 0) {
      items.push({ section: 'Bowling', label: 'Wickets', detail: `${s.wicketsTaken} × 25`, pts: s.wicketsTaken * 25 })
    }
    const lbwBowled = s.lbwBowledWickets ?? 0
    if (lbwBowled > 0) {
      items.push({ section: 'Bowling', label: 'LBW / Bowled bonus', detail: `${lbwBowled} × 8`, pts: lbwBowled * 8 })
    }
    // Wicket haul (mutually exclusive)
    if (s.wicketsTaken >= 5) {
      items.push({ section: 'Bowling', label: '5-wicket haul', detail: '5+ wickets', pts: 16 })
    } else if (s.wicketsTaken >= 4) {
      items.push({ section: 'Bowling', label: '4-wicket haul', detail: '4 wickets', pts: 8 })
    } else if (s.wicketsTaken >= 3) {
      items.push({ section: 'Bowling', label: '3-wicket haul', detail: '3 wickets', pts: 4 })
    }
    if (s.maidens > 0) {
      items.push({ section: 'Bowling', label: 'Maidens', detail: `${s.maidens} × 12`, pts: s.maidens * 12 })
    }
    // Economy (min 2 overs = 12 balls)
    if (s.ballsBowled >= 12) {
      const eco = (s.runsConceded / s.ballsBowled) * 6
      let ecoPts = 0
      let ecoRange = ''
      if (eco < 5)       { ecoPts =  6; ecoRange = '< 5.00' }
      else if (eco < 6)  { ecoPts =  4; ecoRange = '5.00–5.99' }
      else if (eco < 7)  { ecoPts =  2; ecoRange = '6.00–6.99' }
      else if (eco < 10) { ecoPts =  0 }
      else if (eco < 11) { ecoPts = -2; ecoRange = '10.00–10.99' }
      else if (eco < 12) { ecoPts = -4; ecoRange = '11.00–11.99' }
      else               { ecoPts = -6; ecoRange = '12.00+' }
      if (ecoPts !== 0) {
        items.push({ section: 'Bowling', label: 'Economy rate', detail: `${eco.toFixed(2)} (${ecoRange})`, pts: ecoPts })
      }
    }
  }

  // ── FIELDING ─────────────────────────────────────────────────────────────
  if (s.catches > 0) {
    items.push({ section: 'Fielding', label: 'Catches', detail: `${s.catches} × 8`, pts: s.catches * 8 })
    if (s.catches >= 3) {
      items.push({ section: 'Fielding', label: '3-catch bonus', detail: '3+ catches', pts: 4 })
    }
  }
  if (s.stumpings > 0) {
    items.push({ section: 'Fielding', label: 'Stumpings', detail: `${s.stumpings} × 12`, pts: s.stumpings * 12 })
  }
  if (s.runOutsDirect > 0) {
    items.push({ section: 'Fielding', label: 'Direct run-outs', detail: `${s.runOutsDirect} × 12`, pts: s.runOutsDirect * 12 })
  }
  if (s.runOutsIndirect > 0) {
    items.push({ section: 'Fielding', label: 'Indirect run-outs', detail: `${s.runOutsIndirect} × 6`, pts: s.runOutsIndirect * 6 })
  }

  return items
}

// ── Modal ────────────────────────────────────────────────────────────────────

const SECTIONS = ['General', 'Batting', 'Bowling', 'Fielding'] as const

interface ModalProps {
  visible: boolean
  onClose: () => void
  stats: BreakdownStats
  total: number
  playerName?: string
}

export function PointsBreakdownModal({ visible, onClose, stats, total, playerName }: ModalProps) {
  const items = calcBreakdown(stats)
  const sections = SECTIONS.filter(sec => items.some(i => i.section === sec))
  const hasAny = items.length > 0

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={s.sheet}>
        {/* Handle */}
        <View style={s.handle} />

        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Points Breakdown</Text>
            {playerName ? <Text style={s.subtitle}>{playerName}</Text> : null}
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.closeBtn}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          {!hasAny ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <Text style={{ color: '#9ca3af', fontSize: 14 }}>No stats recorded for this match</Text>
            </View>
          ) : (
            sections.map(sec => {
              const secItems = items.filter(i => i.section === sec)
              return (
                <View key={sec} style={{ marginBottom: 16 }}>
                  <Text style={s.sectionLabel}>{sec.toUpperCase()}</Text>
                  {secItems.map((item, idx) => (
                    <View key={idx} style={s.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowLabel}>{item.label}</Text>
                        <Text style={s.rowDetail}>{item.detail}</Text>
                      </View>
                      <Text style={[s.rowPts, item.pts > 0 ? s.positive : item.pts < 0 ? s.negative : s.neutral]}>
                        {item.pts > 0 ? `+${item.pts}` : item.pts}
                      </Text>
                    </View>
                  ))}
                </View>
              )
            })
          )}

          {/* Total */}
          {hasAny && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Total</Text>
              <Text style={[s.totalPts, total > 0 ? s.positive : s.neutral]}>
                {total > 0 ? `+${total.toFixed(1)}` : total.toFixed(1)}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}

// ── PointsValue ──────────────────────────────────────────────────────────────
// Drop-in replacement for a points <Text>. Long-press opens the breakdown modal.

interface PointsValueProps {
  value: number
  stats: BreakdownStats
  style?: TextStyle
  /** Override how the value is rendered. Defaults to value.toFixed(1) (or '—' if 0) */
  children?: string
  playerName?: string
}

export function PointsValue({ value, stats, style, children, playerName }: PointsValueProps) {
  const [open, setOpen] = useState(false)
  const hasStats = value > 0 || stats.runsScored > 0 || stats.ballsFaced > 0 || stats.wicketsTaken > 0 ||
    stats.ballsBowled > 0 || stats.catches > 0 || stats.stumpings > 0 ||
    stats.runOutsDirect > 0 || stats.runOutsIndirect > 0

  const label = children ?? (value > 0 ? value.toFixed(1) : '—')

  return (
    <>
      <TouchableOpacity
        onPress={hasStats ? () => setOpen(true) : undefined}
        activeOpacity={hasStats ? 0.6 : 1}
      >
        <Text style={style}>{label}</Text>
      </TouchableOpacity>
      {hasStats && (
        <PointsBreakdownModal
          visible={open}
          onClose={() => setOpen(false)}
          stats={stats}
          total={value}
          playerName={playerName}
        />
      )}
    </>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    marginBottom: 16,
  },
  title: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
  },
  sectionLabel: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  rowLabel: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  rowDetail: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 1,
  },
  rowPts: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  positive: { color: '#16a34a' },
  negative: { color: '#dc2626' },
  neutral:  { color: '#9ca3af' },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 2,
    borderTopColor: '#f3f4f6',
    marginTop: 4,
  },
  totalLabel: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  totalPts: {
    fontSize: 18,
    fontWeight: '800',
  },
})
