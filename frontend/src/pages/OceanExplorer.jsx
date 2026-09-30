import React, { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import useOceanStore from '../state/useOceanStore'
import { predictPoint } from '../api/predict'
import { getHeatwaveStatus } from '../api/heatwave'
import { MdMyLocation } from 'react-icons/md'

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Custom ARGO float icon (pulsing green dot)
const argoIcon = L.divIcon({
  className: '',
  html: `<div style="width:12px;height:12px;border-radius:50%;background:#e0f2fe;
    box-shadow:0 0 8px #e0f2fe,0 0 16px rgba(14, 165, 233, 0.4);
    border:2px solid #38bdf8;"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

// Selected location icon
const selectedIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#0369a1;
    box-shadow:0 0 12px #0369a1,0 0 24px #0369a1;
    border:2px solid #0369a1;"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

const DEPTH_LEVELS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]
const LAYERS = ['SST', 'SSS', 'SLA', 'Currents', 'Wind Stress', 'Chlorophyll-a']

// Depth temp color scale (surface=warm, deep=cool)
function depthToColor(depth) {
  const scale = depth / 1000
  const r = Math.round(255 * (1 - scale))
  const g = Math.round(150 * (1 - scale) * 0.5)
  const b = Math.round(80 + 175 * scale)
  return `rgb(${r},${g},${b})`
}

function ClickHandler({ onSelect }) {
  useMapEvents({ click: (e) => onSelect(e.latlng.lat, e.latlng.lng) })
  return null
}

export default function OceanExplorer() {
  const { selectedLatLon, setSelectedLatLon, argoFloats, leadDays, selectedDate, setSelectedDate } = useOceanStore()
  const [activeLayer, setActiveLayer] = useState('SST')
  const [depthIdx, setDepthIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const selectedDepth = DEPTH_LEVELS[depthIdx]

  const handleMapClick = async (lat, lon) => {
    setSelectedLatLon({ lat, lon })
    setLoading(true)
    await predictPoint(lat, lon, selectedDate, leadDays)
    setLoading(false)
  }

  const INDIAN_OCEAN_CENTER = [17.5, 75]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Header */}
      <div style={{
        padding: '14px var(--space-lg)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, zIndex: 10,
      }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 21 }}>Ocean Explorer — 2D GIS</h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            Click anywhere in the ocean to run a depth-profile prediction
          </div>
        </div>
        <div className="flex items-center gap-md">
          {loading && (
            <div className="flex items-center gap-sm">
              <div className="spinner" style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: 13, color: '#0369a1' }}>Running inference…</span>
            </div>
          )}
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="input-field" style={{ width: 150, fontSize: 14 }} id="explorer-date" />
          <span style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>
            {argoFloats.length} ARGO Floats
          </span>
        </div>
      </div>

      {/* Layer toggles + Depth slider */}
      <div style={{
        padding: '10px var(--space-lg)',
        background: '#0369a1',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-lg)',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        <div className="flex items-center gap-sm">
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>LAYER</span>
          {LAYERS.map(l => (
            <button key={l} id={`layer-${l.replace(/\s+/g,'-').toLowerCase()}`}
              onClick={() => setActiveLayer(l)}
              className="btn" style={{
                padding: '4px 10px', fontSize: 12,
                background: activeLayer === l ? 'var(--cyan-ghost)' : 'transparent',
                color: activeLayer === l ? 'var(--cyan)' : 'var(--text-muted)',
                border: `1px solid ${activeLayer === l ? 'var(--border)' : 'transparent'}`,
              }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 280 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>DEPTH</span>
          <input id="depth-slider" type="range" min={0} max={DEPTH_LEVELS.length - 1}
            value={depthIdx} onChange={e => setDepthIdx(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{
            fontSize: 15, fontWeight: 700, color: depthToColor(selectedDepth),
            fontFamily: 'var(--font-mono)', minWidth: 55, textAlign: 'right',
          }}>
            {selectedDepth} m
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Showing: <span style={{ color: '#0369a1' }}>{activeLayer}</span> at <span style={{ color: depthToColor(selectedDepth) }}>{selectedDepth}m</span>
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={INDIAN_OCEAN_CENTER}
          zoom={5}
          style={{ height: '100%', width: '100%' }}
          minZoom={4}
          maxZoom={10}
          id="ocean-map"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
            opacity={0.8}
          />
          <ClickHandler onSelect={handleMapClick} />

          {/* Selected location marker */}
          {selectedLatLon && (
            <Marker position={[selectedLatLon.lat, selectedLatLon.lon]} icon={selectedIcon}>
              <Popup>
                <div style={{ fontFamily: 'var(--font-sans)', minWidth: 160 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedLatLon.lat.toFixed(2)}°N, {selectedLatLon.lon.toFixed(2)}°E
                  </div>
                  <div style={{ fontSize: 13, color: '#0369a1', marginTop: 4 }}>
                    Prediction point · {leadDays}d lead
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                    Click map to reselect
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* ARGO Float markers */}
          {argoFloats.map(float => (
            <Marker key={float.id} position={[float.lat, float.lon]} icon={argoIcon}>
              <Popup>
                <div style={{ fontFamily: 'var(--font-sans)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0369a1' }}>{float.id}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 3 }}>
                    {float.lat.toFixed(2)}°N, {float.lon.toFixed(2)}°E
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {float.date} · {float.depth_range}m range
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Colormap legend */}
        <div style={{
          position: 'absolute', right: 12, top: 12,
          background: 'var(--bg-card)', backdropFilter: 'blur(12px)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          padding: '12px 14px', zIndex: 1000, minWidth: 130,
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>
            {activeLayer}
          </div>
          <div style={{
            width: '100%', height: 8, borderRadius: 4,
            background: `linear-gradient(to right, ${depthIdx === 0 ? '#0369a1, #0369a1, #e0f2fe, #0369a1, #0369a1' : '#0369a1, #0369a1, #0369a1, #0369a1, #0369a1'})`,
            marginBottom: 6,
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{selectedDepth === 0 ? '10°C' : '1°C'}</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{selectedDepth === 0 ? '34°C' : '30°C'}</span>
          </div>
        </div>

        {/* Selected point info panel */}
        {selectedLatLon && (
          <div style={{
            position: 'absolute', left: 12, bottom: 12,
            background: 'var(--bg-card)', backdropFilter: 'blur(12px)',
            border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
            padding: '12px 16px', zIndex: 1000, minWidth: 220,
            boxShadow: 'var(--glow-sm)',
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
              Selected Point
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0369a1', fontFamily: 'var(--font-mono)' }}>
              {selectedLatLon.lat.toFixed(3)}°N, {selectedLatLon.lon.toFixed(3)}°E
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Lead time: <span style={{ color: '#0369a1' }}>{leadDays} days</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              Depth slice: <span style={{ color: depthToColor(selectedDepth) }}>{selectedDepth} m</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
