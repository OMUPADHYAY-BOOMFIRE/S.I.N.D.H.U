import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { MdChevronRight, MdChevronLeft } from 'react-icons/md'

import useOceanStore from '../state/useOceanStore'

const NAV_ITEMS = [
  { to: '/',              label: 'S.I.N.D.H.U',     id: 'nav-landing',   sectionId: 'section-hero' },
  { to: '/dashboard',     label: 'Dashboard',        id: 'nav-dashboard', sectionId: 'section-dashboard' },
  { to: '/digital-twin',  label: 'Digital Twin',     id: 'nav-twin',      sectionId: 'section-twin' },
  { to: '/analysis',      label: 'Profiler',         id: 'nav-analysis',  sectionId: 'section-profiler' },
  { to: '/heatwaves',     label: 'Marine MHW',       id: 'nav-heatwaves', sectionId: 'section-heatwaves' },
  { to: '/model-spec',    label: 'Model Console',    id: 'nav-model',     sectionId: 'section-modelspec' },
  { to: '/catalog',       label: 'Data Catalog',     id: 'nav-catalog' },
]

const SECTION_TO_NAV_TO = {
  'section-hero': '/',
  'section-video': '/',
  'section-dashboard': '/dashboard',
  'section-twin': '/digital-twin',
  'section-profiler': '/analysis',
  'section-heatwaves': '/heatwaves',
  'section-modelspec': '/model-spec',
}

export default function NavBar() {
  const [expanded, setExpanded] = useState(false)
  const location = useLocation()
  const activeLandingSection = useOceanStore((s) => s.activeLandingSection)
  const isLandingPage = location.pathname === '/'

  const handleNavClick = (e, item) => {
    if (isLandingPage && item.sectionId) {
      const el = document.getElementById(item.sectionId)
      if (el) {
        e.preventDefault()
        el.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }

  return (
    <nav
      id="main-navbar"
      style={{
        position: 'fixed',
        left: 0, top: 0, bottom: 0,
        width: expanded ? 'var(--nav-width-exp)' : 'var(--nav-width)',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(56, 189, 248, 0.25)',
        boxShadow: '4px 0 25px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        transition: 'width var(--transition-base)',
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div style={{
        padding: '18px 16px',
        borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 'var(--header-h)',
        flexShrink: 0,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 12,
          background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: 20, fontWeight: 800, color: '#ffffff',
          boxShadow: '0 4px 15px rgba(2, 132, 199, 0.35)',
        }}>
          S
        </div>
        {expanded && (
          <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#ffffff', letterSpacing: '0.02em' }}>
              S.I.N.D.H.U
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2, fontWeight: 600 }}>
              SIH26066 · MoES / INCOIS
            </div>
          </div>
        )}
      </div>

      {/* Nav Links */}
      <div style={{ flex: 1, padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {NAV_ITEMS.map((item) => {
          const { to, label, id } = item
          const isActive = isLandingPage
            ? (SECTION_TO_NAV_TO[activeLandingSection] === to || (to === '/' && !SECTION_TO_NAV_TO[activeLandingSection]))
            : (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to))

          return (
            <NavLink
              key={to}
              to={to}
              id={id}
              onClick={(e) => handleNavClick(e, item)}
              style={() => ({
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '12px 18px',
                margin: '0 8px',
                borderRadius: 12,
                textDecoration: 'none',
                color: isActive ? '#38bdf8' : '#94a3b8',
                background: isActive ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
                border: isActive ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                transition: 'all var(--transition-fast)',
                fontWeight: isActive ? 800 : 600,
                fontSize: 16,
                whiteSpace: 'nowrap',
                boxShadow: isActive ? '0 4px 14px rgba(2, 132, 199, 0.12)' : 'none',
              })}
            >
              <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: 11, color: isActive ? '#38bdf8' : '#94a3b8', letterSpacing: '0.04em' }}>{label.slice(0,2).toUpperCase()}</span>
              {expanded && <span>{label}</span>}
            </NavLink>
          )
        })}
      </div>

      {/* Demo Mode Badge */}
      {expanded && (
        <div style={{
          padding: '12px 16px',
          margin: '0 8px 8px',
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid rgba(186, 220, 255, 0.95)',
          boxShadow: '0 2px 8px rgba(2, 28, 76, 0.04)',
          display: 'flex', alignItems: 'center', gap: 10,
          flexShrink: 0,
        }}>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 13, color: '#38bdf8', fontWeight: 800 }}>SCIENTIFIC DEMO MODE</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2, fontWeight: 500 }}>Deep Ocean Engine Active</div>
          </div>
        </div>
      )}

      {/* Toggle */}
      <button
        id="nav-toggle-btn"
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '14px 16px', background: 'transparent', border: 'none',
          borderTop: '1px solid rgba(186, 220, 255, 0.8)', cursor: 'pointer',
          color: '#64748b', flexShrink: 0,
          transition: 'color var(--transition-fast)',
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#0284c7'}
        onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
      >
        {expanded ? <MdChevronLeft size={24} /> : <MdChevronRight size={24} />}
      </button>
    </nav>
  )
}
