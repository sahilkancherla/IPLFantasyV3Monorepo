import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface AppSettings {
  images_enabled?: boolean
  [key: string]: unknown
}

const QUERY_KEY = ['app-settings'] as const

export function useAppSettings() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.get<{ settings: AppSettings }>('/app-settings'),
    select: (d) => d.settings,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
  })
}

/** Synchronous boolean read — `true` if images are on or the setting hasn't
 *  loaded yet. Defaulting to `on` while loading avoids a flash of empty
 *  avatars during the first fetch. */
export function useImagesEnabled(): boolean {
  const { data } = useAppSettings()
  return data?.images_enabled !== false
}

export function useUpdateAppSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      api.patch<{ setting: { key: string; value: unknown } }>(`/app-settings/${key}`, { value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
