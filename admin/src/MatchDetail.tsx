import { useEffect, useState, useCallback } from 'react'
import { api } from './api'
import type { Player, IplMatch, PlayerStats } from './types'

const DEFAULT_STATS: PlayerStats = {
  runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false,
  wickets: 0, ballsBowled: 0, runsConceded: 0, maidens: 0, lbwBowledWickets: 0,
  catches: 0, stumpings: 0, runOutsDirect: 0, runOutsIndirect: 0,
  dismissalText: '', isInXI: true,
}

interface DbScore {
  player_id: string
  runs_scored: number
  balls_faced: number
  fours: number
  sixes: number
  is_out: boolean
  wickets_taken: number
  balls_bowled: number
  runs_conceded: number
  maidens: number
  lbw_bowled_wickets: number
  catches: number
  stumpings: number
  run_outs_direct: number
  run_outs_indirect: number
  dismissal_text: string | null
  is_in_xi: boolean
}

function dbToStats(row: DbScore): PlayerStats {
  return {
    runs: row.runs_scored ?? 0,
    ballsFaced: row.balls_faced ?? 0,
    fours: row.fours ?? 0,
    sixes: row.sixes ?? 0,
    isOut: row.is_out ?? false,
    wickets: row.wickets_taken ?? 0,
    ballsBowled: row.balls_bowled ?? 0,
    runsConceded: row.runs_conceded ?? 0,
    maidens: row.maidens ?? 0,
    lbwBowledWickets: row.lbw_bowled_wickets ?? 0,
    catches: row.catches ?? 0,
    stumpings: row.stumpings ?? 0,
    runOutsDirect: row.run_outs_direct ?? 0,
    runOutsIndirect: row.run_outs_indirect ?? 0,
    dismissalText: row.dismissal_text ?? '',
    isInXI: row.is_in_xi ?? true,
  }
}

const ROLE_ABBREV: Record<string, string> = {
  batsman: 'BAT', bowler: 'BOW', all_rounder: 'AR', wicket_keeper: 'WK',
}

function calcPoints(role: string, s: PlayerStats): number {
  let pts = 0

  // Playing XI bonus
  if (s.isInXI) pts += 4

  // Batting
  pts += s.runs
  pts += s.fours
  pts += s.sixes * 2
  if      (s.runs >= 100) pts += 16
  else if (s.runs >= 50)  pts += 8
  else if (s.runs >= 30)  pts += 4
  if (s.isOut && s.runs === 0) pts -= 2

  // Bowling
  pts += s.wickets * 25
  pts += s.lbwBowledWickets * 8
  if      (s.wickets >= 5) pts += 16
  else if (s.wickets >= 4) pts += 8
  else if (s.wickets >= 3) pts += 4
  pts += s.maidens * 12
  if (s.ballsBowled >= 12) {
    const overs = s.ballsBowled / 6
    const econ  = s.runsConceded / overs
    if      (econ < 5)  pts += 6
    else if (econ < 6)  pts += 4
    else if (econ < 7)  pts += 2
    else if (econ < 10) pts += 0
    else if (econ < 11) pts -= 2
    else if (econ < 12) pts -= 4
    else                pts -= 6
  }

  // Fielding
  pts += s.catches * 8
  if (s.catches >= 3) pts += 4
  pts += s.stumpings * 12
  pts += s.runOutsDirect * 12
  pts += s.runOutsIndirect * 6

  // Strike rate (bat / wk / ar only)
  const srRoles = ['batsman', 'wicket_keeper', 'all_rounder']
  if (srRoles.includes(role) && s.ballsFaced > 0 && (s.ballsFaced >= 10 || s.runs >= 20)) {
    const sr = (s.runs / s.ballsFaced) * 100
    if      (sr <  50)  pts -= 6
    else if (sr <  60)  pts -= 4
    else if (sr <  70)  pts -= 2
    else if (sr < 130)  pts += 0
    else if (sr < 150)  pts += 2
    else if (sr < 170)  pts += 4
    else                pts += 6
  }

  return Math.round(pts * 100) / 100
}

// Shared styles
const thBase: React.CSSProperties = {
  padding: '8px 6px', fontWeight: 700, fontSize: 11, color: '#374151',
  borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', textAlign: 'center',
}
const tdBase: React.CSSProperties = {
  padding: '5px 4px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle',
}
const numInp: React.CSSProperties = {
  width: 52, padding: '4px 4px', border: '1px solid #d1d5db', borderRadius: 6,
  fontSize: 13, textAlign: 'center', background: '#fafafa', display: 'block',
}

