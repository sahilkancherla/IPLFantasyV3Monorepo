import { useEffect, useState, useCallback } from 'react'
import { api } from './api'
import type { Player, IplMatch, PlayerStats } from './types'

const DEFAULT_STATS: PlayerStats = {
  runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false,
  wickets: 0, ballsBowled: 0, runsConceded: 0, maidens: 0,
  catches: 0, stumpings: 0, runOutsDirect: 0, runOutsIndirect: 0,
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
  catches: number
  stumpings: number
  run_outs_direct: number
  run_outs_indirect: number
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
    catches: row.catches ?? 0,
    stumpings: row.stumpings ?? 0,
    runOutsDirect: row.run_outs_direct ?? 0,
    runOutsIndirect: row.run_outs_indirect ?? 0,
  }
}

const ROLE_ABBREV: Record<string, string> = {
  batsman: 'BAT', bowler: 'BOW', all_rounder: 'AR', wicket_keeper: 'WK',
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
  field: keyof Omit<PlayerStats, 'isOut'>
  value: number
  update: (id: string, f: keyof PlayerStats, v: PlayerStats[keyof PlayerStats]) => void
}) {
  return (
    <td style={tdBase}>
      <input
        type="number" min={0} value={value}
        onChange={e => {
          const v = parseInt(e.target.value, 10)
          update(playerId, field, isNaN(v) ? 0 : Math.max(0, v))
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
      <td style={{ ...tdBase, fontWeight: 600, paddingLeft: 12, minWidth: 180 }}>{player.name}</td>
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
      {/* Bowling */}
      <Num playerId={player.id} field="wickets" value={s.wickets} update={update} />
      <Num playerId={player.id} field="ballsBowled" value={s.ballsBowled} update={update} />
      <Num playerId={player.id} field="runsConceded" value={s.runsConceded} update={update} />
      <Num playerId={player.id} field="maidens" value={s.maidens} update={update} />
      {/* Fielding */}
      <Num playerId={player.id} field="catches" value={s.catches} update={update} />
      <Num playerId={player.id} field="stumpings" value={s.stumpings} update={update} />
      <Num playerId={player.id} field="runOutsDirect" value={s.runOutsDirect} update={update} />
      <Num playerId={player.id} field="runOutsIndirect" value={s.runOutsIndirect} update={update} />
    </tr>
  )
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

        <button onClick={handleSave} disabled={saving} style={saveBtn('sm')}>
          {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Stats'}
        </button>
      </div>

      {/* Stats table */}
      <div style={{ overflowX: 'auto', background: 'white', borderRadius: 12, border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            {/* Group header row */}
            <tr>
              <th colSpan={2} style={{ ...thBase, textAlign: 'left', paddingLeft: 12, background: '#f9fafb' }}>Player</th>
              <th colSpan={5} style={{ ...thBase, background: '#fef9c3', borderLeft: '2px solid #fde68a' }}>BATTING</th>
              <th colSpan={4} style={{ ...thBase, background: '#dbeafe', borderLeft: '2px solid #bfdbfe' }}>BOWLING</th>
              <th colSpan={4} style={{ ...thBase, background: '#d1fae5', borderLeft: '2px solid #a7f3d0' }}>FIELDING</th>
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
              {/* Bowling */}
              <th style={{ ...thBase, borderLeft: '2px solid #bfdbfe', background: '#eff6ff' }}>Wkts</th>
              <th style={{ ...thBase, background: '#eff6ff' }}>Balls</th>
              <th style={{ ...thBase, background: '#eff6ff' }}>Runs</th>
              <th style={{ ...thBase, background: '#eff6ff' }}>Mdn</th>
              {/* Fielding */}
              <th style={{ ...thBase, borderLeft: '2px solid #a7f3d0', background: '#ecfdf5' }}>Ct</th>
              <th style={{ ...thBase, background: '#ecfdf5' }}>St</th>
              <th style={{ ...thBase, background: '#ecfdf5' }}>RO(D)</th>
              <th style={{ ...thBase, background: '#ecfdf5' }}>RO(I)</th>
            </tr>
          </thead>
          <tbody>
            {/* Home team section */}
            <tr>
              <td
                colSpan={15}
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
            <tr><td colSpan={15} style={{ height: 4, background: '#e5e7eb' }} /></tr>

            {/* Away team section */}
            <tr>
              <td
                colSpan={15}
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
