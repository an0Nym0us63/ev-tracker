// ─── Token management ─────────────────────────────────────────────────────────
const TOKEN_KEY = 'ev-token'

export function getToken()          { return localStorage.getItem(TOKEN_KEY) }
export function setToken(t)         { localStorage.setItem(TOKEN_KEY, t) }
export function clearToken()        { localStorage.removeItem(TOKEN_KEY) }

// ─── Base fetch ───────────────────────────────────────────────────────────────
async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erreur serveur')
  return data
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function apiRegister({ name, password, vehicleId }) {
  const data = await req('POST', '/api/auth/register', { name, password, vehicleId })
  setToken(data.token)
  return data.account
}

export async function apiLogin({ name, password }) {
  const data = await req('POST', '/api/auth/login', { name, password })
  setToken(data.token)
  return data.account
}

export async function apiMe() {
  return req('GET', '/api/auth/me')
}

// ─── Charges ──────────────────────────────────────────────────────────────────
export async function apiGetCharges()       { return req('GET',    '/api/charges') }
export async function apiAddCharge(c)       { return req('POST',   '/api/charges', c) }
export async function apiUpdateCharge(id,c) { return req('PUT',    `/api/charges/${id}`, c) }
export async function apiDeleteCharge(id)   { return req('DELETE', `/api/charges/${id}`) }

// ─── Lists ────────────────────────────────────────────────────────────────────
export async function apiGetLists() { return req('GET', '/api/lists') }
