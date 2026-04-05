import { useEffect, useState, useCallback } from 'react'
import { api } from './api'
import type { IplMatch, IplWeek } from './types'

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid #d1d5db', fontSize: 14, background: 'white', boxSizing: 'border-box',
}
const btn = (bg: string, color = 'white'): React.CSSProperties => ({
  padding: '9px 18px', background: bg, color, border: `1px solid ${bg === 'white' ? '#d1d5db' : bg}`,
  borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13,
})

const PACIFIC_TZ = 'America/Los_Angeles'

/** Derive week status purely from start/end dates vs today (YYYY-MM-DD comparison). */
function weekStatus(w: IplWeek): 'pending' | 'live' | 'completed' {
  const today = new Date().toISOString().slice(0, 10)
  if (w.end_date < today) return 'completed'
  if (w.start_date <= today) return 'live'
  return 'pending'
}

/** Convert a UTC ISO string from the DB → YYYY-MM-DDTHH:mm in Pacific time for a datetime-local input */
function utcToPacificDatetimeLocal(isoStr: string | null): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PACIFIC_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00'
  const h = get('hour') === '24' ? '00' : get('hour')
  return `${get('year')}-${get('month')}-${get('day')}T${h}:${get('minute')}`
}

/** Convert a YYYY-MM-DDTHH:mm value entered in Pacific time → UTC ISO string.
 *  Handles DST automatically by trying PDT (UTC-7) then PST (UTC-8). */
function pacificToUtcIso(val: string): string {
  if (!val) return ''
  const targetHour = parseInt(val.split('T')[1].split(':')[0], 10)
  for (const offset of ['-07:00', '-08:00']) {
    const candidate = new Date(`${val}:00${offset}`)
    if (isNaN(candidate.getTime())) continue
    const checkHour = parseInt(
      new Intl.DateTimeFormat('en-US', { timeZone: PACIFIC_TZ, hour: '2-digit', hour12: false }).format(candidate),
      10,
    )
    if (checkHour === targetHour) return candidate.toISOString()
  }
  return new Date(`${val}:00-07:00`).toISOString() // fallback
}

interface Props {
  secret: string
  onSelectMatch: (id: string) => void
}

