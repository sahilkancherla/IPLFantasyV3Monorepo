import { useEffect, useState, useCallback } from 'react'
import { api } from './api'
import type { IplMatch, IplWeek } from './types'

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid #d1d5db', fontSize: 14, background: 'white',
}
const btn = (bg: string, color = 'white'): React.CSSProperties => ({
  padding: '9px 18px', background: bg, color, border: `1px solid ${bg === 'white' ? '#d1d5db' : bg}`,
  borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
})

const TEAM_ABBREV: Record<string, string> = {
  'Mumbai Indians': 'MI', 'Chennai Super Kings': 'CSK', 'Royal Challengers Bangalore': 'RCB',
  'Kolkata Knight Riders': 'KKR', 'Delhi Capitals': 'DC', 'Rajasthan Royals': 'RR',
  'Punjab Kings': 'PBKS', 'Sunrisers Hyderabad': 'SRH', 'Gujarat Titans': 'GT',
  'Lucknow Super Giants': 'LSG',
}
const abbrev = (team: string) => TEAM_ABBREV[team] ?? team.slice(0, 3).toUpperCase()

interface Props {
  secret: string
  onSelectMatch: (id: string) => void
}

export function GamesTab({ secret, onSelectMatch }: Props) {
  const [matches, setMatches] = useState<IplMatch[]>([])
  const [teams, setTeams] = useState<string[]>([])
  const [weeks, setWeeks] = useState<IplWeek[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  // Create form state
  const [homeTeam, setHomeTeam] = useState('')
  const [awayTeam, setAwayTeam] = useState('')
  const [matchDate, setMatchDate] = useState('')
  const [weekNum, setWeekNum] = useState('')
  const [venue, setVenue] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [matchesData, teamsData, settingsData] = await Promise.all([
        api.get('/admin/matches', secret) as Promise<{ matches: IplMatch[] }>,
        api.get('/admin/teams', secret) as Promise<{ teams: string[] }>,
        api.get('/admin/settings', secret) as Promise<{ weeks: IplWeek[] }>,
      ])
      setMatches(matchesData.matches)
      setTeams(teamsData.teams)
      setWeeks(settingsData.weeks)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [secret])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCreate = async () => {
    if (!homeTeam || !awayTeam || !matchDate) { alert('Home team, away team and date are required'); return }
    if (homeTeam === awayTeam) { alert('Home and away team must differ'); return }
    setCreating(true)
    try {
      await api.post('/admin/matches', secret, {
        homeTeam,
        awayTeam,
        matchDate,
        weekNum: weekNum ? parseInt(weekNum, 10) : undefined,
        venue: venue || undefined,
      })
      setShowCreate(false)
      setHomeTeam(''); setAwayTeam(''); setMatchDate(''); setWeekNum(''); setVenue('')
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
      fetchData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete match')
    }
  }

  return (
    <div style={{ padding: 32 }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>IPL Games</h2>
        <button
          onClick={() => setShowCreate(v => !v)}
          style={btn(showCreate ? '#6b7280' : '#dc2626')}
        >
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

          <Field label="IPL Week">
            <select value={weekNum} onChange={e => setWeekNum(e.target.value)} style={inp}>
              <option value="">Auto-detect from date</option>
              {weeks.map(w => (
                <option key={w.week_num} value={String(w.week_num)}>
                  Week {w.week_num} — {w.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Venue" style={{ gridColumn: '1 / -1' }}>
            <input
              type="text" value={venue} onChange={e => setVenue(e.target.value)}
              placeholder="Optional" style={inp}
            />
          </Field>

          <div style={{ gridColumn: '1 / -1' }}>
            <button
              onClick={handleCreate}
              disabled={creating}
              style={btn(creating ? '#9ca3af' : '#16a34a')}
            >
              {creating ? 'Creating…' : 'Create Game'}
            </button>
          </div>
        </div>
      )}

      {/* Match list */}
      {loading ? (
        <p style={{ color: '#9ca3af' }}>Loading…</p>
      ) : matches.length === 0 ? (
        <div style={{
          background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
          padding: 48, textAlign: 'center', color: '#9ca3af',
        }}>
          No games yet. Create one above.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {matches.map(m => {
            const label = `${abbrev(m.home_team)} vs ${abbrev(m.away_team)}`
            return (
              <div
                key={m.id}
                style={{
                  background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
                  padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
                }}
              >
                {/* Match info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 3 }}>
                    {m.home_team} <span style={{ color: '#9ca3af' }}>vs</span> {m.away_team}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 13 }}>
                    {m.match_date}
                    {m.week_num != null && ` · Week ${m.week_num}`}
                    {m.venue && ` · ${m.venue}`}
                  </div>
                </div>

                {/* Status badge */}
                <span style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                  background: m.is_completed ? '#d1fae5' : '#fef3c7',
                  color: m.is_completed ? '#065f46' : '#92400e',
                  flexShrink: 0,
                }}>
                  {m.is_completed ? '✓ Done' : 'Pending'}
                </span>

                <button onClick={() => onSelectMatch(m.id)} style={btn('#dc2626')}>
                  Enter Stats
                </button>
                <button
                  onClick={() => handleDelete(m.id, `${m.home_team} vs ${m.away_team} on ${m.match_date}`)}
                  style={btn('white', '#dc2626')}
                >
                  Delete
                </button>
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
