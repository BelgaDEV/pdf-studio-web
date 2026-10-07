import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Home, RefreshCw, TriangleAlert } from 'lucide-react'
import { APP_NAME, APP_VERSION } from '../lib/appMeta'

type Props = { children: ReactNode }
type State = { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : 'Falha inesperada na interface.'
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`[${APP_NAME} v${APP_VERSION}] erro de interface`, error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return <main className="fatal-error-page" role="alert">
      <div className="fatal-error-card">
        <span className="fatal-error-icon"><TriangleAlert size={30}/></span>
        <p className="kicker">RECUPERAÇÃO SEGURA</p>
        <h1>Algo saiu do esperado.</h1>
        <p>O PDF Studio interrompeu esta tela para evitar continuar em um estado inconsistente. Seus documentos não são enviados automaticamente por causa deste erro.</p>
        <div className="fatal-error-diagnostic"><strong>Diagnóstico local</strong><code>{this.state.message}</code><span>PDF Studio v{APP_VERSION}</span></div>
        <div className="fatal-error-actions">
          <button type="button" className="primary-btn" onClick={() => window.location.reload()}><RefreshCw size={17}/> Recarregar</button>
          <a className="secondary-btn" href="/"><Home size={17}/> Voltar ao início</a>
        </div>
      </div>
    </main>
  }
}