export function WeeksTab({ secret, onSelectMatch }: Props) {
  const [weeks, setWeeks] = useState<IplWeek[]>([])
  const [matches, setMatches] = useState<IplMatch[]>([])
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // Edit state
  const [editLabel, setEditLabel] = useState('')
  const [editWindowStart, setEditWindowStart] = useState('')
  const [editWindowEnd, setEditWindowEnd] = useState('')
  const [editLockTime, setEditLockTime] = useState('')
  const [editWeekType, setEditWeekType] = useState<'regular' | 'playoff' | 'finals'>('regular')
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ assignedCount: number } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsData, matchesData] = await Promise.all([
        api.get('/admin/settings', secret) as Promise<{ weeks: IplWeek[] }>,
        api.get('/admin/matches', secret) as Promise<{ matches: IplMatch[] }>,
      ])
      setWeeks(settingsData.weeks)
      setMatches(matchesData.matches)
      if (settingsData.weeks.length > 0 && selectedWeek === null) {
        setSelectedWeek(settingsData.weeks[0].week_num)
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [secret]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData() }, [fetchData])

  // Populate edit fields when selected week changes
  useEffect(() => {
    const week = weeks.find(w => w.week_num === selectedWeek)
    if (!week) return
    setEditLabel(week.label)
    setEditWindowStart(utcToPacificDatetimeLocal(week.window_start))
    setEditWindowEnd(utcToPacificDatetimeLocal(week.window_end))
    setEditLockTime(utcToPacificDatetimeLocal(week.lock_time))
    setEditWeekType(week.week_type ?? 'regular')
    setSaveResult(null)
  }, [selectedWeek, weeks])

  const handleDeleteWeek = async () => {
    if (selectedWeek == null) return
    if (!confirm(`Delete Week ${selectedWeek}? Any matches assigned to it will become unassigned.`)) return
    try {
      await api.delete(`/admin/weeks/${selectedWeek}`, secret)
      const remaining = weeks.filter(w => w.week_num !== selectedWeek)
      setWeeks(remaining)
      setSelectedWeek(remaining[0]?.week_num ?? null)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete week')
    }
  }

  const handleSaveWeek = async () => {
    if (selectedWeek == null) return
    setSaving(true)
    setSaveResult(null)
    try {
      const payload: Record<string, string> = { label: editLabel, weekType: editWeekType }
      if (editWindowStart) payload.windowStart = pacificToUtcIso(editWindowStart)
      if (editWindowEnd)   payload.windowEnd   = pacificToUtcIso(editWindowEnd)
      if (editLockTime)    payload.lockTime     = pacificToUtcIso(editLockTime)

      const res = await api.patch(`/admin/weeks/${selectedWeek}`, secret, payload) as { week: IplWeek; assignedCount: number }

      setWeeks(prev => prev.map(w => w.week_num === selectedWeek ? res.week : w))
      // Update match list to reflect newly assigned week_nums
      if (res.assignedCount > 0) {
        const refreshed = await api.get('/admin/matches', secret) as { matches: IplMatch[] }
        setMatches(refreshed.matches)
      }
      setSaveResult({ assignedCount: res.assignedCount })
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save week')
    } finally {
      setSaving(false)
    }
  }

  const weekMatches = matches.filter(m => m.week_num === selectedWeek)
  const selectedWeekData = weeks.find(w => w.week_num === selectedWeek)

  if (loading) return <div style={{ padding: 48, color: '#9ca3af' }}>Loading…</div>

  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ margin: '0 0 24px' }}>IPL Weeks</h2>

      <div style={{ display: 'flex', gap: 28 }}>
        {/* Left: Week selector list */}
        <div style={{
          width: 160, flexShrink: 0,
          background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
          overflow: 'hidden', alignSelf: 'flex-start',
        }}>
          {weeks.map(w => (
            <button
              key={w.week_num}
              onClick={() => setSelectedWeek(w.week_num)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '12px 16px', border: 'none', cursor: 'pointer',
                borderBottom: '1px solid #f3f4f6',
                background: w.week_num === selectedWeek ? '#fef2f2' : 'white',
                color: w.week_num === selectedWeek ? '#dc2626' : '#374151',
                fontWeight: w.week_num === selectedWeek ? 700 : 400,
                fontSize: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Week {w.week_num}
                {w.week_type && w.week_type !== 'regular' && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                    background: w.week_type === 'finals' ? '#fef3c7' : '#fee2e2',
                    color: w.week_type === 'finals' ? '#b45309' : '#dc2626',
                    textTransform: 'uppercase',
                  }}>
                    {w.week_type}
                  </span>
                )}
                {weekStatus(w) !== 'pending' && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                    background: weekStatus(w) === 'live' ? '#fee2e2' : '#d1fae5',
                    color: weekStatus(w) === 'live' ? '#dc2626' : '#065f46',
                    textTransform: 'uppercase',
                  }}>
                    {weekStatus(w) === 'live' ? '● Live' : 'Done'}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{w.label}</div>
            </button>
          ))}
        </div>

        {/* Right: Details + match list */}
        {selectedWeekData && (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Edit form */}
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
              <h3 style={{ margin: '0 0 18px', fontSize: 16 }}>Week {selectedWeekData.week_num} Details</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Label">
                  <input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)} style={inp} />
                </Field>

                <Field label="Week Type">
                  <div style={{ display: 'flex', borderRadius: 8, border: '1px solid #d1d5db', overflow: 'hidden' }}>
                    {(['regular', 'playoff', 'finals'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => setEditWeekType(type)}
                        style={{
                          flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', fontSize: 13,
                          fontWeight: 600, textTransform: 'capitalize',
                          background: editWeekType === type
                            ? type === 'regular' ? '#1e1b4b' : type === 'playoff' ? '#dc2626' : '#d97706'
                            : 'white',
                          color: editWeekType === type ? 'white' : '#6b7280',
                          borderRight: type !== 'finals' ? '1px solid #d1d5db' : 'none',
                        }}
                      >
                        {type === 'regular' ? 'Regular' : type === 'playoff' ? 'Playoff' : 'Finals'}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Window Start (Pacific)">
                  <input
                    type="datetime-local" value={editWindowStart}
                    onChange={e => setEditWindowStart(e.target.value)}
                    style={inp}
                  />
                </Field>

                <Field label="Window End (Pacific)">
                  <input
                    type="datetime-local" value={editWindowEnd}
                    onChange={e => setEditWindowEnd(e.target.value)}
                    style={inp}
                  />
                </Field>

                <Field label="Lineup Lock Time (Pacific)" style={{ gridColumn: '1 / -1' }}>
                  <input
                    type="datetime-local" value={editLockTime}
                    onChange={e => setEditLockTime(e.target.value)}
                    style={inp}
                  />
                  <p style={{ margin: '5px 0 0', fontSize: 12, color: '#6b7280' }}>
                    Enter times in Pacific (PST/PDT). Saved as UTC automatically.
                  </p>
                </Field>

                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <button
                    onClick={handleSaveWeek}
                    disabled={saving}
                    style={btn(saving ? '#9ca3af' : '#dc2626')}
                  >
                    {saving ? 'Saving…' : 'Save & Auto-assign Matches'}
                  </button>
                  <button
                    onClick={handleDeleteWeek}
                    style={btn('white', '#dc2626')}
                  >
                    Delete Week
                  </button>

                  {(() => {
                    const s = weekStatus(selectedWeekData)
                    const bg = s === 'live' ? '#fee2e2' : s === 'completed' ? '#d1fae5' : '#f3f4f6'
                    const color = s === 'live' ? '#dc2626' : s === 'completed' ? '#065f46' : '#6b7280'
                    return (
                      <span style={{
                        marginLeft: 'auto', padding: '8px 14px', borderRadius: 8,
                        background: bg, color, fontWeight: 700, fontSize: 12,
                      }}>
                        {s === 'live' ? '● Live' : s === 'completed' ? '✓ Done' : 'Pending'}
                      </span>
                    )
                  })()}

                  {saveResult && (
                    <span style={{ fontSize: 13, color: saveResult.assignedCount > 0 ? '#16a34a' : '#6b7280', fontWeight: 600 }}>
                      {saveResult.assignedCount > 0
                        ? `✓ Saved · ${saveResult.assignedCount} match${saveResult.assignedCount !== 1 ? 'es' : ''} assigned to Week ${selectedWeek}`
                        : '✓ Saved · No matches fell in this window'}
                    </span>
                  )}
                </div>
              </div>

              {/* Window summary */}
              {(selectedWeekData.window_start || selectedWeekData.window_end) && (
                <div style={{
                  marginTop: 16, padding: '10px 14px', background: '#f0fdf4',
                  borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 13, color: '#15803d',
                }}>
                  <strong>Active window (Pacific):</strong>{' '}
                  {selectedWeekData.window_start
                    ? new Date(selectedWeekData.window_start).toLocaleString('en-US', { timeZone: PACIFIC_TZ, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
                    : '—'}{' '}
                  →{' '}
                  {selectedWeekData.window_end
                    ? new Date(selectedWeekData.window_end).toLocaleString('en-US', { timeZone: PACIFIC_TZ, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
                    : '—'}
                </div>
              )}
            </div>

            {/* Matches in this week */}
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>
                Matches in Week {selectedWeekData.week_num}
                <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 400, color: '#6b7280' }}>
                  {weekMatches.length} game{weekMatches.length !== 1 ? 's' : ''}
                </span>
              </h3>

              {weekMatches.length === 0 ? (
                <div style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
                  No matches assigned to this week yet.
                  <br />
                  <span style={{ fontSize: 12 }}>Set a window above and click "Save & Auto-assign Matches".</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {weekMatches.map(m => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', background: '#f9fafb',
                        borderRadius: 8, border: '1px solid #f3f4f6',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {m.home_team} <span style={{ color: '#9ca3af' }}>vs</span> {m.away_team}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                          {m.match_date}{m.venue ? ` · ${m.venue}` : ''}
                        </div>
                      </div>

                      <span style={{
                        padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: m.is_completed ? '#d1fae5' : '#fef3c7',
                        color: m.is_completed ? '#065f46' : '#92400e',
                        flexShrink: 0,
                      }}>
                        {m.is_completed ? '✓ Done' : 'Pending'}
                      </span>

                      <button onClick={() => onSelectMatch(m.id)} style={btn('#dc2626')}>
                        Enter Stats
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children, style }: {
  label: string; children: React.ReactNode; style?: React.CSSProperties
}) {
  return (
    <div style={style}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: '#374151', fontSize: 13 }}>
        {label}
      </label>
      {children}
    </div>
  )
}
