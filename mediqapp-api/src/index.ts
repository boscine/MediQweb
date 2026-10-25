import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { loadEnv } from './supabase'
import { parse, serialize } from 'cookie'

const env = loadEnv()
const KTOR_BASE_URL = env.KTOR_BASE_URL.replace(/\/$/, '')
const PORT = Number(env.PORT)
const REFRESH_COOKIE_NAME = 'mediq_refresh_token'
const REFRESH_COOKIE_PATH = '/auth'
const REFRESH_COOKIE_DOMAIN = 'localhost'
const COOKIE_SECURE = process.env.NODE_ENV === 'production'

const app = new Hono()

app.use('*', cors({ origin: 'http://localhost:4200', credentials: true }))

// ---- Health ----
app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

// ---- Helpers ----
const setRefreshCookie = (headers: Headers, token: string, maxAgeSeconds: number) => {
  headers.append(
    'set-cookie',
    serialize(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      domain: REFRESH_COOKIE_DOMAIN,
      maxAge: maxAgeSeconds,
    }),
  )
}

const clearRefreshCookie = (headers: Headers) => {
  headers.append(
    'set-cookie',
    serialize(REFRESH_COOKIE_NAME, '', {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      domain: REFRESH_COOKIE_DOMAIN,
      maxAge: 0,
    }),
  )
}

const getRefreshCookie = (cookieHeader: string | undefined): string | null => {
  if (!cookieHeader) return null
  const cookies = parse(cookieHeader)
  return cookies[REFRESH_COOKIE_NAME] ?? null
}

const proxyJson = async (url: string, init: RequestInit): Promise<Response> => {
  return fetch(url, init)
}

// ---- Auth: sign-in (proxy to Ktor, set HttpOnly refresh cookie) ----
app.post('/auth/sign-in', async (c) => {
  const body = await c.req.json<{ username?: string; password?: string }>()
  const username = body.username
  const password = body.password

  if (!username || !password) {
    return c.json({ error: 'username and password are required' }, 400)
  }

  let ktorRes: Response
  try {
    ktorRes = await proxyJson(`${KTOR_BASE_URL}/auth/sign-in`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
  } catch {
    return c.json({ error: 'auth service unreachable' }, 502)
  }

  if (!ktorRes.ok) {
    return c.json({ error: 'invalid credentials' }, 401)
  }

  const session = (await ktorRes.json()) as {
    accessToken: string
    expiresAt: string
    refreshToken: string
    refreshExpiresAt: string
    profile: unknown
  }

  const refreshExpiresAt = new Date(session.refreshExpiresAt).getTime()
  const maxAgeSeconds = Math.max(0, Math.floor((refreshExpiresAt - Date.now()) / 1000))

  const headers = new Headers()
  setRefreshCookie(headers, session.refreshToken, maxAgeSeconds)

  return new Response(
    JSON.stringify({
      accessToken: session.accessToken,
      expiresAt: session.expiresAt,
      profile: session.profile,
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
        ...Object.fromEntries(headers.entries()),
      },
    },
  )
})

// ---- Auth: refresh (rotate access token via refresh cookie) ----
app.post('/auth/refresh', async (c) => {
  const refreshToken = getRefreshCookie(c.req.header('cookie'))
  if (!refreshToken) {
    return c.json({ error: 'no refresh token' }, 401)
  }

  let ktorRes: Response
  try {
    ktorRes = await proxyJson(`${KTOR_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${refreshToken}`,
      },
    })
  } catch {
    return c.json({ error: 'auth service unreachable' }, 502)
  }

  if (!ktorRes.ok) {
    const clearHeaders = new Headers()
    clearRefreshCookie(clearHeaders)
    return new Response(
      JSON.stringify({ error: 'invalid refresh token' }),
      {
        status: 401,
        headers: {
          'content-type': 'application/json',
          ...Object.fromEntries(clearHeaders.entries()),
        },
      },
    )
  }

  const session = (await ktorRes.json()) as {
    accessToken: string
    expiresAt: string
    refreshToken: string
    refreshExpiresAt: string
    profile: unknown
  }

  const refreshExpiresAt = new Date(session.refreshExpiresAt).getTime()
  const maxAgeSeconds = Math.max(0, Math.floor((refreshExpiresAt - Date.now()) / 1000))

  const headers = new Headers()
  setRefreshCookie(headers, session.refreshToken, maxAgeSeconds)

  return new Response(
    JSON.stringify({
      accessToken: session.accessToken,
      expiresAt: session.expiresAt,
      profile: session.profile,
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
        ...Object.fromEntries(headers.entries()),
      },
    },
  )
})

// ---- Profile: GET /me (validate access token via Ktor /profile) ----
app.get('/me', async (c) => {
  const authHeader = c.req.header('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'authentication required' }, 401)
  }
  const accessToken = authHeader.slice('Bearer '.length)

  let ktorRes: Response
  try {
    ktorRes = await proxyJson(`${KTOR_BASE_URL}/profile`, {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}` },
    })
  } catch {
    return c.json({ error: 'auth service unreachable' }, 502)
  }

  if (ktorRes.status === 401 || ktorRes.status === 403) {
    return c.json({ error: 'invalid or expired access token' }, 401)
  }
  if (!ktorRes.ok) {
    return c.json({ error: 'profile unavailable' }, 502)
  }

  const profile = await ktorRes.json()
  return c.json(profile)
})

// ---- Start ----
serve({ fetch: app.fetch, port: PORT })

export default app
