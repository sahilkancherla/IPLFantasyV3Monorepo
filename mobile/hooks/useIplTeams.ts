import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface IplTeam {
  slug: string
  name: string
  abbrev: string
  logo_path: string
  display_order: number
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''

export function useIplTeams() {
  return useQuery({
    queryKey: ['ipl-teams'],
    queryFn: () => api.get<{ teams: IplTeam[] }>('/ipl-teams'),
    select: (d) => d.teams,
    staleTime: 24 * 60 * 60_000,  // teams change ~once a season
    gcTime: 7 * 24 * 60 * 60_000,
  })
}

export function teamLogoUrl(team: IplTeam | null | undefined): string | null {
  if (!team || !SUPABASE_URL) return null
  return `${SUPABASE_URL}/storage/v1/object/public/team-logos/${team.logo_path}`
}
