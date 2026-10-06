import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import ToolPage from './pages/ToolPage'
import FaqPage from './pages/FaqPage'
import RoadmapPage from './pages/RoadmapPage'
import WorkflowsPage from './pages/WorkflowsPage'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout/>}>
          <Route path="/" element={<Home/>}/>
          <Route path="/faq" element={<FaqPage/>}/>
          <Route path="/roadmap" element={<RoadmapPage/>}/>
          <Route path="/workflows" element={<WorkflowsPage/>}/>
          <Route path="/tool/:id" element={<ToolPage/>}/>
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
