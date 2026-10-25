import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { MiddlewareHandler } from 'hono'

export interface Env {
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
  KTOR_BASE_URL: string
  PORT: string
  COOKIE_SECRET?: string
}

export const createSupabaseClient = (url: string, key: string): SupabaseClient => {
  return createClient(url, key)
}

export const loadEnv = (): Env => {
  return {
    SUPABASE_URL: process.env.SUPABASE_URL ?? '',
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY ?? '',
    KTOR_BASE_URL: process.env.KTOR_BASE_URL ?? 'http://localhost:8099',
    PORT: process.env.PORT ?? '3000',
    COOKIE_SECRET: process.env.COOKIE_SECRET,
  }
}

export const withSupabase = (): MiddlewareHandler => {
  return async (c, next) => {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_PUBLISHABLE_KEY
    if (!url || !key) {
      return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }
    ;(c as unknown as { supabase?: SupabaseClient }).supabase = createSupabaseClient(url, key)
    await next()
  }
}
