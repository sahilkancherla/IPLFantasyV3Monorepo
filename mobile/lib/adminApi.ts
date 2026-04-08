const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'
const ADMIN_SECRET = process.env.EXPO_PUBLIC_ADMIN_SECRET ?? ''

class AdminApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'AdminApiError'
  }
}

async function adminRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'X-Admin-Secret': ADMIN_SECRET }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { msg = ((await res.json()) as { error?: string })?.error ?? msg } catch {}
    throw new AdminApiError(res.status, msg)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const adminApi = {
  get:    <T>(path: string)                   => adminRequest<T>('GET',    path),
  post:   <T>(path: string, body: unknown)    => adminRequest<T>('POST',   path, body),
  patch:  <T>(path: string, body: unknown)    => adminRequest<T>('PATCH',  path, body),
  delete: <T>(path: string)                   => adminRequest<T>('DELETE', path),
}

/** Returns true if the user has the is_super_admin flag set in their profile. */
export function isSuperAdmin(user: { is_super_admin?: boolean } | null | undefined): boolean {
  return !!ADMIN_SECRET && !!user?.is_super_admin
}
