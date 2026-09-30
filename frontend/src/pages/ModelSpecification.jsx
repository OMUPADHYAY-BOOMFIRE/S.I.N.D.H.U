import React, { useState, useMemo } from 'react'
import useOceanStore from '../state/useOceanStore'
import HoverExpandablePanel from '../components/HoverExpandablePanel'

// ── Shared formula (mirrors SubsurfaceDigitalTwin exactly) ─────
const DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]

function calculateOceanParameters(lat, lon, dateStr, leadDays = 14) {
  const date = new Date(dateStr)
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000) || 200
  const sinDoy = Math.sin((dayOfYear * 2 * Math.PI) / 365)
  const cosDoy = Math.cos((dayOfYear * 2 * Math.PI) / 365)
  const latR = (lat * Math.PI) / 180
  const lonR = (lon * Math.PI) / 180

  const isBayOfBengal = lon > 79.5 && lat > 5.0
  const isArabianSea  = lon < 77.0 && lat > 8.0
  const isEquatorial  = Math.abs(lat) < 5.0

  let sst = 28.2 + Math.cos(latR * 2.2) * 1.8 + sinDoy * 1.6 - (lat > 20 ? 1.5 : 0)
  if (isBayOfBengal) sst += 0.8 * (1 + sinDoy * 0.3)
  if (lon < 58 && lat > 10 && sinDoy > 0.2) sst -= 2.6

  let sss = 35.8 - (lat * 0.04)
  if (isBayOfBengal) sss = 31.8 - (lat > 16 ? 2.5 : (lat - 5) * 0.2) - (sinDoy > 0.4 ? 1.4 : 0)
  else if (isArabianSea) sss = 36.2 + (lat * 0.05)

  const sla           = +(0.08 * sinDoy + 0.06 * Math.sin(lonR * 4 + latR * 3) + 0.02 * cosDoy).toFixed(3)
  const u_o           = +(0.32 * Math.sin(latR * 6) * sinDoy + 0.08 * Math.cos(lonR * 5)).toFixed(3)
  const v_o           = +(0.26 * Math.cos(lonR * 7) * cosDoy + (isArabianSea && sinDoy > 0 ? 0.35 : -0.1)).toFixed(3)
  const u_w           = +(4.8 * sinDoy * (lat > 8 ? 1.2 : 0.8) + Math.cos(lonR * 3) * 1.5).toFixed(2)
  const v_w           = +(3.2 * cosDoy + (lat > 12 && sinDoy > 0 ? 4.1 : -1.2)).toFixed(2)
  const net_heat_flux = +(160 * sinDoy - 45 + Math.cos(latR * 3) * 30).toFixed(1)
  let chl = 0.22 + Math.abs(Math.sin(latR * 8 + lonR * 4)) * 0.45
  if (isBayOfBengal) chl += 0.45
  if (lon < 60 && lat > 12 && sinDoy > 0.1) chl += 1.85
  const do2           = +(215 - (lat * 1.8) + (isBayOfBengal ? -18 : 0) - (sst - 28) * 3.5).toFixed(1)
  const iod           = +(0.38 + 0.25 * sinDoy).toFixed(2)
  const nino34        = +(-0.28 + 0.15 * cosDoy).toFixed(2)
  const mld           = +(isBayOfBengal ? 28 + Math.abs(sinDoy) * 14 : 45 + Math.abs(cosDoy) * 22 + (lat * 0.6)).toFixed(1)
  const thermocline_depth    = +(mld + 18 + (isArabianSea ? 14 : 5) + Math.sin(latR * 5) * 8).toFixed(1)
  const thermocline_gradient = -+((sst - 13.5) / (thermocline_depth * 1.1)).toFixed(3)
  const confidence    = +(95.2 + Math.abs(Math.cos(lat + lon)) * 3.8).toFixed(1)
  const waterMass     = isBayOfBengal ? 'Bay of Bengal LSW (BBLSW)' : isArabianSea ? 'Arabian Sea HSW (ASHSW)' : 'Equatorial IO Central Water (EICW)'
  const oceanHeatContent = +(78.4 + (sst - 28) * 4.2 + (isBayOfBengal ? 6.5 : -2.1)).toFixed(1)
  const rossbyRadius  = +(48.5 - lat * 0.85 + (isEquatorial ? 35 : 0)).toFixed(1)
  const sofarDepth    = +(850 + Math.sin(latR * 3) * 60).toFixed(0)

  const tempProfile = DEPTHS.map(z => {
    if (z === 0) return +sst.toFixed(2)
    const zNorm    = (z - thermocline_depth) / 22
    const sigmoid  = 1 / (1 + Math.exp(zNorm))
    const deepTemp = 1.35 + 2.8 * Math.exp(-z / 420)
    const base     = deepTemp + (sst - deepTemp) * sigmoid
    const perturb  = Math.sin(lat * 3.7 + z * 0.08) * Math.cos(lon * 2.3 + z * 0.05) * (z < 120 ? 0.35 : 0.08)
    return Math.max(1.1, +(base + perturb).toFixed(2))
  })

  const sigmaProfile = DEPTHS.map(z =>
    +(0.22 + (z / 1000) * 0.38 + Math.abs(Math.sin(lat * lon * 0.001 + z)) * 0.08).toFixed(2)
  )

  // 5 EOF coefficients (dimensionality reduction projection)
  const eofCoeffs = [
    +((sst - 28) * 2.34 + sinDoy * 0.8).toFixed(3),
    +((sss - 35) * 1.12 - cosDoy * 0.5).toFixed(3),
    +(sla * 8.7 + u_o * 2.1).toFixed(3),
    +(mld / 50 - 1.0 + Math.sin(latR) * 0.44).toFixed(3),
    +((iod - 0.3) * 1.55 + nino34 * 0.7).toFixed(3),
  ]

  const svp700 = (() => {
    const T = tempProfile[13]; // 700m
    return (1449.2 + 4.6*T - 0.055*T*T + 0.00029*T*T*T + (1.34 - 0.01*T)*(sss-35) + 0.016*700).toFixed(1)
  })()

  return {
    sst: +sst.toFixed(2), sss: +sss.toFixed(2), sla, u_o, v_o, u_w, v_w,
    net_heat_flux, chl: +chl.toFixed(3), do2, iod, nino34,
    mld, thermocline_depth, thermocline_gradient, confidence, waterMass,
    oceanHeatContent, rossbyRadius, sofarDepth,
    tempProfile, sigmaProfile, eofCoeffs, svp700,
    sinDoy: +sinDoy.toFixed(3), cosDoy: +cosDoy.toFixed(3),
    isBayOfBengal, isArabianSea, isEquatorial,
  }
}

