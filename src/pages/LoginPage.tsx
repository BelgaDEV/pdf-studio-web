import { KeyRound, LogIn, Mail, UserPlus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getSupabase } from '../lib/supabase'

type Mode = 'entrar' | 'criar' | 'esqueci'

/** Traduz as mensagens mais comuns do Supabase Auth. */
export function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (/invalid login credentials/i.test(message)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(message)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.'
  if (/already registered|already been registered/i.test(message)) return 'Este e-mail já tem conta. Use “Entrar” ou “Esqueci minha senha”.'
  if (/password should be at least|weak password/i.test(message)) return 'A senha precisa ter pelo menos 8 caracteres, com letras e números.'
  if (/rate limit|too many/i.test(message)) return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'
  if (/invalid email|unable to validate email/i.test(message)) return 'Digite um e-mail válido.'
  if (/failed to fetch|network/i.test(message)) return 'Sem conexão com o servidor de login. Verifique sua internet.'
  return message || 'Não foi possível concluir. Tente novamente.'
}

export default function LoginPage() {
  const { session, ensureLoaded } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = params.get('next') || '/conta'
  const [mode, setMode] = useState<Mode>(params.get('modo') === 'criar' ? 'criar' : 'entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => { ensureLoaded() }, [ensureLoaded])
  useEffect(() => { if (session) navigate(next.startsWith('/') ? next : '/conta', { replace: true }) }, [session, next, navigate])

  function switchMode(nextMode: Mode) { setMode(nextMode); setError(''); setNotice('') }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(''); setNotice('')
    if (mode !== 'esqueci' && password.length < 8) { setError('A senha precisa ter pelo menos 8 caracteres.'); return }
    setBusy(true)
    try {
      const supabase = await getSupabase()
      const origin = window.location.origin
      if (mode === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else if (mode === 'criar') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${origin}/conta` } })
        if (error) throw error
        if (!data.session) setNotice('Conta criada! Enviamos um link de confirmação para o seu e-mail. Abra o link para ativar a conta.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${origin}/nova-senha` })
        if (error) throw error
        setNotice('Se houver uma conta com este e-mail, você vai receber um link para criar uma nova senha.')
      }
    } catch (e) {
      setError(authErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'entrar' ? 'Entrar na Lauda' : mode === 'criar' ? 'Criar conta grátis' : 'Recuperar senha'
  const Icon = mode === 'entrar' ? LogIn : mode === 'criar' ? UserPlus : KeyRound

  return <div className="info-page public-info-page auth-page">
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="auth-card-head"><span className="auth-icon"><Icon size={22}/></span><h1 id="auth-title">{title}</h1></div>
      {mode === 'criar' && <p className="auth-lead">Com a conta grátis você salva presets de tribunal e usa o Preparar documento.</p>}
      {mode === 'esqueci' && <p className="auth-lead">Digite o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>}
      <form onSubmit={submit} className="auth-form" noValidate>
        <label><span>E-mail</span><input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@escritorio.com.br"/></label>
        {mode !== 'esqueci' && <label><span>Senha</span><input type="password" autoComplete={mode === 'criar' ? 'new-password' : 'current-password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres"/></label>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {notice && <p className="auth-notice" role="status"><Mail size={16}/> {notice}</p>}
        <button type="submit" className="primary-btn" disabled={busy}>{busy ? 'Aguarde…' : mode === 'entrar' ? 'Entrar' : mode === 'criar' ? 'Criar conta' : 'Enviar link'}</button>
      </form>
      <div className="auth-switch">
        {mode === 'entrar' && <><button type="button" onClick={() => switchMode('esqueci')}>Esqueci minha senha</button><button type="button" onClick={() => switchMode('criar')}>Criar conta grátis</button></>}
        {mode === 'criar' && <button type="button" onClick={() => switchMode('entrar')}>Já tenho conta — entrar</button>}
        {mode === 'esqueci' && <button type="button" onClick={() => switchMode('entrar')}>Voltar para entrar</button>}
      </div>
      <p className="auth-foot">Seus PDFs continuam sendo processados no seu navegador. A conta guarda apenas e-mail e plano. <Link to="/privacy">Privacidade</Link></p>
    </section>
  </div>
}
