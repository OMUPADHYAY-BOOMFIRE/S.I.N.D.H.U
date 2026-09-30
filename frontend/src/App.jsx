import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import NavBar from './components/NavBar.jsx'
import GlobalInputCockpit from './components/GlobalInputCockpit.jsx'

import OceanWaveBackground from './components/OceanWaveBackground.jsx'


// Lazy-load all pages for fast initial load
const LandingPage         = lazy(() => import('./pages/LandingPage.jsx'))
const Dashboard           = lazy(() => import('./pages/Dashboard.jsx'))
const SubsurfaceDigitalTwin = lazy(() => import('./pages/SubsurfaceDigitalTwin.jsx'))
const VirtualProfiler     = lazy(() => import('./pages/VirtualProfiler.jsx'))
const MarineHeatwaves     = lazy(() => import('./pages/MarineHeatwaves.jsx'))
const ModelSpecification  = lazy(() => import('./pages/ModelSpecification.jsx'))
const DataCatalog         = lazy(() => import('./pages/DataCatalog.jsx'))

function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', flexDirection: 'column', gap: 16,
    }}>
      <div className="spinner" />
      <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Loading module…</div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        {/* Global animated ocean background */}
        <OceanWaveBackground />

        {/* Sidebar Navigation */}
        <NavBar />

        {/* Global Floating Input Cockpit (Top-Right Fixed across all pages) */}
        <GlobalInputCockpit />

        {/* Main Content Area */}
        <main className="main-content" style={{ position: 'relative', zIndex: 1 }}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Landing Page as initial starting point */}
              <Route path="/"             element={<LandingPage />} />
              <Route path="/dashboard"    element={<Dashboard />} />
              {/* /explorer merged into digital-twin — redirect automatically */}
              <Route path="/explorer"     element={<Navigate to="/digital-twin" replace />} />
              <Route path="/digital-twin" element={<SubsurfaceDigitalTwin />} />
              <Route path="/analysis"     element={<VirtualProfiler />} />
              <Route path="/heatwaves"    element={<MarineHeatwaves />} />
              <Route path="/model-spec"   element={<ModelSpecification />} />
              <Route path="/catalog"      element={<DataCatalog />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  )
}
