import React, { useEffect, useState, useMemo } from 'react'
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Cell
} from 'recharts'
import useOceanStore from '../state/useOceanStore'
import { getHeatwaveStatus, getHeatwaveTimeSeries } from '../api/heatwave'
import { calculateOceanParameters } from '../engine/oceanEngine'
import { OceanPercentGauge, OceanWaveLineChart } from '../components/InfographicCharts'
import HoverExpandablePanel from '../components/HoverExpandablePanel'

const CAT_CONFIG = {
  0: { label: 'Normal',   color: '#00ff88', bg: 'rgba(0, 255, 136, 0.12)', border: 'rgba(0, 255, 136, 0.3)' },
  1: { label: 'Moderate', color: '#ffeb3b', bg: 'rgba(255, 235, 59, 0.12)', border: 'rgba(255, 235, 59, 0.3)' },
  2: { label: 'Strong',   color: '#ff6b35', bg: 'rgba(255, 107, 53, 0.15)', border: 'rgba(255, 107, 53, 0.4)' },
  3: { label: 'Severe',   color: '#ff4757', bg: 'rgba(255, 71, 87, 0.18)', border: 'rgba(255, 71, 87, 0.4)' },
  4: { label: 'Extreme',  color: '#0369a1', bg: 'rgba(192, 132, 252, 0.2)', border: 'rgba(192, 132, 252, 0.4)' },
}

const DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]

const DEFAULT_TIME_SERIES = [
  { month: 'Jan', sst_anomaly: 0.12, category: 0 },
  { month: 'Feb', sst_anomaly: 0.24, category: 0 },
  { month: 'Mar', sst_anomaly: 0.45, category: 0 },
  { month: 'Apr', sst_anomaly: 0.78, category: 1 },
  { month: 'May', sst_anomaly: 1.25, category: 1 },
  { month: 'Jun', sst_anomaly: 1.82, category: 2 },
  { month: 'Jul', sst_anomaly: 2.14, category: 2 },
  { month: 'Aug', sst_anomaly: 1.95, category: 2 },
  { month: 'Sep', sst_anomaly: 1.38, category: 1 },
  { month: 'Oct', sst_anomaly: 0.88, category: 1 },
  { month: 'Nov', sst_anomaly: 0.48, category: 0 },
  { month: 'Dec', sst_anomaly: 0.21, category: 0 },
]

function buildDepthAnomalyData(surfaceAnomaly = 1.8) {
  return DEPTHS.map((d) => ({
    depth: d,
    anomaly: +(Math.max(0, surfaceAnomaly * Math.exp(-d / 85) + Math.sin(d * 0.04) * 0.015)).toFixed(3),
    threshold: 0.6,
  }))
}

const BASIN_HOTSPOTS = [
  { region: 'Arabian Sea NW',      lat: 20.0, lon: 60.0, cat: 2, anomaly: 1.85, sst: 30.9, duration: 14, extent: 148000, dhw: 5.2 },
  { region: 'Arabian Sea Central', lat: 14.0, lon: 65.0, cat: 1, anomaly: 1.15, sst: 30.1, duration: 9,  extent: 85000,  dhw: 3.1 },
  { region: 'Bay of Bengal North', lat: 18.0, lon: 88.0, cat: 3, anomaly: 2.45, sst: 31.6, duration: 21, extent: 215000, dhw: 9.4 },
  { region: 'Bay of Bengal South', lat: 8.0,  lon: 86.0, cat: 1, anomaly: 0.95, sst: 29.8, duration: 7,  extent: 62000,  dhw: 2.0 },
  { region: 'Equatorial Warm Pool',lat: 3.0,  lon: 75.0, cat: 0, anomaly: 0.25, sst: 29.3, duration: 3,  extent: 32000,  dhw: 0.5 },
  { region: 'Somali Upwelling Margin', lat: 9.5, lon: 53.5, cat: 2, anomaly: 1.70, sst: 28.5, duration: 16, extent: 110000, dhw: 4.8 }
]

