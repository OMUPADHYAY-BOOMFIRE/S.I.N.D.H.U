import React, { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { MdSearch, MdAdd, MdMoreVert, MdArrowDropUp, MdArrowDropDown } from 'react-icons/md'

/**
 * ─────────────────────────────────────────────────────────────
 * 1. Single Smooth Wave Line Chart with Vertical Drop Guides & Big Metric
 *    (Matches Top Card in reference image media_1790687749298.png)
 * ─────────────────────────────────────────────────────────────
 */
export function OceanWaveLineChart({
  title = 'Observation Wave Cycle',
  subtitle = 'Weekly thermocline wave amplitude variation',
  statValue = '642',
  statLabel = 'Integrated Thermal Flux (kJ/m²)',
  statDesc = 'Continuous acoustic wave & sensor cycle telemetry across the active observation sector.',
  data,
}) {
  const defaultData = [
    { day: 'Sun', value: 24.2 },
    { day: 'Mon', value: 27.8 },
    { day: 'Tue', value: 25.1 },
    { day: 'Wed', value: 22.4 },
    { day: 'Thu', value: 23.9 },
    { day: 'Fri', value: 21.8 },
    { day: 'Sat', value: 28.5 },
  ]
  const chartData = data || defaultData

  return (
    <div className="infographic-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="infographic-cyan-pill" />
          <div>
            <h4 className="text-lg font-bold text-slate-800 leading-tight">{title}</h4>
            <p className="text-sm text-slate-400">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: Wave Graph */}
        <div className="lg:col-span-9 h-48 relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 12, right: 15, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="singleWaveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
                  <stop offset="90%" stopColor="#38bdf8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f1f5f9" vertical={true} horizontal={false} strokeDasharray="0 0" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 16, fill: '#64748b', fontWeight: 600 }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
              <Tooltip
                contentStyle={{
                  background: '#0f172a',
                  border: 'none',
                  borderRadius: 10,
                  color: '#ffffff',
                  fontSize: 17,
                  boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
                }}
                formatter={(val) => [`${val}`, 'Sounding Amplitude']}
              />
              <Area
                type="natural"
                dataKey="value"
                stroke="#38bdf8"
                strokeWidth={3}
                fill="url(#singleWaveGrad)"
                dot={{ r: 4, fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#0284c7', stroke: '#ffffff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Right: Big Metric Callout */}
        <div className="lg:col-span-3 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-slate-100 pt-3 lg:pt-0 lg:pl-6">
          <div className="text-5xl sm:text-6xl font-extrabold text-slate-900 tracking-tight font-sans">
            {statValue}
          </div>
          <div className="h-1 w-14 bg-sky-500 my-2 rounded-full"></div>
          <div className="text-base font-bold text-slate-700">{statLabel}</div>
          <div className="text-xs text-slate-400 mt-1 leading-relaxed">
            {statDesc}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * ─────────────────────────────────────────────────────────────
 * 2. Multi-Layer Wave Area Chart & Stacked Segmented Pill Bars
 *    (Matches Middle Card in reference image media_1790687749298.png)
 * ─────────────────────────────────────────────────────────────
 */
export function OceanWaveAreaChart({
  title = 'Live Information',
  subtitle = 'Multi-layer subsurface acoustic & thermal waves',
  searchPlaceholder = 'Search parameter...',
  barLegend = {
    top: { label: 'Surface Swell', value: '297', color: '#38bdf8' },
    mid: { label: 'Thermocline Shear', value: '625', color: '#0369a1' },
    bot: { label: 'Abyssal Flux', value: '481', color: '#0369a1' },
  },
  data,
}) {
  const [searchTerm, setSearchTerm] = useState('')

  // 12-month or 12-step data matching the reference image's '01 to 12' scale
  const defaultWaveData = [
    { step: '01', wave1: 30, wave2: 55, wave3: 75, barA: 18, barB: 24, barC: 38 },
    { step: '02', wave1: 38, wave2: 45, wave3: 60, barA: 12, barB: 18, barC: 22 },
    { step: '03', wave1: 32, wave2: 58, wave3: 68, barA: 28, barB: 35, barC: 45 },
    { step: '04', wave1: 52, wave2: 48, wave3: 62, barA: 15, barB: 20, barC: 30 },
    { step: '05', wave1: 42, wave2: 65, wave3: 78, barA: 22, barB: 28, barC: 35 },
    { step: '06', wave1: 25, wave2: 52, wave3: 62, barA: 14, barB: 18, barC: 24 },
    { step: '07', wave1: 40, wave2: 44, wave3: 68, barA: 10, barB: 14, barC: 18 },
    { step: '08', wave1: 46, wave2: 58, wave3: 55, barA: 16, barB: 22, barC: 26 },
    { step: '09', wave1: 56, wave2: 52, wave3: 70, barA: 24, barB: 30, barC: 38 },
    { step: '10', wave1: 44, wave2: 68, wave3: 75, barA: 20, barB: 26, barC: 34 },
    { step: '11', wave1: 24, wave2: 56, wave3: 78, barA: 25, barB: 32, barC: 42 },
    { step: '12', wave1: 45, wave2: 48, wave3: 60, barA: 18, barB: 24, barC: 32 },
  ]
  const waveData = data || defaultWaveData

  return (
    <div className="infographic-card">
      {/* Header with Title, Search Pill, Plus and Menu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <span className="infographic-cyan-pill" />
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Pill Search Input */}
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-100 hover:bg-slate-200/70 focus:bg-white text-slate-700 placeholder-slate-400 text-sm px-3.5 py-1.5 rounded-lg border border-slate-200 outline-none w-40 sm:w-48 transition"
            />
            <MdSearch size={16} className="absolute right-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Plus Button */}
          <button
            title="Add Telemetry Layer"
            className="w-8 h-8 rounded-lg bg-sky-400 hover:bg-sky-500 text-white flex items-center justify-center transition shadow-sm"
          >
            <MdAdd size={18} />
          </button>

          {/* More options button */}
          <button
            title="Options"
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 flex items-center justify-center transition"
          >
            <MdMoreVert size={20} />
          </button>
        </div>
      </div>

      {/* 3-Layer Wave Area Chart */}
      <div className="h-60 relative w-full mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={waveData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {/* Layer 1: Mint Green Wave */}
              <linearGradient id="waveMintGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0369a1" stopOpacity={0.65} />
                <stop offset="100%" stopColor="#0369a1" stopOpacity={0.08} />
              </linearGradient>

              {/* Layer 2: Sky Cyan Wave */}
              <linearGradient id="waveSkyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#0284c7" stopOpacity={0.05} />
              </linearGradient>

              {/* Layer 3: Vibrant Royal Ocean Wave */}
              <linearGradient id="waveRoyalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0369a1" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#0369a1" stopOpacity={0.15} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="#f1f5f9" vertical={true} horizontal={false} strokeDasharray="0 0" />
            <XAxis
              dataKey="step"
              tick={{ fontSize: 15, fill: '#475569', fontWeight: 700 }}
              axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fontSize: 14, fill: '#94a3b8', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: '#0f172a',
                border: 'none',
                borderRadius: 12,
                color: '#ffffff',
                fontSize: 16,
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              }}
            />

            {/* Back Wave: Mint Green */}
            <Area
              type="natural"
              dataKey="wave3"
              name="Biomass / Chl-a"
              stroke="#0369a1"
              strokeWidth={2}
              fill="url(#waveMintGrad)"
            />

            {/* Mid Wave: Cyan */}
            <Area
              type="natural"
              dataKey="wave2"
              name="Salinity / MLD"
              stroke="#38bdf8"
              strokeWidth={2}
              fill="url(#waveSkyGrad)"
            />

            {/* Front Wave: Royal Ocean Blue */}
            <Area
              type="natural"
              dataKey="wave1"
              name="Thermal Swell"
              stroke="#0369a1"
              strokeWidth={2.5}
              fill="url(#waveRoyalGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Sub-section: Stacked Segmented Pill Bars & Legend */}
      <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row items-end justify-between gap-4">
        {/* 12 Stacked Segmented Pill Bars */}
        <div className="flex-1 w-full flex items-end justify-between gap-1 sm:gap-2 px-1">
          {waveData.map((d, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1 group cursor-pointer">
              <div
                className="w-3 sm:w-4 rounded-full overflow-hidden flex flex-col-reverse shadow-sm transition-transform duration-200 group-hover:scale-110"
                style={{ height: `${Math.max(32, d.barA + d.barB + d.barC * 0.7)}px` }}
              >
                {/* Bottom Segment: Mint Green */}
                <div style={{ height: `${d.barA}px`, background: '#0369a1' }} />
                {/* Mid Segment: Royal Blue */}
                <div style={{ height: `${d.barB}px`, background: '#0369a1' }} />
                {/* Top Segment: Cyan */}
                <div style={{ height: `${d.barC * 0.6}px`, background: '#38bdf8' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Legend on Bottom Right */}
        <div className="flex sm:flex-col gap-3 sm:gap-2 text-right shrink-0 min-w-40">
          <div className="flex items-center justify-end gap-2">
            <span className="font-extrabold font-mono text-slate-800 text-base">{barLegend.top.value}</span>
            <span className="text-xs font-semibold text-slate-500">{barLegend.top.label}</span>
            <span className="w-3 h-3 rounded-sm" style={{ background: barLegend.top.color }} />
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="font-extrabold font-mono text-slate-800 text-base">{barLegend.mid.value}</span>
            <span className="text-xs font-semibold text-slate-500">{barLegend.mid.label}</span>
            <span className="w-3 h-3 rounded-sm" style={{ background: barLegend.mid.color }} />
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="font-extrabold font-mono text-slate-800 text-base">{barLegend.bot.value}</span>
            <span className="text-xs font-semibold text-slate-500">{barLegend.bot.label}</span>
            <span className="w-3 h-3 rounded-sm" style={{ background: barLegend.bot.color }} />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * ─────────────────────────────────────────────────────────────
 * 3. Segmented Circular Semi-Gauge & 3-Month Slender Pill Bars
 *    (Matches reference image media_1790687779104.png)
 * ─────────────────────────────────────────────────────────────
 */
export function OceanPercentGauge({
  title = 'Percent',
  subtitle = 'Subsurface Reconstruction Accuracy',
  rightHeader = 'Last 3 Month',
  percent = 82,
  delta = 17,
  deltaDir = 'down', // 'up' or 'down'
  monthData = [
    { month: 'Jun', bar1: 78, bar2: 60, bar3: 52 },
    { month: 'Jul', bar1: 62, bar2: 54, bar3: 72 },
    { month: 'Aug', bar1: 50, bar2: 74, bar3: 40 },
  ],
}) {
  return (
    <div className="infographic-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="infographic-cyan-pill" />
          <div>
            <h4 className="text-lg font-bold text-slate-800 leading-tight">{title}</h4>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>
        <div className="text-sm font-semibold text-slate-700">
          Last <span className="text-sky-500 font-bold">3</span> Month
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
        {/* Left: Custom SVG Segmented Donut Arc Gauge */}
        <div className="sm:col-span-7 flex flex-col items-center justify-center relative">
          <svg viewBox="0 0 200 165" className="w-52 h-44 max-w-full overflow-visible">
            <defs>
              <linearGradient id="arcMint" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0369a1" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>
              <linearGradient id="arcCyan" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0ea5e9" />
              </linearGradient>
              <linearGradient id="arcRoyal" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0369a1" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>
            </defs>

            {/* Inner decorative light ring */}
            <path
              d="M 50 135 A 60 60 0 1 1 150 135"
              fill="none"
              stroke="#e0f2fe"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Segment 1: Mint Green Arc (Left) */}
            <path
              d="M 35 130 A 75 75 0 0 1 50 62"
              fill="none"
              stroke="url(#arcMint)"
              strokeWidth="14"
              strokeLinecap="round"
            />

            {/* Segment 2: Sky Cyan Arc (Top Left to Top Right) */}
            <path
              d="M 58 54 A 75 75 0 0 1 138 52"
              fill="none"
              stroke="url(#arcCyan)"
              strokeWidth="14"
              strokeLinecap="round"
            />

            {/* Segment 3: Royal Ocean Blue Arc (Right) */}
            <path
              d="M 146 60 A 75 75 0 0 1 165 130"
              fill="none"
              stroke="url(#arcRoyal)"
              strokeWidth="14"
              strokeLinecap="round"
            />

            {/* Inactive tail background arc */}
            <path
              d="M 148 126 A 75 75 0 0 1 165 130"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="14"
              strokeLinecap="round"
            />

            {/* Center percentage and delta */}
            <g transform="translate(100, 95)" textAnchor="middle">
              <text
                x="0"
                y="0"
                className="font-extrabold fill-slate-900"
                style={{ fontSize: '42px', fontFamily: 'var(--font-sans)', fontWeight: 800 }}
              >
                {deltaDir === 'up' && <tspan fill="#0284c7" style={{ fontSize: '24px' }}>▲ </tspan>}
                {percent}%
              </text>
              <text
                x="0"
                y="24"
                className="font-bold fill-sky-500"
                style={{ fontSize: '16px', fontFamily: 'var(--font-sans)', fontWeight: 700 }}
              >
                {deltaDir === 'down' ? (
                  <tspan fill="#0284c7" style={{ fontSize: '14px' }}>▼ </tspan>
                ) : (
                  <tspan fill="#0284c7" style={{ fontSize: '14px' }}>▲ </tspan>
                )}
                {delta}%
              </text>
            </g>

            {/* Scale Endpoints: 0% and 100% */}
            <text x="35" y="152" textAnchor="middle" className="font-semibold fill-slate-500" style={{ fontSize: '12px' }}>0%</text>
            <text x="165" y="152" textAnchor="middle" className="font-semibold fill-slate-500" style={{ fontSize: '12px' }}>100%</text>
          </svg>
        </div>

        {/* Right: 3-Month Slender Pill Bar Cluster */}
        <div className="sm:col-span-5 flex items-end justify-around h-36 border-t sm:border-t-0 sm:border-l border-slate-100 pt-3 sm:pt-0 sm:pl-4">
          {monthData.map((m, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end">
              <div className="flex items-end gap-1.5">
                {/* Bar 1: Mint */}
                <div
                  className="w-2 rounded-full transition-all duration-300"
                  style={{ height: `${m.bar1}px`, background: '#0369a1' }}
                  title={`${m.month} Mint: ${m.bar1}%`}
                />
                {/* Bar 2: Cyan */}
                <div
                  className="w-2 rounded-full transition-all duration-300"
                  style={{ height: `${m.bar2}px`, background: '#38bdf8' }}
                  title={`${m.month} Cyan: ${m.bar2}%`}
                />
                {/* Bar 3: Royal Blue */}
                <div
                  className="w-2 rounded-full transition-all duration-300"
                  style={{ height: `${m.bar3}px`, background: '#0369a1' }}
                  title={`${m.month} Royal: ${m.bar3}%`}
                />
              </div>
              <span className="text-xs font-bold text-slate-600 mt-1">{m.month}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
