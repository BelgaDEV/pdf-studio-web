import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getSupabase, mayHaveSession } from './supabase'
import { userAccess, type AccessLevel, type Profile } from './plans'

type AuthState = {
  ready: boolean
  session: Session | null
  profile: Profile | null
  access: AccessLevel
  /** Garante que o cliente foi carregado (ex.: ao abrir uma ferramenta restrita). */
  ensureLoaded: () => void
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = await getSupabase()
  const { data, error } = await supabase.from('profiles').select('id,email,plan,premium_until').eq('id', userId).maybeSingle()
  if (error) {
    console.warn('Não foi possível carregar o perfil.', error)
    return null
  }
  return data as Profile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [wanted, setWanted] = useState(() => mayHaveSession())
  const [ready, setReady] = useState(() => !mayHaveSession())
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    if (!wanted) return
    let active = true
    let unsubscribe: (() => void) | undefined
    getSupabase().then(async supabase => {
      const { data } = await supabase.auth.getSession()
      if (!active) return
      setSession(data.session)
      setProfile(data.session ? await fetchProfile(data.session.user.id) : null)
      if (active) setReady(true)
      const sub = supabase.auth.onAuthStateChange((_event, next) => {
        setSession(next)
        if (!next) setProfile(null)
        else setTimeout(() => { fetchProfile(next.user.id).then(p => { if (active) setProfile(p) }) }, 0)
      })
      unsubscribe = () => sub.data.subscription.unsubscribe()
    }).catch(error => {
      console.warn('Login indisponível no momento.', error)
      if (active) setReady(true)
    })
    return () => { active = false; unsubscribe?.() }
  }, [wanted])

  const ensureLoaded = useCallback(() => {
    if (!wanted) { setReady(false); setWanted(true) }
  }, [wanted])

  const refreshProfile = useCallback(async () => {
    if (session) setProfile(await fetchProfile(session.user.id))
  }, [session])

  const signOut = useCallback(async () => {
    const supabase = await getSupabase()
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }, [])

  const value = useMemo<AuthState>(() => ({
    ready, session, profile,
    access: userAccess(Boolean(session), profile),
    ensureLoaded, refreshProfile, signOut,
  }), [ready, session, profile, ensureLoaded, refreshProfile, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>.')
  return ctx
}
