// Lookup helpers for IPL team metadata. The actual data is fetched at
// runtime from the backend (see hooks/useIplTeams.ts) so it isn't bundled
// into the app or committed to source control.

import type { IplTeam } from '../hooks/useIplTeams'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''

const NAME_ALIASES: Record<string, string> = {
  'Royal Challengers Bangalore': 'Royal Challengers Bengaluru',
}

function resolveName(name: string | null | undefined): string | null {
  if (!name) return null
  return NAME_ALIASES[name] ?? name
}

export function findTeam(teams: IplTeam[] | undefined, name: string | null | undefined): IplTeam | null {
  const resolved = resolveName(name)
  if (!resolved || !teams) return null
  return teams.find((t) => t.name === resolved) ?? null
}

export function teamAbbrev(teams: IplTeam[] | undefined, name: string | null | undefined): string {
  return findTeam(teams, name)?.abbrev ?? (name ?? '')
}

export function teamLogoUrlForName(teams: IplTeam[] | undefined, name: string | null | undefined): string | null {
  const team = findTeam(teams, name)
  if (!team || !SUPABASE_URL) return null
  return `${SUPABASE_URL}/storage/v1/object/public/team-logos/${team.logo_path}`
}