function Num({
  playerId, field, value, update,
}: {
  playerId: string
  field: keyof Omit<PlayerStats, 'isOut' | 'dismissalText' | 'isInXI'>
  value: number
  update: (id: string, f: keyof PlayerStats, v: PlayerStats[keyof PlayerStats]) => void
}) {
  const [draft, setDraft] = useState<string>(String(value))

  // Sync draft when an external action changes value (import, clear stats).
  // When we ourselves call update() on a valid keypress, value changes to what
  // we just typed, so setDraft gets called with the same string — React bails
  // out without an extra render, keeping cursor position intact.
  useEffect(() => { setDraft(String(value)) }, [value])

  return (
    <td style={tdBase}>
      <input
        type="number" min={0} value={draft}
        onChange={e => {
          setDraft(e.target.value)
          // Commit valid numbers immediately so the Pts column updates in real-time
          const v = parseInt(e.target.value, 10)
          if (!isNaN(v) && v >= 0) update(playerId, field, v)
        }}
        onBlur={() => {
          // Clamp on blur to clean up any empty / negative intermediate state
          const v = parseInt(draft, 10)
          const clamped = isNaN(v) ? 0 : Math.max(0, v)
          setDraft(String(clamped))
          update(playerId, field, clamped)
        }}
        style={numInp}
      />
    </td>
  )
}

function PlayerRow({
  player, stats, rowBg, update,
}: {
  player: Player
  stats: PlayerStats
  rowBg: string
  update: (id: string, f: keyof PlayerStats, v: PlayerStats[keyof PlayerStats]) => void
}) {
  const s = stats
  return (
    <tr style={{ background: rowBg }}>
      <td style={{ ...tdBase, paddingLeft: 12, minWidth: 200 }}>
        <div style={{ fontWeight: 600 }}>{player.name}</div>
        <input
          type="text"
          value={s.dismissalText}
          onChange={e => update(player.id, 'dismissalText', e.target.value)}
          placeholder="dismissal…"
          style={{
            display: 'block', width: '100%', marginTop: 2,
            fontSize: 11, color: '#6b7280', fontStyle: 'italic',
            border: 'none', borderBottom: '1px dashed #d1d5db',
            background: 'transparent', outline: 'none', padding: '1px 0',
          }}
        />
      </td>
      <td style={{ ...tdBase, textAlign: 'center', color: '#6b7280', fontSize: 11 }}>
        {ROLE_ABBREV[player.role] ?? player.role}
      </td>
      {/* Batting */}
      <Num playerId={player.id} field="runs" value={s.runs} update={update} />
      <Num playerId={player.id} field="ballsFaced" value={s.ballsFaced} update={update} />
      <Num playerId={player.id} field="fours" value={s.fours} update={update} />
      <Num playerId={player.id} field="sixes" value={s.sixes} update={update} />
      <td style={{ ...tdBase, textAlign: 'center' }}>
        <input
          type="checkbox" checked={s.isOut}
          onChange={e => update(player.id, 'isOut', e.target.checked)}
          style={{ width: 16, height: 16, cursor: 'pointer', display: 'block', margin: 'auto' }}
        />
      </td>
      <td style={{ ...tdBase, textAlign: 'center', fontWeight: 600, color: '#374151', fontSize: 13 }}>
        {s.ballsFaced > 0 ? ((s.runs / s.ballsFaced) * 100).toFixed(1) : '—'}
      </td>
      {/* Bowling */}
      <Num playerId={player.id} field="wickets" value={s.wickets} update={update} />
      <Num playerId={player.id} field="ballsBowled" value={s.ballsBowled} update={update} />
      <Num playerId={player.id} field="runsConceded" value={s.runsConceded} update={update} />
      <Num playerId={player.id} field="maidens" value={s.maidens} update={update} />
      <Num playerId={player.id} field="lbwBowledWickets" value={s.lbwBowledWickets} update={update} />
      {/* Fielding */}
      <Num playerId={player.id} field="catches" value={s.catches} update={update} />
      <Num playerId={player.id} field="stumpings" value={s.stumpings} update={update} />
      <Num playerId={player.id} field="runOutsDirect" value={s.runOutsDirect} update={update} />
      <Num playerId={player.id} field="runOutsIndirect" value={s.runOutsIndirect} update={update} />
      {/* Playing XI */}
      <td style={{ ...tdBase, textAlign: 'center' }}>
        <input
          type="checkbox" checked={s.isInXI}
          onChange={e => update(player.id, 'isInXI', e.target.checked)}
          style={{ width: 16, height: 16, cursor: 'pointer', display: 'block', margin: 'auto' }}
        />
      </td>
      {/* Points */}
      <td style={{ ...tdBase, textAlign: 'center', fontWeight: 700, fontSize: 13, borderLeft: '2px solid #e5e7eb', paddingLeft: 10, paddingRight: 10, minWidth: 52 }}>
        {calcPoints(player.role, s).toFixed(1)}
      </td>
    </tr>
  )
}