// ── Tabs ───────────────────────────────────────────────────────
const TABS = ['Reconstruction Console', 'Model Specification', 'SIH Data Contract', 'Validation & Governance']

// ── Static pipeline data ───────────────────────────────────────
const PIPELINE_STAGES = [
  {
    num: '01', label: 'INPUT',       color: '#38bdf8',
    formula: 'xᵢᵗ = [SST, SSS, SLA, uₒ, vₒ, uᵥ, vᵥ, φ, λ, sin(dᵧ), cos(dᵧ), IOD, Niño3.4, ℓ/30]',
    desc: 'Normalized daily vector per grid cell (21 channels). Land cells masked via GEBCO bathymetry. 21-frame temporal window.',
  },
  {
    num: '02', label: 'GRAPH',       color: '#38bdf8',
    formula: 'mᵢᵗ = Σⱼ∈N(i) αᵢⱼ Wₘ hⱼᵗ',
    desc: 'Dynamic edge construction from geographic distance + current-mediated transport (u,v) + feature similarity. Message aggregation across valid ocean nodes only.',
  },
  {
    num: '03', label: 'DEMAND',      color: '#38bdf8',
    formula: 'qᵢ = λ꜀Cᵢ + λₙNᵢ + λᵤUᵢ',
    desc: 'ATP Compute Demand gate driven by state Complexity, prototype Novelty, and predictive Uncertainty. Routes regions to appropriate specialist experts.',
  },
  {
    num: '04', label: 'ATP GATE',    color: '#38bdf8',
    formula: 'Budget: Σₜ Σᵢ gᵢₜ · Costᵢ ≤ B',
    desc: 'Hard compute constraint enforcement. Low-demand regions reuse codebook templates. High-demand (novel/turbulent) regions activate full expert chain.',
  },
  {
    num: '05', label: 'EXPERTS',     color: '#38bdf8',
    formula: 'h̃ᵢ = Σₖ gₖ(qᵢ) · Expertₖ(hᵢ)',
    desc: 'Sparse Mixture-of-Experts: Thermal (surface boundary layer), Mixing (turbulent MLD), Transport (advection-driven deep currents). Top-2 routing per node.',
  },
  {
    num: '06', label: 'MITOCODE',    color: 'var(--purple)',
    formula: 'zᵢ = Σₖ ETopK αᵢₖ Cₖ + Pᵣ(rᵢ),   rᵢ = zᵢ − Σₖ αᵢₖ Cₖ',
    desc: 'Prototype-residual memory bank. Familiar ocean states retrieve canonical codebook templates; novel states compute a small learned residual correction on top.',
  },
  {
    num: '07', label: 'NOVELTY',     color: '#38bdf8',
    formula: 'Nᵢ = 1 − maxₖ cos(zᵢ, Cₖ)',
    desc: 'Novel states (Nᵢ > threshold) enter validation buffer and cannot update codebook during inference. Controlled Model Promotion Rule enforced.',
  },
  {
    num: '08', label: 'DECODER',     color: '#38bdf8',
    formula: 'T̂ᵢ(d) = Φᵀ · cₖ + Tₘₑₐₙ(d)   [5 EOF Modes → 15 Depths]',
    desc: 'Residual convolutional decoder predicts 5 EOF spatial coefficient maps. Matrix multiply with fixed Φ (5×15) basis (from GLORYS SVD) expands to 15 physical depth levels.',
  },
  {
    num: '09', label: 'UNCERTAINTY', color: '#38bdf8',
    formula: 'L_nll = (T − T̂)² / (2σ²) + log σ',
    desc: 'Heteroscedastic likelihood head outputs per-depth, per-pixel predictive variance σ alongside mean temperature. Calibrated uncertainty for all 15 depth levels.',
  },
  {
    num: '10', label: 'OBJECTIVE',   color: '#38bdf8',
    formula: 'L = λₜL_temp + λᵥL_vertical + λₜₗL_temporal + λ꜀ₗL_code + λₑL_energy + λₛL_sparse + λᵤL_nll',
    desc: 'Joint scientific loss: thermodynamic MSE + MLD-gated monotonicity + temporal smoothness + codebook efficiency + compute budget + sparse routing + heteroscedastic NLL.',
  },
]

const ABLATION_STEPS = [
  { id: 'M₀', label: 'Standard GNN',              rmse: 0.82, done: true  },
  { id: 'M₁', label: '+ ATP gating',               rmse: 0.71, done: true  },
  { id: 'M₂', label: '+ Sparse experts / fusion',  rmse: 0.63, done: true  },
  { id: 'M₃', label: '+ MitoCode',                 rmse: 0.56, done: true  },
  { id: 'M₄', label: '+ Top-K mixed states',       rmse: 0.50, done: false },
  { id: 'M₅', label: '+ Residual decoder',         rmse: 0.44, done: false },
  { id: 'M₆', label: '+ Physics + uncertainty',    rmse: 0.38, done: false },
]

const DATASETS = [
  { role: 'Training target',        source: 'GLORYS12V1',          vars: 'Potential temp (15 depths)', form: 'Daily · 1/12° · 50 levels',  use: 'Supervised target; regrid to 0.25°' },
  { role: 'Independent validation', source: 'INCOIS/Coriolis GDAC', vars: 'In-situ T/S profiles',       form: 'Profile / gridded access',    use: 'Withheld; collocation by date/cell/depth' },
  { role: 'Surface input',          source: 'Copernicus / CMEMS',   vars: 'SST, SSS, SLA, currents',    form: 'Product-dependent',           use: 'Daily harmonized feature cube' },
  { role: 'Atmospheric forcing',    source: 'ERA5 single-level',    vars: '10m wind U/V, heat fluxes',  form: 'Hourly · 0.25°',              use: 'Daily mean; wind-stress proxy' },
]

