import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import Home from './pages/Home'
import './styles.css'

const ToolPage = lazy(() => import('./pages/ToolPage'))
const FaqPage = lazy(() => import('./pages/FaqPage'))
const RoadmapPage = lazy(() => import('./pages/RoadmapPage'))
const WorkflowsPage = lazy(() => import('./pages/WorkflowsPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const LicensesPage = lazy(() => import('./pages/LicensesPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

function RouteFallback() {
  return <div className="route-loading" role="status" aria-live="polite">Carregando…</div>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback/>}>
          <Routes>
            <Route element={<Layout/>}>
              <Route path="/" element={<Home/>}/>
              <Route path="/faq" element={<FaqPage/>}/>
              <Route path="/roadmap" element={<RoadmapPage/>}/>
              <Route path="/workflows" element={<WorkflowsPage/>}/>
              <Route path="/privacy" element={<PrivacyPage/>}/>
              <Route path="/terms" element={<TermsPage/>}/>
              <Route path="/licenses" element={<LicensesPage/>}/>
              <Route path="/contact" element={<ContactPage/>}/>
              <Route path="/tool/:id" element={<ToolPage/>}/>
              <Route path="*" element={<NotFoundPage/>}/>
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
)