interface ImportResult {
  stats: Array<{
    playerId: string; scorecardName: string
    runs: number; ballsFaced: number; fours: number; sixes: number; isOut: boolean
    wickets: number; ballsBowled: number; runsConceded: number; maidens: number; lbwBowledWickets: number
    catches: number; stumpings: number; runOutsDirect: number; runOutsIndirect: number
    dismissalText: string
  }>
  unmatched: string[]
}

interface Props {
  matchId: string
  secret: string
  onBack: () => void
}

export function MatchDetail({ matchId, secret, onBack }: Props) {
  const [match, setMatch] = useState<IplMatch | null>(null)
  const [homePlayers, setHomePlayers] = useState<Player[]>([])
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([])
  const [stats, setStats] = useState<Record<string, PlayerStats>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [savingUrl, setSavingUrl] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState('')

  useEffect(() => {
    ;(api.get(`/admin/matches/${matchId}`, secret) as Promise<{
      match: IplMatch
      homePlayers: Player[]
      awayPlayers: Player[]
      stats: Record<string, DbScore>
    }>)
      .then(data => {
        setMatch(data.match)
        setHomePlayers(data.homePlayers)
        setAwayPlayers(data.awayPlayers)
        if (data.match.scorecard_url) setImportUrl(data.match.scorecard_url)

        const init: Record<string, PlayerStats> = {}
        for (const p of [...data.homePlayers, ...data.awayPlayers]) {
          init[p.id] = data.stats[p.id] ? dbToStats(data.stats[p.id]) : { ...DEFAULT_STATS }
        }
        setStats(init)
      })
      .catch(err => alert(err instanceof Error ? err.message : 'Failed to load match'))
  }, [matchId, secret])

  const update = useCallback(<K extends keyof PlayerStats>(
    id: string, field: K, value: PlayerStats[K]
  ) => {
    setStats(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const playerStats = [...homePlayers, ...awayPlayers].map(p => ({
        playerId: p.id,
        ...stats[p.id] ?? DEFAULT_STATS,
      }))
      await api.post(`/admin/matches/${matchId}/stats`, secret, { playerStats })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      // Refresh to get updated is_completed
      setMatch(prev => prev ? { ...prev, is_completed: true } : prev)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save stats')
    } finally {
      setSaving(false)
    }
  }

  const handleClearStats = async () => {
    if (!confirm('Clear all stat entries for this match? This will also unmark it as completed.')) return
    setClearing(true)
    try {
      await api.delete(`/admin/matches/${matchId}/stats`, secret)
      // Reset all stats to defaults in the UI
      setStats(prev => {
        const next = { ...prev }
        for (const id of Object.keys(next)) next[id] = { ...DEFAULT_STATS }
        return next
      })
      setMatch(prev => prev ? { ...prev, is_completed: false } : prev)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to clear stats')
    } finally {
      setClearing(false)
    }
  }

  const handleSaveUrl = async () => {
    setSavingUrl(true)
    try {
      await api.patch(`/admin/matches/${matchId}`, secret, { scorecardUrl: importUrl.trim() || null })
      setMatch(prev => prev ? { ...prev, scorecard_url: importUrl.trim() || null } : prev)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save URL')
    } finally {
      setSavingUrl(false)
    }
  }

  const handleImport = async () => {
    if (!importUrl.trim()) return
    setImporting(true)
    setImportError('')
    setImportResult(null)
    try {
      const res = await api.post(`/admin/matches/${matchId}/import-scorecard`, secret, { url: importUrl.trim() }) as ImportResult
      // Merge into stats
      setStats(prev => {
        const next = { ...prev }
        const importedIds = new Set<string>()
        for (const s of res.stats) {
          importedIds.add(s.playerId)
          next[s.playerId] = {
            runs: s.runs, ballsFaced: s.ballsFaced, fours: s.fours, sixes: s.sixes, isOut: s.isOut,
            wickets: s.wickets, ballsBowled: s.ballsBowled, runsConceded: s.runsConceded, maidens: s.maidens, lbwBowledWickets: s.lbwBowledWickets,
            catches: s.catches, stumpings: s.stumpings, runOutsDirect: s.runOutsDirect, runOutsIndirect: s.runOutsIndirect,
            dismissalText: s.dismissalText ?? '', isInXI: true,
          }
        }
        // Players not found in the scorecard are NOT in the playing XI
        for (const id of Object.keys(next)) {
          if (!importedIds.has(id)) {
            next[id] = { ...next[id], isInXI: false }
          }
        }
        return next
      })
      setImportResult(res)
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  if (!match) {
    return <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>Loading match…</div>
  }

  const saveBtn = (size: 'sm' | 'lg'): React.CSSProperties => ({
    padding: size === 'lg' ? '12px 32px' : '9px 20px',
    fontSize: size === 'lg' ? 15 : 13,
    background: saved ? '#16a34a' : saving ? '#9ca3af' : '#dc2626',
    color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
  })

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Sticky header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24,
        position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 10,
        paddingTop: 12, paddingBottom: 12,
      }}>
        <button
          onClick={onBack}
          style={{
            padding: '8px 16px', background: 'white', border: '1px solid #d1d5db',
            borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
          }}
        >
          ← Back
        </button>

        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>
            {match.home_team} <span style={{ color: '#9ca3af', fontWeight: 400 }}>vs</span> {match.away_team}
          </h2>
          <div style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>
            {match.match_date}
            {match.week_num != null && ` · Week ${match.week_num}`}
            {match.venue && ` · ${match.venue}`}
            {match.is_completed && (
              <span style={{
                marginLeft: 10, background: '#d1fae5', color: '#065f46',
                padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              }}>✓ Stats saved</span>
            )}
          </div>
        </div>

        <button
          onClick={handleClearStats}
          disabled={clearing}
          style={{
            padding: '9px 20px', fontSize: 13, background: clearing ? '#9ca3af' : 'white',
            color: clearing ? 'white' : '#dc2626', border: '1px solid #dc2626',
            borderRadius: 8, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {clearing ? 'Clearing…' : 'Clear Stats'}
        </button>
        <button onClick={handleSave} disabled={saving} style={saveBtn('sm')}>
          {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Stats'}
        </button>
      </div>

      {/* Scorecard import bar */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '14px 18px', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
          Import from Scorecard URL
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="url"
            value={importUrl}
            onChange={e => setImportUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleImport()}
            placeholder="https://www.cricbuzz.com/cricket-scorecard/…"
            style={{
              flex: 1, padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8,
              fontSize: 13, outline: 'none',
            }}
          />
          <button
            onClick={handleSaveUrl}
            disabled={savingUrl}
            title="Save this URL so it's prefilled next time"
            style={{
              padding: '9px 14px', background: savingUrl ? '#9ca3af' : 'white',
              color: savingUrl ? 'white' : '#374151',
              border: '1px solid #d1d5db', borderRadius: 8,
              fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {savingUrl ? 'Saving…' : match?.scorecard_url === (importUrl.trim() || null) ? '✓ Saved' : 'Save URL'}
          </button>
          <button
            onClick={handleImport}
            disabled={importing || !importUrl.trim()}
            style={{
              padding: '9px 20px', background: importing ? '#9ca3af' : '#7c3aed',
              color: 'white', border: 'none', borderRadius: 8,
              fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {importing ? 'Importing…' : 'Import Stats'}
          </button>
        </div>

        {importError && (
          <div style={{ marginTop: 10, color: '#dc2626', fontSize: 13 }}>
            ✕ {importError}
          </div>
        )}

        {importResult && (
          <div style={{ marginTop: 10, fontSize: 13 }}>
            <span style={{ color: '#16a34a', fontWeight: 600 }}>
              ✓ {importResult.stats.length} player{importResult.stats.length !== 1 ? 's' : ''} imported
            </span>
            {importResult.unmatched.length > 0 && (
              <span style={{ color: '#d97706', marginLeft: 12 }}>
                ⚠ Unmatched: {importResult.unmatched.join(', ')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stats table */}
      <div style={{ overflowX: 'auto', background: 'white', borderRadius: 12, border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            {/* Group header row */}
            <tr>
              <th colSpan={2} style={{ ...thBase, textAlign: 'left', paddingLeft: 12, background: '#f9fafb' }}>Player</th>
              <th colSpan={6} style={{ ...thBase, background: '#fef9c3', borderLeft: '2px solid #fde68a' }}>BATTING</th>
              <th colSpan={5} style={{ ...thBase, background: '#dbeafe', borderLeft: '2px solid #bfdbfe' }}>BOWLING</th>
              <th colSpan={4} style={{ ...thBase, background: '#d1fae5', borderLeft: '2px solid #a7f3d0' }}>FIELDING</th>
              <th style={{ ...thBase, background: '#f0fdf4', borderLeft: '2px solid #bbf7d0' }}>XI</th>
              <th style={{ ...thBase, borderLeft: '2px solid #e5e7eb' }}>PTS</th>
            </tr>
            {/* Column header row */}
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ ...thBase, textAlign: 'left', paddingLeft: 12, minWidth: 180 }}>Name</th>
              <th style={thBase}>Role</th>
              {/* Batting */}
              <th style={{ ...thBase, borderLeft: '2px solid #fde68a', background: '#fef9c3' }}>Runs</th>
              <th style={{ ...thBase, background: '#fef9c3' }}>Balls</th>
              <th style={{ ...thBase, background: '#fef9c3' }}>4s</th>
              <th style={{ ...thBase, background: '#fef9c3' }}>6s</th>
              <th style={{ ...thBase, background: '#fef9c3' }}>Out?</th>
              <th style={{ ...thBase, background: '#fef9c3' }}>SR</th>
              {/* Bowling */}
              <th style={{ ...thBase, borderLeft: '2px solid #bfdbfe', background: '#eff6ff' }}>Wkts</th>
              <th style={{ ...thBase, background: '#eff6ff' }}>Balls</th>
              <th style={{ ...thBase, background: '#eff6ff' }}>Runs</th>
              <th style={{ ...thBase, background: '#eff6ff' }}>Mdn</th>
              <th style={{ ...thBase, background: '#eff6ff' }}>LBW/B</th>
              {/* Fielding */}
              <th style={{ ...thBase, borderLeft: '2px solid #a7f3d0', background: '#ecfdf5' }}>Ct</th>
              <th style={{ ...thBase, background: '#ecfdf5' }}>St</th>
              <th style={{ ...thBase, background: '#ecfdf5' }}>RO(D)</th>
              <th style={{ ...thBase, background: '#ecfdf5' }}>RO(I)</th>
              {/* XI */}
              <th style={{ ...thBase, borderLeft: '2px solid #bbf7d0', background: '#f0fdf4' }}>XI?</th>
              {/* Points */}
              <th style={{ ...thBase, borderLeft: '2px solid #e5e7eb', minWidth: 52 }}>Pts</th>
            </tr>
          </thead>
          <tbody>
            {/* Home team section */}
            <tr>
              <td
                colSpan={19}
                style={{
                  padding: '8px 12px', background: '#fff7ed', fontWeight: 700,
                  fontSize: 12, color: '#c2410c', borderTop: '2px solid #fed7aa',
                  borderBottom: '1px solid #fed7aa', letterSpacing: 0.5,
                }}
              >
                🏠 {match.home_team}
              </td>
            </tr>
            {homePlayers.map((p, i) => (
              <PlayerRow
                key={p.id} player={p}
                stats={stats[p.id] ?? DEFAULT_STATS}
                rowBg={i % 2 === 0 ? '#fffbf5' : 'white'}
                update={update}
              />
            ))}

            {/* Spacer row */}
            <tr><td colSpan={19} style={{ height: 4, background: '#e5e7eb' }} /></tr>

            {/* Away team section */}
            <tr>
              <td
                colSpan={19}
                style={{
                  padding: '8px 12px', background: '#eff6ff', fontWeight: 700,
                  fontSize: 12, color: '#1d4ed8', borderTop: '2px solid #bfdbfe',
                  borderBottom: '1px solid #bfdbfe', letterSpacing: 0.5,
                }}
              >
                ✈️ {match.away_team}
              </td>
            </tr>
            {awayPlayers.map((p, i) => (
              <PlayerRow
                key={p.id} player={p}
                stats={stats[p.id] ?? DEFAULT_STATS}
                rowBg={i % 2 === 0 ? '#f0f7ff' : 'white'}
                update={update}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Bottom save button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
        <button onClick={handleSave} disabled={saving} style={saveBtn('lg')}>
          {saving ? 'Saving…' : saved ? '✓ Stats Saved!' : 'Save All Stats'}
        </button>
      </div>
    </div>
  )
}
