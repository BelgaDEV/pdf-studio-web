import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Configuração pública do Supabase.
 * A "publishable key" pode ficar no código do site: a proteção dos dados é
 * feita pelas regras de RLS no banco (supabase/migrations). A chave secreta
 * NUNCA entra aqui.
 */
export const SUPABASE_URL = 'https://hiefflqyowttbleoilzr.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_uJ-yXRJ6IXJ4xPdFdSKKwg_TOk6rIir'

const STORAGE_KEY = 'sb-hiefflqyowttbleoilzr-auth-token'

let clientPromise: Promise<SupabaseClient> | null = null

/** Carrega o cliente só quando necessário, para não pesar a página inicial. */
export function getSupabase(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: STORAGE_KEY },
      }),
    )
  }
  return clientPromise
}

/** Há indício de sessão salva (ou retorno de link de e-mail) neste navegador? */
export function mayHaveSession(): boolean {
  try {
    if (localStorage.getItem(STORAGE_KEY)) return true
  } catch { /* armazenamento bloqueado */ }
  const url = new URL(window.location.href)
  return url.searchParams.has('code') || url.hash.includes('access_token')
}
