import React, { useState } from 'react'
import { MdUnfoldMore, MdUnfoldLess, MdKeyboardArrowDown, MdKeyboardArrowUp } from 'react-icons/md'

/**
 * HoverExpandablePanel:
 * Dual functionality container:
 * 1. Corner Minimize / Expand button transforms text and toggles pinned state.
 *    - When pinned open: shows "Minimize". Clicking collapses to compact bar and changes label to "Expand".
 *    - When in compact mode: shows "Expand". Clicking locks panel open and changes label to "Minimize".
 * 2. When in compact mode, hovering over the bar automatically expands it to preview full content,
 *    and moving the mouse away smoothly contracts it back to the bar.
 * 3. In compact bar format, displays the Top 3 to 5 most important parameters with live values and color badges!
 */
export default function HoverExpandablePanel({
  id,
  title,
  subtitle,
  icon: Icon,
  badge,
  compactMetrics = [], // [{ label, val, color, note }]
  children,
  defaultMinimized = false,
  className = '',
  style = {},
}) {
  // 'pinned' means kept permanently expanded by the user
  // 'compact' means minimized to bar, with auto-expand on hover
  const [isPinned, setIsPinned] = useState(!defaultMinimized)
  const [isHovered, setIsHovered] = useState(false)
  const [suppressHover, setSuppressHover] = useState(false)

  // Expanded if pinned OR if hovering while in compact mode (unless suppressed right after clicking minimize)
  const isExpanded = isPinned || (isHovered && !suppressHover)

  const handleToggleClick = (e) => {
    e.stopPropagation()
    if (isPinned) {
      // User explicitly clicked Minimize: collapse immediately and suppress hover until mouse leaves
      setIsPinned(false)
      setSuppressHover(true)
    } else {
      // User clicked Expand: lock it open
      setIsPinned(true)
      setSuppressHover(false)
    }
  }

  const handleMouseEnter = () => {
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setSuppressHover(false) // Reset suppression once mouse leaves
  }

  return (
    <div
      id={id}
      className={`glass-card hover-expandable-panel ${isExpanded ? 'expanded' : 'compact'} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        borderRadius: 20,
        border: isExpanded ? '1px solid var(--border-strong)' : '1px solid var(--border)',
        background: isExpanded ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        boxShadow: isExpanded ? 'var(--shadow-lg)' : 'var(--shadow-card)',
        transition: 'all 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        marginBottom: 16,
        color: 'var(--text-primary)',
        ...style,
      }}
    >
      {/* Panel Header Bar */}
      <div
        style={{
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
          cursor: !isPinned ? 'pointer' : 'default',
          background: isExpanded ? 'rgba(2, 6, 23, 0.4)' : 'transparent',
          userSelect: 'none',
          transition: 'background 0.2s ease',
        }}
        onClick={() => {
          if (!isPinned) {
            setIsPinned(true)
            setSuppressHover(false)
          }
        }}
      >
        {/* Left: Title & Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 19, fontWeight: 800, color: '#ffffff', letterSpacing: '0.01em' }}>
                {title}
              </span>
            </div>
            {isExpanded && subtitle && (
              <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 2 }}>{subtitle}</div>
            )}
          </div>
        </div>

        {/* Center: Top 3 to 5 Most Important Parameters (Prominently displayed in compact bar format) */}
        {!isExpanded && compactMetrics.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, overflowX: 'auto',
            padding: '4px 10px', flex: 1, justifyContent: 'center',
          }}>
            {compactMetrics.slice(0, 5).map((m, idx) => (
              <div
                key={idx}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '6px 14px', borderRadius: 10,
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: `1px solid ${m.color ? m.color + '55' : 'rgba(56, 189, 248, 0.3)'}`,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                  whiteSpace: 'nowrap'
                }}
              >
                <span style={{ color: '#94a3b8', fontSize: 14, fontWeight: 600 }}>{m.label}:</span>
                <span style={{ color: m.color || '#38bdf8', fontSize: 17, fontWeight: 800, fontFamily: 'monospace' }}>
                  {m.val}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Right: Corner Minimize / Expand Button with label transformation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {!isPinned && (
            <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', display: 'none' }}>
              Hover to preview
            </span>
          )}
          <button
            onClick={handleToggleClick}
            title={isPinned ? 'Click to minimize to compact bar' : 'Click to expand permanently (or hover to preview)'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 10,
              background: 'rgba(56, 189, 248, 0.14)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: '#38bdf8',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 0 10px rgba(56, 189, 248, 0.15)',
              transition: 'all 0.18s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(56, 189, 248, 0.25)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(56, 189, 248, 0.14)'
            }}
          >
            {isPinned ? (
              <>
                
                <span>Minimize</span>
              </>
            ) : (
              <>
                
                <span>Expand</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content Body */}
      {isExpanded && (
        <div style={{
          padding: '16px 20px',
          animation: 'fadeIn 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          borderTop: '1px solid rgba(56, 189, 248, 0.2)'
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