export default function MarineHeatwaves() {
  const store = useOceanStore()
  const selectedLatLon = store?.selectedLatLon || { lat: 11.83, lon: 66.78 }
  const setSelectedLatLon = store?.setSelectedLatLon || (() => {})

  const [activeHotspotIdx, setActiveHotspotIdx] = useState(0)
  const [currentHw, setCurrentHw] = useState(() => BASIN_HOTSPOTS[0])
  const [timeSeries, setTimeSeries] = useState(DEFAULT_TIME_SERIES)
  const [depthData, setDepthData] = useState(() => buildDepthAnomalyData(1.85))

  // Sync when active location or preset changes
  useEffect(() => {
    let isMounted = true
    const lat = selectedLatLon?.lat ?? 15.50
    const lon = selectedLatLon?.lon ?? 66.20
    const date = store?.selectedDate ?? '2026-09-27'

    // Immediate reactive compute from engine
    const engineRes = calculateOceanParameters(lat, lon, date, 14)
    if (engineRes?.heatwave) {
      const hw = engineRes.heatwave
      setCurrentHw(prev => ({
        ...prev,
        name: prev.name || 'Active Ocean Point',
        lat, lon,
        anomaly: hw.sst_anomaly,
        sst: hw.current_sst,
        duration: hw.duration_days,
        extent: hw.spatial_extent_km2,
        cat: hw.category,
      }))
      setDepthData(buildDepthAnomalyData(hw.sst_anomaly))
    }

    getHeatwaveStatus(lat, lon)
      .then(res => {
        if (isMounted && res) {
          setCurrentHw(prev => ({
            ...prev,
            ...res,
            anomaly: res.sst_anomaly ?? prev.anomaly,
            sst: res.current_sst ?? prev.sst,
            duration: res.duration_days ?? prev.duration,
            extent: res.spatial_extent_km2 ?? prev.extent,
            cat: res.category ?? prev.cat
          }))
          if (res.sst_anomaly != null) {
            setDepthData(buildDepthAnomalyData(res.sst_anomaly))
          }
        }
      })
      .catch(() => {})

    getHeatwaveTimeSeries(lat, lon, 2024)
      .then(d => {
        if (isMounted && d) {
          const arr = Array.isArray(d) ? d : (d?.series || [])
          if (arr.length > 0) {
            setTimeSeries(arr)
          }
        }
      })
      .catch(() => {})

    return () => { isMounted = false }
  }, [selectedLatLon, store?.selectedDate])

  const handleSelectHotspot = (index) => {
    setActiveHotspotIdx(index)
    const spot = BASIN_HOTSPOTS[index]
    setCurrentHw(spot)
    setSelectedLatLon({ lat: spot.lat, lon: spot.lon })
    setDepthData(buildDepthAnomalyData(spot.anomaly))

    // Scale time series anomaly in proportion to selected spot anomaly
    const scale = spot.anomaly / 1.8
    setTimeSeries(DEFAULT_TIME_SERIES.map(item => {
      const anom = +(item.sst_anomaly * scale).toFixed(2)
      const c = anom > 2.0 ? 3 : anom > 1.2 ? 2 : anom > 0.6 ? 1 : 0
      return { ...item, sst_anomaly: anom, category: c }
    }))
  }

  const cat = currentHw?.cat ?? currentHw?.category ?? 2
  const catInfo = CAT_CONFIG[cat] || CAT_CONFIG[0]
  const surfaceAnomaly = currentHw?.anomaly ?? currentHw?.sst_anomaly ?? 1.85
  const currentSst = currentHw?.sst ?? currentHw?.current_sst ?? 30.9
  const duration = currentHw?.duration ?? currentHw?.duration_days ?? 14
  const extent = currentHw?.extent ?? currentHw?.spatial_extent_km2 ?? 148000
  const dhw = currentHw?.dhw ?? +((surfaceAnomaly * duration) / 7).toFixed(1)

  return (
    <div className="page-container scroll-area select-none" style={{ minHeight: '100%', padding: '24px 32px' }}>
      
      {/* Top Header */}
      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Marine Heatwaves &amp; Thermal Anomalies
            </h1>
            <p className="text-sm text-slate-300 mt-1 font-medium">
              Hobday et al. Category I–IV Detection · 90th Percentile Climatological Threshold Analysis
            </p>
          </div>
        </div>

        {/* Global Category Badge */}
        <div
          className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl border border-cyan-500/30 bg-slate-900/80 backdrop-blur-md shadow-sm text-cyan-300"
        >
          <span className="font-mono font-bold text-base">
            Category {cat} — {catInfo.label}
          </span>
        </div>
      </div>

      {/* Preset Region Quick-Select Ribbon */}
      <div className="flex flex-wrap items-center gap-2.5 mb-6">
        <span className="text-sm font-mono text-slate-300 mr-2 flex items-center gap-1.5 font-bold">
          Monitored Basins:
        </span>
        {BASIN_HOTSPOTS.map((h, i) => {
          const isActive = activeHotspotIdx === i;
          return (
            <button
              key={h.region}
              onClick={() => handleSelectHotspot(i)}
              className={`px-3.5 py-2 rounded-xl border text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-sm font-bold'
                  : 'bg-slate-900/70 text-slate-200 border-cyan-500/20 hover:border-cyan-400/50 shadow-sm'
              }`}
            >
              <span>{h.region}</span>
              <span className="font-mono text-xs text-cyan-300 font-bold">+{h.anomaly}°C</span>
            </button>
          );
        })}
      </div>

      {/* Key Metric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="glass-card p-4 rounded-2xl border border-cyan-500/25">
          <div className="text-xs uppercase font-mono tracking-wider text-slate-400 font-bold">
            SST Anomaly
          </div>
          <div className="text-3xl font-mono font-extrabold text-cyan-400 mt-2">
            +{surfaceAnomaly.toFixed(2)}°C
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono font-medium">Above 90th percentile threshold</div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-cyan-500/25">
          <div className="text-xs uppercase font-mono tracking-wider text-slate-400 font-bold">
            Current SST
          </div>
          <div className="text-3xl font-mono font-extrabold text-cyan-400 mt-2">
            {currentSst.toFixed(2)}°C
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono font-medium">Climatological baseline: 29.1°C</div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-cyan-500/25">
          <div className="text-xs uppercase font-mono tracking-wider text-slate-400 font-bold">
            Duration
          </div>
          <div className="text-3xl font-mono font-extrabold text-cyan-400 mt-2">
            {duration} Days
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono font-medium">Cumulative continuous event</div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-cyan-500/25">
          <div className="text-xs uppercase font-mono tracking-wider text-slate-400 font-bold">
            Spatial Extent
          </div>
          <div className="text-3xl font-mono font-extrabold text-cyan-400 mt-2">
            {Math.round(extent / 1000)}k km²
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono font-medium">L4 Multi-satellite composite</div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-cyan-500/25 col-span-2 sm:col-span-1">
          <div className="text-xs uppercase font-mono tracking-wider text-slate-400 font-bold">
            Bleaching DHW
          </div>
          <div className="text-3xl font-mono font-extrabold text-cyan-400 mt-2">
            {dhw} °C-w
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono font-semibold">
            {dhw >= 8 ? 'Alert Level 2 (Mortality)' : dhw >= 4 ? 'Alert Level 1 (Bleaching)' : 'Thermal Warning'}
          </div>
        </div>
      </div>

      {/* ── Infographics Section (Reference Design) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <OceanPercentGauge
          title="Heat Stress Saturation"
          subtitle="DHW Accumulation Index relative to 12.0 °C-weeks threshold"
          percent={Math.min(100, Math.round((dhw / 12) * 100))}
          delta={Math.round(surfaceAnomaly * 10)}
          deltaDir={surfaceAnomaly > 0 ? 'up' : 'down'}
          monthData={[
            { month: 'Jun', bar1: 65, bar2: 45, bar3: 70 },
            { month: 'Jul', bar1: 72, bar2: 58, bar3: 82 },
            { month: 'Aug', bar1: 85, bar2: 74, bar3: 90 },
          ]}
        />
        <OceanWaveLineChart
          title="Degree Heating Week Stress Curve"
          subtitle="Depth-integrated thermal energy accumulation (+14d forecast)"
          statValue={`${dhw}`}
          statLabel="Degree Heating Weeks (°C-w)"
          statDesc="Accumulated thermal stress above maximum monthly mean (MMM) causing thermocline stratification."
        />
      </div>

      {/* Charts Section: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        
        {/* Monthly SST Anomaly Bar Chart */}
        <div className="glass-card p-5 rounded-2xl border border-cyan-500/30 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                
                Monthly SST Anomaly (Annual Cycle 2024)
              </h3>
              <p className="text-xs text-cyan-200/70 mt-0.5">SST thermal anomalies relative to NOAA OISST climatology</p>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-200">
              90th Pct: +0.60°C
            </span>
          </div>

          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={timeSeries} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fontSize: 13, fill: '#94a3b8', fontFamily: 'monospace', fontWeight: 600 }} />
              <YAxis tick={{ fontSize: 13, fill: '#94a3b8', fontFamily: 'monospace', fontWeight: 600 }} domain={[0, 'auto']} />
              <Tooltip
                contentStyle={{
                  background: '#0a1728',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: 'monospace'
                }}
                formatter={(v) => [`+${Number(v).toFixed(2)}°C`, 'Thermal Anomaly']}
              />
              <ReferenceLine
                y={0.6}
                stroke="#38bdf8"
                strokeDasharray="4 3"
                label={{ value: 'MHW Threshold (+0.6°C)', fill: '#38bdf8', fontSize: 12, position: 'top', fontWeight: 700 }}
              />
              <Bar dataKey="sst_anomaly" radius={[4, 4, 0, 0]}>
                {timeSeries.map((entry, index) => {
                  const val = entry.sst_anomaly || 0
                  const color = val > 2.0 ? '#38bdf8' : val > 1.2 ? '#0ea5e9' : val > 0.6 ? '#0284c7' : '#0369a1'
                  return <Cell key={`cell-${index}`} fill={color} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Depth Penetration Area Chart */}
        <div className="glass-card p-5 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                
                Thermal Anomaly Subsurface Penetration
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Vertical anomaly attenuation from surface down to 1000m</p>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-slate-800 text-slate-300">
              Depth Sounding
            </span>
          </div>

          <ResponsiveContainer width="100%" height={270}>
            <AreaChart data={depthData} layout="vertical" margin={{ top: 10, right: 25, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="mhwAnomalyGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="5%" stopColor="#ff6b35" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#ff6b35" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                type="number"
                domain={[0, 'auto']}
                tick={{ fontSize: 13, fill: '#94a3b8', fontFamily: 'monospace', fontWeight: 600 }}
                label={{ value: 'Anomaly (°C)', position: 'insideBottom', offset: -4, fill: '#94a3b8', fontSize: 13, fontWeight: 700 }}
              />
              <YAxis
                type="number"
                dataKey="depth"
                reversed
                domain={[0, 1000]}
                tick={{ fontSize: 13, fill: '#94a3b8', fontFamily: 'monospace', fontWeight: 600 }}
                label={{ value: 'Depth (m)', angle: -90, position: 'insideLeft', offset: 12, fill: '#94a3b8', fontSize: 13, fontWeight: 700 }}
              />
              <Tooltip
                contentStyle={{
                  background: '#0a1728',
                  border: '1px solid rgba(255, 107, 53, 0.4)',
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: 'monospace'
                }}
                formatter={(v, name) => [
                  `${Number(v).toFixed(3)}°C`,
                  name === 'anomaly' ? 'Thermal Anomaly' : 'Threshold'
                ]}
                labelFormatter={(d) => `Depth: ${d}m`}
              />
              <ReferenceLine x={0.6} stroke="#ffb347" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="anomaly" stroke="#38bdf8" fill="url(#mhwAnomalyGrad)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Regional Hotspot Table with Dual Hover/Expand & Top-4 compact metrics */}
      <HoverExpandablePanel
        id="panel-mhw-hotspots"
        title="Basin-Wide Heatwave Hotspots Monitoring"
        subtitle="Click any row to inspect location telemetry · 6 Real-Time Sectors"
        
        
        compactMetrics={[
          { label: 'Arabian Sea NW', val: '+1.85°C (Cat 2)', color: '#38bdf8' },
          { label: 'Bay of Bengal N', val: '+2.45°C (Cat 3)', color: '#38bdf8' },
          { label: 'Somali Margin', val: '+1.78°C (Cat 2)', color: '#38bdf8' },
          { label: 'Max DHW Stress', val: `${dhw} °C-w`, color: '#38bdf8' },
        ]}
        defaultMinimized={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-300 font-mono text-xs font-bold">
                <th className="py-3 px-4">Region</th>
                <th className="py-3 px-4">Coordinates</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">SST Anomaly</th>
                <th className="py-3 px-4">SST</th>
                <th className="py-3 px-4">DHW Stress</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {BASIN_HOTSPOTS.map((h, i) => {
                const hCat = CAT_CONFIG[h.cat] || CAT_CONFIG[0]
                const isSelected = activeHotspotIdx === i
                return (
                  <tr
                    key={h.region}
                    onClick={() => handleSelectHotspot(i)}
                    className={`border-b border-cyan-500/15 transition-colors cursor-pointer hover:bg-cyan-500/10 ${
                      isSelected ? 'bg-cyan-950/40' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-2.5 text-sm">
                      
                      {h.region}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300 text-sm">
                      {h.lat.toFixed(1)}°N, {h.lon.toFixed(1)}°E
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-mono font-bold text-cyan-300">
                        {h.cat > 0 ? `Cat ${h.cat} · ${hCat.label}` : 'Normal'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-extrabold text-cyan-400 text-sm">
                      +{h.anomaly.toFixed(2)}°C
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-100 font-bold text-sm">
                      {h.sst.toFixed(1)}°C
                    </td>
                    <td className="py-3 px-4 font-mono text-cyan-300 font-bold text-sm">
                      {h.dhw} °C-w
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs font-bold text-cyan-400">
                        {h.cat >= 2 ? 'Active Warning' : h.cat === 1 ? 'Advisory' : 'Stable'}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </HoverExpandablePanel>

      {/* Hobday et al. Category Framework Matrix with Dual Hover/Expand & Top-4 compact metrics */}
      <HoverExpandablePanel
        id="panel-mhw-hobday"
        title="MHW Classification System (Hobday et al. 2018)"
        subtitle="Multipliers of Local 90th Percentile Threshold · Ecological Tiers"
        
        
        compactMetrics={[
          { label: 'Cat 1 Moderate', val: '1–2× (+0.6°C)', color: '#38bdf8' },
          { label: 'Cat 2 Strong', val: '2–3× (+1.2°C)', color: '#38bdf8' },
          { label: 'Cat 3 Severe', val: '3–4× (+1.8°C)', color: '#38bdf8' },
          { label: 'Cat 4 Extreme', val: '>4× (+2.4°C)', color: '#38bdf8' },
        ]}
        defaultMinimized={false}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { cat: 1, name: 'Moderate', mult: '1–2× Threshold', impact: 'Moderate warming, slight vertical stratification displacement' },
            { cat: 2, name: 'Strong',   mult: '2–3× Threshold', impact: 'Ecosystem stress, pelagic migration, early coral bleaching' },
            { cat: 3, name: 'Severe',   mult: '3–4× Threshold', impact: 'Widespread bleaching, dissolved oxygen depletion, hypoxia' },
            { cat: 4, name: 'Extreme',  mult: '>4× Threshold',  impact: 'Mass marine mortality, persistent ecological regime shifts' }
          ].map(c => {
            const info = CAT_CONFIG[c.cat]
            return (
              <div
                key={c.cat}
                className="p-4 rounded-xl border flex flex-col justify-between"
                style={{ background: info.bg, borderColor: info.border }}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm" style={{ color: info.color }}>
                      Category {c.cat} — {c.name}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-300">{c.mult}</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed mt-1 font-medium">{c.impact}</p>
                </div>
                <div className="mt-4 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs font-mono text-slate-400 font-semibold">
                  <span>Threshold: +{(0.6 * c.cat).toFixed(1)}°C</span>
                  <span style={{ color: info.color }} className="font-bold">Tier {c.cat}</span>
                </div>
              </div>
            )
          })}
        </div>
      </HoverExpandablePanel>
    </div>
  )
}
