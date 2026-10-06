import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import './styles.css'

const ToolPage = lazy(() => import('./pages/ToolPage'))
const FaqPage = lazy(() => import('./pages/FaqPage'))
const RoadmapPage = lazy(() => import('./pages/RoadmapPage'))
const WorkflowsPage = lazy(() => import('./pages/WorkflowsPage'))

function RouteFallback() {
  return <div className="route-loading" role="status" aria-live="polite">Carregando…</div>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={<RouteFallback/>}>
        <Routes>
          <Route element={<Layout/>}>
            <Route path="/" element={<Home/>}/>
            <Route path="/faq" element={<FaqPage/>}/>
            <Route path="/roadmap" element={<RoadmapPage/>}/>
            <Route path="/workflows" element={<WorkflowsPage/>}/>
            <Route path="/tool/:id" element={<ToolPage/>}/>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>
)
