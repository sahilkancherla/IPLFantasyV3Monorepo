const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000'

async function apiFetch(path: string, secret: string, options?: RequestInit & { noContentType?: boolean }): Promise<unknown> {
  const { noContentType, ...rest } = options ?? {}
  const headers: Record<string, string> = { 'X-Admin-Secret': secret }
  if (!noContentType) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: { ...headers, ...rest.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  get:    (path: string, secret: string) =>
    apiFetch(path, secret),
  post:   (path: string, secret: string, body: unknown) =>
    apiFetch(path, secret, { method: 'POST', body: JSON.stringify(body) }),
  put:    (path: string, secret: string, body: unknown) =>
    apiFetch(path, secret, { method: 'PUT', body: JSON.stringify(body) }),
  patch:  (path: string, secret: string, body: unknown) =>
    apiFetch(path, secret, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string, secret: string) =>
    apiFetch(path, secret, { method: 'DELETE', noContentType: true }),
}
