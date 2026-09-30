import React, { useState } from 'react'
import { MdUnfoldMore, MdUnfoldLess } from 'react-icons/md'

/**
 * HoverExpandablePanel:
 * Click-toggle maximize/minimize with compact bar showing top parameters.
 * - Top-right corner button toggles between expanded and compact states
 * - Compact bar shows the top 3–5 key parameters in a clean horizontal layout
 * - Lightish blue background instead of pure white
 */
export default function HoverExpandablePanel({
  id,
  title,
  subtitle,
  icon: Icon,
  badge,
  compactMetrics = [],
  children,
  defaultMinimized = false,
  className = '',
  style = {},
}) {
  const [isExpanded, setIsExpanded] = useState(!defaultMinimized)

  return (
    <div
      id={id}
      className={`glass-card expandable-panel ${isExpanded ? 'expanded' : 'compact'} ${className}`}
      style={{
        borderRadius: 18,
        border: '1px solid #0369a1',
        background: 'linear-gradient(145deg, #0369a1 0%, #0369a1 100%)',
        backdropFilter: 'blur(16px)',
        boxShadow: isExpanded
          ? '0 12px 30px -4px rgba(14, 165, 233, 0.10), 0 2px 8px rgba(0, 0, 0, 0.03)'
          : '0 4px 14px -2px rgba(14, 165, 233, 0.07)',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        marginBottom: 14,
        color: '#0f172a',
        width: '100%',
        ...style,
      }}
    >
      {/* Panel Header Bar */}
      <div
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          borderBottom: isExpanded ? '1px solid #0369a1' : 'none',
          background: isExpanded
            ? 'linear-gradient(90deg, #0369a1 0%, #0369a1 100%)'
            : 'transparent',
          cursor: !isExpanded ? 'pointer' : 'default',
          userSelect: 'none',
          transition: 'background 0.2s ease',
        }}
        onClick={() => { if (!isExpanded) setIsExpanded(true) }}
      >
        {/* Left: Icon & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, minWidth: 0 }}>
          {Icon && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 9,
              background: '#0369a1', border: '1px solid #0369a1', color: '#0369a1',
              flexShrink: 0,
            }}>
              <Icon size={18} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 17, fontWeight: 700, color: '#0f172a',
                letterSpacing: '0.01em', whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {title}
              </span>
              {badge && (
                <span style={{
                  fontSize: 13, fontFamily: 'monospace', fontWeight: 700, padding: '1px 8px',
                  borderRadius: 6, background: '#0369a1',
                  border: '1px solid #0369a1', color: '#0369a1', whiteSpace: 'nowrap',
                }}>
                  {badge}
                </span>
              )}
            </div>
            {isExpanded && subtitle && (
              <div style={{ fontSize: 14, color: '#475569', marginTop: 2 }}>{subtitle}</div>
            )}
          </div>
        </div>

        {/* Center: Compact Metrics (only when minimized) */}
        {!isExpanded && compactMetrics.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto',
            flex: 1, justifyContent: 'center', padding: '0 8px',
          }}>
            {compactMetrics.slice(0, 5).map((m, idx) => (
              <div
                key={idx}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 8,
                  background: 'rgba(255, 255, 255, 0.85)',
                  border: `1px solid ${m.color ? m.color + '40' : '#0369a1'}`,
                  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>{m.label}:</span>
                <span style={{ color: m.color || '#0284c7', fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-mono, monospace)' }}>
                  {m.val}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Right: Toggle Button */}
        <button
          onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
          title={isExpanded ? 'Minimize panel' : 'Expand panel'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 8,
            background: isExpanded ? '#f1f5f9' : '#0369a1',
            border: isExpanded ? '1px solid #cbd5e1' : '1px solid #0369a1',
            color: '#0369a1',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            boxShadow: isExpanded ? 'none' : '0 0 8px rgba(14, 165, 233, 0.2)',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = isExpanded ? '#e2e8f0' : '#0369a1' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = isExpanded ? '#f1f5f9' : '#0369a1' }}
        >
          {isExpanded ? (
            <><MdUnfoldLess size={15} /><span>Minimize</span></>
          ) : (
            <><MdUnfoldMore size={15} /><span>Expand</span></>
          )}
        </button>
      </div>

      {/* Content Body */}
      {isExpanded && (
        <div style={{
          padding: '14px 18px',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}
