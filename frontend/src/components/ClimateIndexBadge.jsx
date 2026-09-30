import React, { useEffect, useState } from 'react'
import useOceanStore from '../state/useOceanStore'

export default function ClimateIndexBadge({ large = false }) {
  const { climate } = useOceanStore()
  const iod = climate?.iod ?? 0.42
  const nino = climate?.nino34 ?? -0.18

  const iodColor = iod > 0.4 ? 'var(--orange)' : iod < -0.4 ? 'var(--cyan)' : 'var(--green)'
  const ninoColor = nino > 0.5 ? 'var(--orange)' : nino < -0.5 ? 'var(--cyan)' : 'var(--green)'
  const iodPhase = iod > 0.4 ? 'Positive' : iod < -0.4 ? 'Negative' : 'Neutral'
  const ninoPhase = nino > 0.5 ? 'El Niño' : nino < -0.5 ? 'La Niña' : 'Neutral'

  if (large) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* IOD */}
        <div style={{
          padding: '12px 14px',
          background: `${iodColor}12`,
          border: `1px solid ${iodColor}30`,
          borderRadius: 'var(--radius-md)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Indian Ocean Dipole (DMI)
              </div>
              <div style={{ fontSize: 25, fontWeight: 700, color: iodColor, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {iod > 0 ? '+' : ''}{iod.toFixed(2)}
              </div>
            </div>
            <div style={{
              padding: '4px 10px', borderRadius: 'var(--radius-full)',
              background: `${iodColor}20`, color: iodColor,
              fontSize: 13, fontWeight: 600,
            }}>{iodPhase}</div>
          </div>
          {/* Bar */}
          <div style={{ marginTop: 8, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
            <div style={{
              height: '100%', width: `${Math.min(100, (iod + 2) / 4 * 100)}%`,
              background: iodColor, borderRadius: 2,
              transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
            }} />
          </div>
        </div>

        {/* ENSO / Niño 3.4 */}
        <div style={{
          padding: '12px 14px',
          background: `${ninoColor}12`,
          border: `1px solid ${ninoColor}30`,
          borderRadius: 'var(--radius-md)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                ENSO — Niño 3.4 Index
              </div>
              <div style={{ fontSize: 25, fontWeight: 700, color: ninoColor, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {nino > 0 ? '+' : ''}{nino.toFixed(2)}
              </div>
            </div>
            <div style={{
              padding: '4px 10px', borderRadius: 'var(--radius-full)',
              background: `${ninoColor}20`, color: ninoColor,
              fontSize: 13, fontWeight: 600,
            }}>{ninoPhase}</div>
          </div>
          <div style={{ marginTop: 8, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
            <div style={{
              height: '100%', width: `${Math.min(100, (nino + 2) / 4 * 100)}%`,
              background: ninoColor, borderRadius: 2,
              transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
            }} />
          </div>
        </div>
      </div>
    )
  }

  // Compact inline version
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{
        fontSize: 13, padding: '3px 8px', borderRadius: 'var(--radius-full)',
        background: `${iodColor}12`, color: iodColor,
        border: `1px solid ${iodColor}25`, fontWeight: 600,
        fontFamily: 'var(--font-mono)',
      }}>
        IOD {iod > 0 ? '+' : ''}{iod.toFixed(2)}
      </span>
      <span style={{
        fontSize: 13, padding: '3px 8px', borderRadius: 'var(--radius-full)',
        background: `${ninoColor}12`, color: ninoColor,
        border: `1px solid ${ninoColor}25`, fontWeight: 600,
        fontFamily: 'var(--font-mono)',
      }}>
        Niño3.4 {nino > 0 ? '+' : ''}{nino.toFixed(2)}
      </span>
    </div>
  )
}
