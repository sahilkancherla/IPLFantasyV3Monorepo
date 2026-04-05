import { useEffect, useState, useCallback } from 'react'
import { api } from './api'
import type { IplMatch } from './types'

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid #d1d5db', fontSize: 14, background: 'white', boxSizing: 'border-box',
}
const btn = (bg: string, color = 'white'): React.CSSProperties => ({
  padding: '9px 18px', background: bg, color, border: `1px solid ${bg === 'white' ? '#d1d5db' : bg}`,
  borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
})

const PACIFIC_TZ = 'America/Los_Angeles'

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
  return new Date(`${val}:00-07:00`).toISOString()
}

function formatPacific(isoStr: string | null): string {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleString('en-US', {
    timeZone: PACIFIC_TZ, month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })
}

interface Props {
  secret: string
  onSelectMatch: (id: string) => void
}

export function GamesTab({ secret, onSelectMatch }: Props) {
  const [matches, setMatches] = useState<IplMatch[]>([])
  const [teams, setTeams] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  // Which match row is expanded for editing
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Edit field state (for the expanded row)
  const [editStartTime, setEditStartTime] = useState('')
  const [editVenue, setEditVenue] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editSaved, setEditSaved] = useState(false)

  // Create form state
  const [homeTeam, setHomeTeam] = useState('')
  const [awayTeam, setAwayTeam] = useState('')
  const [matchDate, setMatchDate] = useState('')
  const [venue, setVenue] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [matchesData, teamsData] = await Promise.all([
        api.get('/admin/matches', secret) as Promise<{ matches: IplMatch[] }>,
        api.get('/admin/teams', secret) as Promise<{ teams: string[] }>,
      ])
      setMatches(matchesData.matches)
      setTeams(teamsData.teams)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [secret])

  useEffect(() => { fetchData() }, [fetchData])

  const openEdit = (m: IplMatch) => {
    if (expandedId === m.id) { setExpandedId(null); return }
    setExpandedId(m.id)
    setEditStartTime(utcToPacificDatetimeLocal(m.start_time_utc))
    setEditVenue(m.venue ?? '')
    setEditSaved(false)
  }

  const handleSaveEdit = async (matchId: string) => {
    setEditSaving(true)
    setEditSaved(false)
    try {
      const payload: Record<string, string | null> = {
        venue: editVenue || null,
      }
      if (editStartTime) {
        payload.startTimeUtc = pacificToUtcIso(editStartTime)
        // Derive match_date from the Pacific time
        payload.matchDate = editStartTime.split('T')[0]
      }
      const res = await api.patch(`/admin/matches/${matchId}`, secret, payload) as { match: IplMatch }
      setMatches(prev => prev.map(m => m.id === matchId ? res.match : m))
      setEditSaved(true)
      setTimeout(() => { setEditSaved(false); setExpandedId(null) }, 1500)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setEditSaving(false)
    }
  }

  const handleCreate = async () => {
    if (!homeTeam || !awayTeam || !matchDate) { alert('Home team, away team and date are required'); return }
    if (homeTeam === awayTeam) { alert('Home and away team must differ'); return }
    setCreating(true)
    try {
      await api.post('/admin/matches', secret, {
        homeTeam, awayTeam, matchDate,
        venue: venue || undefined,
      })
      setShowCreate(false)
      setHomeTeam(''); setAwayTeam(''); setMatchDate(''); setVenue('')
      fetchData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create match')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Delete "${label}"? This also removes any entered stats.`)) return
    try {
      await api.delete(`/admin/matches/${id}`, secret)
      if (expandedId === id) setExpandedId(null)
      fetchData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete match')
    }
  }

  const handleStatusChange = async (id: string, status: 'pending' | 'live' | 'completed') => {
    try {
      const res = await api.patch(`/admin/matches/${id}`, secret, { status }) as { match: IplMatch }
      if (status === 'live') {
        // Another match may have been demoted to pending — clear it locally
        setMatches(prev => prev.map(m => m.id === id ? res.match : { ...m, status: m.status === 'live' ? 'pending' : m.status }))
      } else {
        setMatches(prev => prev.map(m => m.id === id ? res.match : m))
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>IPL Games</h2>
        <button onClick={() => setShowCreate(v => !v)} style={btn(showCreate ? '#6b7280' : '#dc2626')}>
          {showCreate ? '✕ Cancel' : '+ Create Game'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{
          background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
          padding: 24, marginBottom: 28,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
        }}>
          <h3 style={{ gridColumn: '1 / -1', margin: '0 0 4px', fontSize: 16 }}>New Game</h3>

          <Field label="Home Team *">
            <select value={homeTeam} onChange={e => setHomeTeam(e.target.value)} style={inp}>
              <option value="">Select team…</option>
              {teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>

          <Field label="Away Team *">
            <select value={awayTeam} onChange={e => setAwayTeam(e.target.value)} style={inp}>
              <option value="">Select team…</option>
              {teams.filter(t => t !== homeTeam).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>

          <Field label="Match Date *">
            <input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} style={inp} />
          </Field>

          <Field label="Venue">
            <input type="text" value={venue} onChange={e => setVenue(e.target.value)} placeholder="Optional" style={inp} />
          </Field>

          <div style={{ gridColumn: '1 / -1' }}>
            <button onClick={handleCreate} disabled={creating} style={btn(creating ? '#9ca3af' : '#16a34a')}>
              {creating ? 'Creating…' : 'Create Game'}
            </button>
          </div>
        </div>
      )}

      {/* Match list */}
      {loading ? (
        <p style={{ color: '#9ca3af' }}>Loading…</p>
      ) : matches.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 48, textAlign: 'center', color: '#9ca3af' }}>
          No games yet. Create one above.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {matches.map(m => {
            const isExpanded = expandedId === m.id
            return (
              <div
                key={m.id}
                style={{ background: 'white', border: `1px solid ${isExpanded ? '#fca5a5' : '#e5e7eb'}`, borderRadius: 12, overflow: 'hidden' }}
              >
                {/* Main row */}
                <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Match info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {m.home_team} <span style={{ color: '#9ca3af' }}>vs</span> {m.away_team}
                      {m.is_completed && (
                        <span style={{
                          background: '#d1fae5', color: '#065f46',
                          fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                        }}>
                          ✓ Stats Saved
                        </span>
                      )}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>
                      {m.week_num != null && <span style={{ marginRight: 8, color: '#dc2626', fontWeight: 600 }}>W{m.week_num}</span>}
                      {formatPacific(m.start_time_utc)}
                      {m.venue && ` · ${m.venue}`}
                    </div>
                  </div>

                  {/* Status buttons */}
                  <div style={{ display: 'flex', borderRadius: 8, border: '1px solid #d1d5db', overflow: 'hidden', flexShrink: 0 }}>
                    {(['pending', 'live', 'completed'] as const).map(s => {
                      const active = (m.status ?? (m.is_completed ? 'completed' : 'pending')) === s
                      const bg = active ? (s === 'live' ? '#dc2626' : s === 'completed' ? '#16a34a' : '#374151') : 'white'
                      const color = active ? 'white' : '#6b7280'
                      return (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(m.id, s)}
                          style={{
                            padding: '5px 11px', border: 'none', cursor: 'pointer', fontSize: 12,
                            fontWeight: 600, background: bg, color,
                            borderRight: s !== 'completed' ? '1px solid #d1d5db' : 'none',
                          }}
                        >
                          {s === 'pending' ? 'Pending' : s === 'live' ? '● Live' : '✓ Done'}
                        </button>
                      )
                    })}
                  </div>

                  <button onClick={() => openEdit(m)} style={btn(isExpanded ? '#f3f4f6' : 'white', isExpanded ? '#dc2626' : '#374151')}>
                    {isExpanded ? 'Cancel' : 'Edit'}
                  </button>
                  <button onClick={() => onSelectMatch(m.id)} style={btn('#dc2626')}>
                    Enter Stats
                  </button>
                  <button onClick={() => handleDelete(m.id, `${m.home_team} vs ${m.away_team}`)} style={btn('white', '#dc2626')}>
                    Delete
                  </button>
                </div>

                {/* Inline edit panel */}
                {isExpanded && (
                  <div style={{
                    borderTop: '1px solid #fee2e2', background: '#fff7f7',
                    padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
                  }}>
                    <Field label="Start Time (Pacific)">
                      <input
                        type="datetime-local"
                        value={editStartTime}
                        onChange={e => setEditStartTime(e.target.value)}
                        style={inp}
                      />
                    </Field>

                    <Field label="Venue">
                      <input
                        type="text"
                        value={editVenue}
                        onChange={e => setEditVenue(e.target.value)}
                        placeholder="e.g. Wankhede Stadium"
                        style={inp}
                      />
                    </Field>

                    <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button
                        onClick={() => handleSaveEdit(m.id)}
                        disabled={editSaving}
                        style={btn(editSaved ? '#16a34a' : editSaving ? '#9ca3af' : '#dc2626')}
                      >
                        {editSaving ? 'Saving…' : editSaved ? '✓ Saved' : 'Save Changes'}
                      </button>
                      {editStartTime && (
                        <span style={{ fontSize: 12, color: '#6b7280' }}>
                          → {new Date(pacificToUtcIso(editStartTime)).toUTCString()}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
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
