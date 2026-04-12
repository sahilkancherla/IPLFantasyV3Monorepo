const BACKEND_URL = process.env.BACKEND_URL
const SYNC_SECRET = process.env.SYNC_SECRET

export async function handler() {
  const res = await fetch(`${BACKEND_URL}/scores/auto-sync`, {
    method: 'POST',
    headers: {
      'x-sync-secret': SYNC_SECRET,
    },
  })
  const body = await res.json()
  console.log('auto-sync response:', JSON.stringify(body))
  if (!res.ok) throw new Error(`auto-sync failed: ${res.status} ${JSON.stringify(body)}`)
  return body
}
