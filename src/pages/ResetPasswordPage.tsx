import { KeyRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getSupabase } from '../lib/supabase'
import { authErrorMessage } from './LoginPage'

export default function ResetPasswordPage() {
  const { session, ready, ensureLoaded } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { ensureLoaded() }, [ensureLoaded])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (password.length < 8) { setError('A senha precisa ter pelo menos 8 caracteres.'); return }
    if (password !== confirm) { setError('As senhas digitadas não são iguais.'); return }
    setBusy(true)
    try {
      const supabase = await getSupabase()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      navigate('/conta?senha=ok', { replace: true })
    } catch (e) {
      setError(authErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return <div className="info-page public-info-page auth-page">
    <section className="auth-card" aria-labelledby="reset-title">
      <div className="auth-card-head"><span className="auth-icon"><KeyRound size={22}/></span><h1 id="reset-title">Criar nova senha</h1></div>
      {!ready && <p className="auth-lead" role="status">Validando o link…</p>}
      {ready && !session && <>
        <p className="auth-error" role="alert">Este link expirou ou já foi usado.</p>
        <Link className="primary-btn" to="/entrar">Pedir um novo link</Link>
      </>}
      {ready && session && <form onSubmit={submit} className="auth-form" noValidate>
        <label><span>Nova senha</span><input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}/></label>
        <label><span>Repita a nova senha</span><input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)}/></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="submit" className="primary-btn" disabled={busy}>{busy ? 'Salvando…' : 'Salvar nova senha'}</button>
      </form>}
    </section>
  </div>
}