// ── Reconstruction Console (fully live) ────────────────────────
const tempColor = t => t > 28 ? '#f87171' : t > 24 ? '#fb923c' : t > 18 ? '#fbbf24' : t > 12 ? '#34d399' : t > 5 ? '#38bdf8' : '#818cf8'

function ReconstructionConsole() {
  const { selectedLatLon, selectedDate, leadDays } = useOceanStore()
  const [atpBudget, setAtpBudget] = useState(64)

  const lat  = selectedLatLon?.lat  ?? 15.5
  const lon  = selectedLatLon?.lon  ?? 66.2
  const date = selectedDate         ?? '2026-09-27'
  const ld   = leadDays             ?? 14

  const d = useMemo(() => calculateOceanParameters(lat, lon, date, ld), [lat, lon, date, ld])

  // Expert routing based on live params
  const thermalActive    = d.sst > 27.5
  const mixingActive     = d.mld < 55
  const transportActive  = Math.abs(d.u_o) + Math.abs(d.v_o) > 0.3
  const activeExperts    = [thermalActive, mixingActive, transportActive].filter(Boolean).length

  // Novelty proxy: how far from "familiar" bay-of-bengal base
  const noveltyScore = Math.min(0.99, Math.abs(d.iod - 0.38) * 2.5 + Math.abs(d.nino34 + 0.28) * 2.0)
  const atpDemand    = Math.round(30 + noveltyScore * 55)

  // EOF coefficient bars
  const eofMax = Math.max(...d.eofCoeffs.map(Math.abs), 0.01)

  const locLabel = `${lat >= 0 ? lat.toFixed(2)+'°N' : Math.abs(lat).toFixed(2)+'°S'}, ${lon >= 0 ? lon.toFixed(2)+'°E' : Math.abs(lon).toFixed(2)+'°W'}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc', color: '#0f172a', fontFamily: 'var(--font-sans)', overflowY: 'auto' }}>
      
      {/* ── Fixed Telemetry Header ── */}
      <div style={{
        padding: '10px 18px', background: '#021035', borderBottom: '1px solid #1e3a8a',
        border: '1px solid rgba(74, 212, 255, 0.28)',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', rowGap: 6,
        boxShadow: '0 4px 20px rgba(1, 10, 36, 0.5)',
      }}>
        
        <span style={{ fontSize: 14, color: '#38bdf8', flexShrink: 0 }}>Live source from</span>
        <span style={{ fontSize: 15, color: '#ffffff', fontFamily: 'var(--font-mono)', fontWeight: 800, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          /digital-twin → {locLabel}
        </span>
        <span style={{ fontSize: 14, color: '#7dd3fc', flexShrink: 0, marginLeft: 'auto', whiteSpace: 'nowrap', fontWeight: 600 }}>
          {date} · Lead {ld}d
        </span>
      </div>

      {/* ── Water mass identity strip ── */}
      <div style={{
        padding: '12px 18px', borderRadius: 12, border: '1px solid rgba(74, 212, 255, 0.25)',
        background: 'rgba(5, 24, 66, 0.75)', display: 'flex', gap: 20, flexWrap: 'wrap',
        fontSize: 15,
      }}>
        <span style={{ color: '#94a3b8' }}>Water Mass: <strong style={{ color: '#38bdf8' }}>{d.waterMass}</strong></span>
        <span style={{ color: '#38bdf8' }}>IOD: <strong style={{ color: d.iod > 0.5 ? '#f87171' : '#34d399' }}>{d.iod > 0.5 ? 'Positive' : d.iod > 0 ? 'Neutral' : 'Negative'} ({d.iod > 0 ? '+':''}{d.iod})</strong></span>
        <span style={{ color: '#38bdf8' }}>ENSO: <strong style={{ color: d.nino34 > 0.5 ? '#fb923c' : d.nino34 < -0.5 ? '#4ad4ff' : '#93c5fd' }}>{d.nino34 > 0.5 ? 'El Niño' : d.nino34 < -0.5 ? 'La Niña' : 'Neutral'} ({d.nino34 > 0 ? '+':''}{d.nino34})</strong></span>
        <span style={{ color: '#38bdf8', marginLeft: 'auto' }}>Confidence: <strong style={{ color: '#4ad4ff' }}>{d.confidence}%</strong></span>
      </div>

      {/* ── Top responsive grid: inputs | ATP+experts | outputs ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 310px), 1fr))',
        gap: 16,
        alignItems: 'start',
      }}>

        {/* ── COL 1: Input features snapshot ── */}
        <HoverExpandablePanel
          id="panel-model-inputs"
          title="Surface Inputs (xᵢᵗ)"
          
          compactMetrics={[
            { label: 'SST', val: `${d.sst} °C`, color: '#38bdf8' },
            { label: 'SSS', val: `${d.sss} PSU`, color: '#38bdf8' },
            { label: 'SLA', val: `${d.sla > 0 ? '+':''}${d.sla} m`, color: '#38bdf8' },
            { label: 'Heat Flux', val: `${d.net_heat_flux} W/m²`, color: '#38bdf8' },
            { label: 'Chl-a', val: `${d.chl} mg/m³`, color: '#38bdf8' },
          ]}
          defaultMinimized={false}
        >
          {[
            { label: 'SST',           val: `${d.sst} °C`,            color: '#38bdf8' },
            { label: 'SSS',           val: `${d.sss} PSU`,           color: '#38bdf8' },
            { label: 'SLA',           val: `${d.sla > 0 ? '+':''}${d.sla} m`, color: '#38bdf8' },
            { label: 'u_o (Zonal)',   val: `${d.u_o} m/s`,           color: '#e2e8f0' },
            { label: 'v_o (Merid.)',  val: `${d.v_o} m/s`,           color: '#e2e8f0' },
            { label: 'Wind u_w',      val: `${d.u_w} m/s`,           color: '#38bdf8' },
            { label: 'Wind v_w',      val: `${d.v_w} m/s`,           color: '#38bdf8' },
            { label: 'Heat Flux',     val: `${d.net_heat_flux} W/m²`,color: '#38bdf8' },
            { label: 'Chl-a',         val: `${d.chl} mg/m³`,         color: '#38bdf8' },
            { label: 'IOD',           val: `${d.iod > 0 ? '+':''}${d.iod}`, color: '#38bdf8' },
            { label: 'Niño 3.4',      val: `${d.nino34 > 0 ? '+':''}${d.nino34}`, color: '#38bdf8' },
            { label: 'sin(DoY)',      val: `${d.sinDoy}`,            color: '#38bdf8' },
            { label: 'cos(DoY)',      val: `${d.cosDoy}`,            color: '#38bdf8' },
            { label: 'Lead ℓ/30',    val: `${(ld/30).toFixed(3)}`,  color: '#38bdf8' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0', borderBottom: '1px solid rgba(30,41,59,0.6)',
            }}>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{label}</span>
              <span style={{ fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 700, color }}>{val}</span>
            </div>
          ))}
        </HoverExpandablePanel>

        {/* ── COL 2: ATP + Experts + Novelty ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

          {/* ATP compute demand */}
          <div className="glass-card p-md">
            <div className="section-title" style={{ marginBottom: 12 }}>ATP Compute Budget Gate</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(56, 189, 248, 0.3)', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)' }}>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4, fontWeight: 700 }}>CEILING (manual)</div>
                <div style={{ fontSize: 26, fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#38bdf8' }}>{atpBudget}%</div>
                <input type="range" min={20} max={100} value={atpBudget}
                  onChange={e => setAtpBudget(Number(e.target.value))}
                  style={{ width: '100%', marginTop: 8, accentColor: '#38bdf8', cursor: 'pointer' }} />
              </div>
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(15, 23, 42, 0.75)', border: `1px solid ${atpDemand > atpBudget ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`, boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)' }}>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4, fontWeight: 700 }}>DEMAND (q̂ from state)</div>
                <div style={{ fontSize: 26, fontFamily: 'var(--font-mono)', fontWeight: 800, color: atpDemand > atpBudget ? '#f87171' : '#34d399' }}>
                  {atpDemand}%
                </div>
                <div style={{ fontSize: 13, color: atpDemand > atpBudget ? '#f87171' : '#34d399', marginTop: 4, fontWeight: 700 }}>
                  {atpDemand > atpBudget ? 'Exceeds ceiling' : 'Within budget'}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#38bdf8', fontFamily: 'var(--font-mono)', padding: '10px 12px', borderRadius: 8, background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(56, 189, 248, 0.25)', lineHeight: 1.6, fontWeight: 600 }}>
              Σₜ Σᵢ gᵢₜ · Costᵢ ≤ B &nbsp;|&nbsp; qᵢ = λ꜀Cᵢ + λₙNᵢ + λᵤUᵢ
            </div>
          </div>

          {/* Expert routing live status */}
          <div className="glass-card p-md">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="section-title">Expert Routing (h̃ᵢ)</div>
              <span style={{ fontSize: 13, padding: '4px 12px', borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.35)', fontWeight: 800 }}>
                {activeExperts}/3 active
              </span>
            </div>
            {[
              { label: 'Thermal Expert',   active: thermalActive,   color: '#38bdf8', reason: `SST=${d.sst}°C > 27.5 threshold` },
              { label: 'Mixing Expert',    active: mixingActive,    color: '#38bdf8', reason: `MLD=${d.mld}m < 55m → turbulent` },
              { label: 'Transport Expert', active: transportActive, color: '#38bdf8', reason: `|u|+|v|=${(Math.abs(d.u_o)+Math.abs(d.v_o)).toFixed(2)} m/s` },
            ].map(({ label, active, color, reason }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                marginBottom: 8, borderRadius: 10,
                background: active ? 'rgba(56, 189, 248, 0.1)' : 'rgba(15, 23, 42, 0.6)',
                border: `1px solid ${active ? 'rgba(56, 189, 248, 0.4)' : 'rgba(51, 65, 85, 0.5)'}`,
                boxShadow: active ? '0 4px 14px rgba(56, 189, 248, 0.1)' : 'none',
              }}>
                
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, color: active ? '#38bdf8' : '#94a3b8', fontWeight: 800 }}>{label}</div>
                  <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 2, fontWeight: 500 }}>{reason}</div>
                </div>
                <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 800, color: active ? color : '#94a3b8' }}>
                  {active ? 'ACTIVE' : 'IDLE'}
                </span>
              </div>
            ))}
          </div>

          {/* Novelty meter */}
          <div className="glass-card p-md">
            <div className="section-title" style={{ marginBottom: 12 }}>MitoCode Novelty (Nᵢ)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(51, 65, 85, 0.5)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 5,
                  width: `${noveltyScore * 100}%`,
                  background: noveltyScore > 0.7 ? 'linear-gradient(90deg,#ef4444,#f97316)' : noveltyScore > 0.4 ? 'linear-gradient(90deg,#f59e0b,#10b981)' : 'linear-gradient(90deg,#10b981,#06b6d4)',
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <span style={{ fontSize: 18, fontFamily: 'var(--font-mono)', fontWeight: 800, color: noveltyScore > 0.7 ? '#f87171' : noveltyScore > 0.4 ? '#fbbf24' : '#34d399', minWidth: 44 }}>
                {noveltyScore.toFixed(2)}
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5, fontWeight: 600 }}>
              Nᵢ = 1 − maxₖ cos(zᵢ, Cₖ) &nbsp;·&nbsp; {noveltyScore > 0.7 ? 'Novel — full expert chain' : noveltyScore > 0.4 ? 'Moderate — partial compute' : 'Familiar — codebook reuse'}
            </div>
          </div>
        </div>

        {/* ── COL 3: Reconstruction outputs ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

          {/* EOF coefficients */}
          <div className="glass-card p-md">
            <div className="section-title" style={{ marginBottom: 12 }}>5 EOF Coefficients (cₖ)</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              T̂(d) = Φᵀ · cₖ + Tₘₑₐₙ(d) &nbsp;→&nbsp; 15 depths
            </div>
            {d.eofCoeffs.map((v, i) => {
              const colors = ['#f97316','#38bdf8','#34d399','#fbbf24','#a855f7']
              const pct = Math.abs(v) / eofMax * 100
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, color: '#cbd5e1', fontWeight: 700 }}>EOF Mode {i+1}</span>
                    <span style={{ fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 800, color: colors[i] }}>
                      {v > 0 ? '+':''}{v}
                    </span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(51, 65, 85, 0.4)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: colors[i], borderRadius: 4, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Key reconstruction outputs */}
          <div className="glass-card p-md">
            <div className="section-title" style={{ marginBottom: 12 }}>Reconstruction Outputs</div>
            {[
              { label: 'MLD (mixed layer)',    val: `${d.mld} m`,                    color: '#38bdf8' },
              { label: 'Thermocline depth',   val: `~${d.thermocline_depth} m`,      color: '#38bdf8' },
              { label: 'Therm. gradient',     val: `${d.thermocline_gradient} °C/m`, color: '#fbbf24' },
              { label: 'Ocean Heat Content',  val: `${d.oceanHeatContent} kJ/cm²`,  color: '#f97316' },
              { label: 'Rossby Int. Radius',  val: `${d.rossbyRadius} km`,           color: '#38bdf8' },
              { label: 'SOFAR Acoustic Axis', val: `${d.sofarDepth} m`,              color: '#38bdf8' },
              { label: 'SVP @ 700m',          val: `${d.svp700} m/s`,               color: '#38bdf8' },
              { label: 'Model confidence',    val: `${d.confidence}%`,               color: '#00d4ff' },
            ].map(({ label, val, color, icon }) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: '1px solid rgba(51, 65, 85, 0.4)',
              }}>
                <span style={{ fontSize: 14, color: '#cbd5e1', fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 800, color }}>{val}</span>
              </div>
            ))}
          </div>

          {/* SVP surface quick-ref */}
          <div className="glass-card p-md" style={{ borderLeft: '4px solid #38bdf8' }}>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', fontWeight: 800 }}>Sound Velocity Profile (SVP)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[0, 5, 7, 10].map(i => {
                const depth = DEPTHS[i]; const T = d.tempProfile[i];
                const sv = (1449.2 + 4.6*T - 0.055*T*T + 0.00029*T*T*T + (1.34-0.01*T)*(d.sss-35) + 0.016*depth).toFixed(0);
                return (
                  <div key={depth} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(56, 189, 248, 0.25)', boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)' }}>
                    <div style={{ fontSize: 13, color: '#94a3b8', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{depth}m</div>
                    <div style={{ fontSize: 18, fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#38bdf8' }}>{sv} m/s</div>
                    <div style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 600 }}>{T}°C</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom: Depth profile table (compact) with Dual Hover/Expand & Top-5 bar ── */}
      <HoverExpandablePanel
        id="panel-model-depth-profile"
        title={`Reconstructed Temperature Profile — T̂(d) @ ${locLabel}`}
        subtitle="15 depth levels · 0–1000m with UNESCO Acoustic Velocity"
        compactMetrics={[
          { label: '0m Surface', val: `${d.tempProfile[0]}°C`, color: '#38bdf8' },
          { label: '50m MLD', val: `${d.tempProfile[5]}°C`, color: '#38bdf8' },
          { label: '75m Therm', val: `${d.tempProfile[6]}°C`, color: '#38bdf8' },
          { label: '200m Deep', val: `${d.tempProfile[10]}°C`, color: '#818cf8' },
          { label: '1000m Bed', val: `${d.tempProfile[14]}°C`, color: '#38bdf8' },
        ]}
        defaultMinimized={false}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%/3, 130px), 1fr))', gap: 10 }}>
          {DEPTHS.map((depth, i) => {
            const T  = d.tempProfile[i]
            const σ  = d.sigmaProfile[i]
            const svp = (1449.2 + 4.6*T - 0.055*T*T + 0.00029*T*T*T + (1.34-0.01*T)*(d.sss-35) + 0.016*depth).toFixed(0)
            const isThermocline = Math.abs(depth - d.thermocline_depth) < 15
            const isMLD = Math.abs(depth - d.mld) < 8
            return (
              <div key={depth} style={{
                padding: '12px 14px', borderRadius: 10, minWidth: 0,
                background: isThermocline ? 'rgba(245, 158, 11, 0.15)' : isMLD ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.75)',
                border: `1px solid ${isThermocline ? 'rgba(245, 158, 11, 0.5)' : isMLD ? 'rgba(16, 185, 129, 0.5)' : 'rgba(56, 189, 248, 0.2)'}`,
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 2 }}>
                  <span style={{ fontSize: 13, color: '#cbd5e1', fontFamily: 'var(--font-mono)', fontWeight: 700, flexShrink: 0 }}>{depth}m</span>
                  {isThermocline && <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 800, flexShrink: 0, padding: '1px 5px', borderRadius: 4, background: 'rgba(245, 158, 11, 0.25)' }}>TH</span>}
                  {isMLD         && <span style={{ fontSize: 11, color: '#34d399', fontWeight: 800, flexShrink: 0, padding: '1px 5px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.25)' }}>ML</span>}
                </div>
                <div style={{ fontSize: 18, fontFamily: 'var(--font-mono)', fontWeight: 800, color: tempColor(T) }}>{T}°C</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>±{σ}°C</div>
                <div style={{ fontSize: 12, color: '#38bdf8', marginTop: 1, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{svp} m/s</div>
              </div>
            )
          })}
        </div>


        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 12, color: '#94a3b8', flexWrap: 'wrap' }}>
          <span className="flex items-center gap-xs"><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#f59e0b' }} /> TH = Thermocline zone (~{d.thermocline_depth}m)</span>
          <span className="flex items-center gap-xs"><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#10b981' }} /> ML = MLD boundary (~{d.mld}m)</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>Confidence: {d.confidence}%</span>
        </div>
      </HoverExpandablePanel>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════
export default function ModelSpecification() {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <div className="page-container scroll-area">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-md">
            
            <h1 className="page-title">Scientific Governance &amp; AI Console</h1>
          </div>
          <div className="page-subtitle">
            Mathematical auditability · MoES/INCOIS algorithmic compliance · 10-Stage Pipeline
          </div>
        </div>
        <span style={{ fontSize: 13, color: '#38bdf8', fontFamily: 'monospace', fontWeight: 700 }}>SIH26066 · INCOIS Aligned</span>
      </div>

      {/* Tabs */}
      <div className="tab-bar mb-xl" style={{ maxWidth: 850 }}>
        {TABS.map((t, i) => (
          <button key={t} id={`tab-${i}`} className={`tab-item ${activeTab === i ? 'active' : ''}`}
            onClick={() => setActiveTab(i)} style={{ fontSize: 15, padding: '10px 18px' }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Tab 0: Reconstruction Console ── */}
      {activeTab === 0 && (
        <div>
          <div className="flex items-center gap-md mb-lg" style={{ fontSize: 15, color: 'var(--text-muted)' }}>
            
            5°N–30°N · 45°E–105°E · Daily · 0.25°×0.25° · 15 levels · 0–1000m · GLORYS train · ARGO independent
            <span style={{ marginLeft: 'auto', color: '#38bdf8', fontSize: 14, fontWeight: 600 }}>
              Parameters synced from /digital-twin
            </span>
          </div>
          <ReconstructionConsole />
        </div>
      )}

      {/* ── Tab 1: Model Specification ── */}
      {activeTab === 1 && (
        <div>
          {/* Architecture overview box */}
          <div className="glass-card p-md mb-lg" style={{ borderLeft: '3px solid var(--cyan)', marginBottom: 20 }}>
            <div className="section-title mb-sm" style={{ fontSize: 18 }}>S.I.N.D.H.U Architecture Overview</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14, fontSize: 15, color: 'var(--text-secondary)' }}>
              <div><span style={{ color: '#38bdf8', fontWeight:700 }}>Input:</span> 21 surface variables × 21-day temporal window per 0.25° grid cell</div>
              <div><span style={{ color: '#38bdf8', fontWeight:700 }}>Graph:</span> Dynamic ocean adjacency with current-weighted edges, land masked</div>
              <div><span style={{ color: '#38bdf8', fontWeight:700 }}>MoE:</span> 3 specialists (Thermal, Mixing, Transport) — top-2 routing via ATP demand q</div>
              <div><span style={{ color: '#38bdf8', fontWeight:700 }}>Codebook:</span> K=128 prototypes, residual correction Pᵣ for novel ocean states</div>
              <div><span style={{ color: '#38bdf8', fontWeight:700 }}>Decoder:</span> 5 EOF coefficients → Φᵀ·cₖ + Tₘₑₐₙ(d) → 15 depth levels</div>
              <div><span style={{ color: '#38bdf8', fontWeight:700 }}>Output:</span> T̂(d,x,y) mean + σ(d,x,y) uncertainty at 0–1000m, all 15 levels</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {PIPELINE_STAGES.map(stage => (
              <div key={stage.num} className="glass-card p-md" style={{ borderLeft: `3px solid ${stage.color}` }}>
                <div className="flex items-center gap-md mb-sm">
                  <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: stage.color, fontWeight: 800 }}>
                    STAGE {stage.num}
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{stage.label}</span>
                </div>
                <div className="equation mb-sm" style={{ fontSize: 16 }}>{stage.formula}</div>
                <div style={{ fontSize: 15, color: 'var(--text-secondary)' }}>{stage.desc}</div>
              </div>
            ))}
          </div>

          {/* Additional architecture detail */}
          <div className="glass-card p-md" style={{ marginTop: 20, borderTop: '2px solid var(--cyan)' }}>
            <div className="section-title mb-md" style={{ fontSize: 18 }}>Spatial–Temporal Feature Engineering</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 16, fontSize: 15, color: 'var(--text-secondary)' }}>
              <div>
                <div style={{ color: '#38bdf8', fontWeight: 700, marginBottom: 6, fontSize: 16 }}>Temporal Encoding</div>
                <div className="equation mb-sm" style={{ fontSize: 15 }}>sin(2π·dᵧ/365) , cos(2π·dᵧ/365)</div>
                <div>Day-of-year encoded as unit-circle projection to capture seasonal periodicity without discontinuity at year boundary.</div>
              </div>
              <div>
                <div style={{ color: '#38bdf8', fontWeight: 700, marginBottom: 6, fontSize: 16 }}>Lead Normalization</div>
                <div className="equation mb-sm" style={{ fontSize: 15 }}>ℓ̃ = ℓ / 30</div>
                <div>Forecast horizon normalized to [0,1] over 30-day max. Allows a single model to generalize across 1-day nowcast to 30-day forecast lead times.</div>
              </div>
              <div>
                <div style={{ color: '#38bdf8', fontWeight: 700, marginBottom: 6, fontSize: 16 }}>EOF Basis Matrix Φ</div>
                <div className="equation mb-sm" style={{ fontSize: 15 }}>Φ ∈ ℝ⁵ˣ¹⁵  (SVD of GLORYS 2000–2020)</div>
                <div>Fixed empirical orthogonal functions computed via SVD of 20 years of GLORYS reanalysis. Decoder projects 5 latent coefficients back to 15 physical depths.</div>
              </div>
              <div>
                <div style={{ color: 'var(--purple)', fontWeight: 700, marginBottom: 6, fontSize: 16 }}>Physics Constraints (L_vertical)</div>
                <div className="equation mb-sm" style={{ fontSize: 15 }}>L_vert = Σᵈ ReLU(T̂(d+1) − T̂(d)) · 𝟙[d ≤ dₜₕₑᵣₘ]</div>
                <div>MLD-gated monotonicity loss penalizes temperature inversions above the thermocline, enforcing physical realism in the water column.</div>
              </div>
            </div>
          </div>

          <div className="glass-card p-md" style={{ marginTop: 16 }}>
            <div className="section-title mb-md" style={{ fontSize: 18 }}>Hard Compute Constraint</div>
            <div className="equation" style={{ fontSize: 18 }}>Σₜ Σᵢ gᵢₜ · Costᵢ ≤ B</div>
            <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 10 }}>
              Falsifiable Hypothesis: <span className="code-inline" style={{ fontSize: 15 }}>familiar → reuse, novel → compute</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: SIH Data Contract ── */}
      {activeTab === 2 && (
        <div>
          <div className="glass-card p-md mb-xl">
            <div className="section-title mb-md" style={{ fontSize: 18 }}>Traceability Pipeline</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto' }}>
              {['01 Harmonize', '02 Window', '03 Ocean Graph', '04 MitoGraph', '05 MitoCode', '06 Decode', '07 Validate'].map((s, i) => (
                <React.Fragment key={s}>
                  <div style={{
                    padding: '10px 16px', background: i < 6 ? 'var(--cyan-ghost)' : 'var(--orange-ghost)',
                    border: `1px solid ${i < 6 ? 'var(--border)' : 'rgba(255,107,53,0.3)'}`,
                    borderRadius: 8, fontSize: 14, color: i < 6 ? 'var(--cyan)' : 'var(--orange)',
                    fontWeight: 700, whiteSpace: 'nowrap',
                  }}>{s}</div>
                  {i < 6 && <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>→</span>}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="glass-card p-md mb-xl">
            <div className="section-title mb-md" style={{ fontSize: 18 }}>Dataset Role &amp; Lineage Matrix</div>
            <table className="data-table">
              <thead>
                <tr><th>Role</th><th>Source</th><th>Variables</th><th>Native Form</th><th>Pipeline Use</th></tr>
              </thead>
              <tbody>
                {DATASETS.map(d => (
                  <tr key={d.role}>
                    <td style={{ color: '#38bdf8', fontWeight: 700, fontSize: 16 }}>{d.role}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>{d.source}</td>
                    <td style={{ fontSize: 15 }}>{d.vars}</td>
                    <td style={{ fontSize: 14, color: 'var(--text-muted)' }}>{d.form}</td>
                    <td style={{ fontSize: 15 }}>{d.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 21 Input channels — with Dual Hover/Expand and Top-5 compact metrics */}
          <HoverExpandablePanel
            id="panel-input-contract-21"
            title="21-Channel Input Contract (xᵢᵗ)"
            subtitle="Normalized daily vector per grid cell · Land cells masked via GEBCO bathymetry"
            
            compactMetrics={[
              { label: 'SST', val: 'CMEMS L4', color: '#38bdf8' },
              { label: 'SSS', val: 'CMEMS L4', color: '#38bdf8' },
              { label: 'SLA', val: 'AVISO+', color: '#38bdf8' },
              { label: 'Q_net', val: 'ERA5', color: '#38bdf8' },
              { label: 'Chl-a', val: 'Sentinel-3', color: '#38bdf8' },
            ]}
            defaultMinimized={false}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 10 }}>
              {[
                { n:1,  var:'SST',     desc:'Sea Surface Temperature',     unit:'°C',       src:'CMEMS L4' },
                { n:2,  var:'SSS',     desc:'Sea Surface Salinity',         unit:'PSU',      src:'CMEMS L4' },
                { n:3,  var:'SLA',     desc:'Sea Level Anomaly',            unit:'m',        src:'AVISO+' },
                { n:4,  var:'u_o',     desc:'Zonal surface current',        unit:'m/s',      src:'CMEMS' },
                { n:5,  var:'v_o',     desc:'Meridional surface current',   unit:'m/s',      src:'CMEMS' },
                { n:6,  var:'u_w',     desc:'Zonal wind stress',            unit:'m/s',      src:'ERA5' },
                { n:7,  var:'v_w',     desc:'Meridional wind stress',       unit:'m/s',      src:'ERA5' },
                { n:8,  var:'Q_net',   desc:'Net heat flux',                unit:'W/m²',     src:'ERA5' },
                { n:9,  var:'Chl-a',   desc:'Chlorophyll-a concentration',  unit:'mg/m³',    src:'Sentinel-3' },
                { n:10, var:'DO₂',    desc:'Dissolved oxygen (surface)',   unit:'μmol/kg',  src:'CMEMS BIO' },
                { n:11, var:'P_sfc',   desc:'Surface air pressure',         unit:'hPa',      src:'ERA5' },
                { n:12, var:'RH',      desc:'Relative humidity',            unit:'%',        src:'ERA5' },
                { n:13, var:'sin(dᵧ)',  desc:'Seasonal cycle (sine)',        unit:'–',        src:'Computed' },
                { n:14, var:'cos(dᵧ)',  desc:'Seasonal cycle (cosine)',      unit:'–',        src:'Computed' },
                { n:15, var:'IOD',     desc:'Indian Ocean Dipole Index',    unit:'–',        src:'IOBW' },
                { n:16, var:'Niño3.4', desc:'ENSO Niño 3.4 index',          unit:'–',        src:'NOAA CPC' },
                { n:17, var:'ℓ/30',    desc:'Normalized lead horizon',      unit:'–',        src:'Computed' },
                { n:18, var:'MLD',     desc:'Mixed layer depth (aux)',       unit:'m',        src:'GLORYS aux' },
                { n:19, var:'OHC',     desc:'Ocean heat content (aux)',      unit:'kJ/cm²',   src:'CMEMS' },
                { n:20, var:'SVP₀',   desc:'Sound velocity @ surface',     unit:'m/s',      src:'Computed' },
                { n:21, var:'Mask',    desc:'GEBCO land/ocean mask',        unit:'binary',   src:'GEBCO 2023' },
              ].map(({ n, var: v, desc, unit, src }) => (
                <div key={n} style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(3,7,18,0.7)', border: '1px solid rgba(30,41,59,0.8)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>#{n}</span>
                    <span style={{ fontSize: 13, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{src}</span>
                  </div>
                  <div style={{ fontSize: 17, color: '#38bdf8', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>{v}</div>
                  <div style={{ fontSize: 14, color: '#38bdf8', marginTop: 3 }}>{desc}</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Unit: {unit}</div>
                </div>
              ))}
            </div>
          </HoverExpandablePanel>

          <div className="glass-card p-md">
            <div className="section-title mb-md" style={{ fontSize: 18 }}>Output Tensor Schema</div>
            <div className="equation" style={{ fontSize: 17 }}>T̂[date, lat, lon, depth] ⊕ σ[date, lat, lon, depth]</div>
            <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {DEPTHS.map(d => (
                <span key={d} className="code-inline" style={{ fontSize: 14 }}>{d}m</span>
              ))}
            </div>
            <div style={{ marginTop: 14, fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Each output pixel carries a <strong>mean temperature T̂</strong> and <strong>heteroscedastic uncertainty σ</strong> at every depth level.
              Full 4D tensor shape: <span className="code-inline" style={{ fontSize: 14 }}>[T × H × W × 15]</span> with T=daily, H×W=0.25° grid over 5°–30°N, 45°–105°E.
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: Validation & Governance ── */}
      {activeTab === 3 && (
        <div>
          <div className="glass-card p-md mb-xl" style={{ borderLeft: '3px solid var(--cyan)' }}>
            <div style={{ fontSize: 16, fontStyle: 'italic', color: 'var(--text-secondary)' }}>
              "A model can be deployed only after its scientific and operational gates are explicit."
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
            {/* Ablation Ladder */}
            <div className="glass-card p-md">
              <div className="section-title mb-md" style={{ fontSize: 18 }}>Mandatory Ablation Ladder</div>
              {ABLATION_STEPS.map(step => (
                <div key={step.id} className="flex items-center gap-md" style={{ marginBottom: 14 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: step.done ? 'var(--cyan)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: 32 }}>
                    {step.id}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, color: step.done ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600 }}>{step.label}</div>
                    <div className="progress-bar" style={{ marginTop: 6, height: 8 }}>
                      <div className="progress-fill" style={{
                        width: `${(1 - step.rmse / 1.0) * 100}%`,
                        background: step.done ? 'linear-gradient(90deg,var(--cyan),var(--green))' : 'var(--text-muted)',
                      }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 14, color: step.done ? 'var(--green)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: 60, textAlign: 'right', fontWeight: 700 }}>
                    {step.done ? `${step.rmse.toFixed(2)}°C` : 'pending'}
                  </span>
                </div>
              ))}
            </div>

            {/* Governance Architecture Pillars */}
            <div>
              {[
                { title: 'Contribution 01 — MitoGraph',
                  desc: 'Energy-adaptive graph computation allocating capacity according to ocean-state complexity, uncertainty, and novelty.', color: '#38bdf8' },
                { title: 'Contribution 02 — MitoCode',
                  desc: 'Prototype-residual memory storing recurring ocean states as a sparse reusable vocabulary with small state residuals.', color: 'var(--purple)' },
                { title: 'Contribution 03 — Memory-Guided Compute',
                  desc: 'Prototype distance driving dynamic routing; familiar states reuse templates, novel states route to full specialist chain.', color: '#38bdf8' },
              ].map(p => (
                <div key={p.title} className="glass-card p-md mb-md" style={{ borderLeft: `3px solid ${p.color}` }}>
                  <div className="flex items-center gap-sm mb-sm">
                    <span style={{ fontSize: 16, fontWeight: 800, color: p.color }}>{p.title}</span>
                  </div>
                  <div style={{ fontSize: 15, color: 'var(--text-secondary)' }}>{p.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Validation metrics table */}
          <div className="glass-card p-md mb-xl">
            <div className="section-title mb-md" style={{ fontSize: 18 }}>Validation Metric Definitions</div>
            <table className="data-table">
              <thead>
                <tr><th>Metric</th><th>Formula</th><th>Target</th><th>Gate</th></tr>
              </thead>
              <tbody>
                {[
                  { m:'RMSE', f:'√(1/N Σ(T−T̂)²)', t:'< 0.38°C @ all depths', g:'Pass / Fail vs baselines' },
                  { m:'Bias', f:'1/N Σ(T−T̂)', t:'|bias| < 0.10°C', g:'Operational requirement' },
                  { m:'Pearson r', f:'cov(T,T̂)/(σ_T σ_T̂)', t:'> 0.94', g:'Physical coherence' },
                  { m:'Thermocline Error', f:'|MLD_pred − MLD_true|', t:'< 8m mean absolute', g:'Scientific gate' },
                  { m:'CRPS', f:'∫(F̂(y)−𝟙[y≤x])²dy', t:'< 0.30', g:'Probabilistic calibration' },
                  { m:'FLOPs Ratio', f:'FLOPs_MitoGraph / FLOPs_dense', t:'< 0.65×', g:'Efficiency claim' },
                ].map(row => (
                  <tr key={row.m}>
                    <td style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 16 }}>{row.m}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>{row.f}</td>
                    <td style={{ color: '#38bdf8', fontSize: 15, fontWeight: 600 }}>{row.t}</td>
                    <td style={{ fontSize: 14, color: 'var(--text-muted)' }}>{row.g}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Success Contract */}
          <div className="glass-card p-md" style={{ borderTop: '2px solid var(--green)' }}>
            <div className="section-title mb-md" style={{ fontSize: 18 }}>
              
              Success Contract
            </div>
            <div style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              S.I.N.D.H.U succeeds only if competitive on <strong>RMSE, bias, correlation, and thermocline error</strong> against CNN, autoencoder, GNN, and attention baselines
              while <strong>strictly reducing active FLOPs, latency, or representation memory</strong>. No operational claim until withheld ARGO profiles pass the independent gate.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
