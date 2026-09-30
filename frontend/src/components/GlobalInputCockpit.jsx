import React, { useMemo, useState, useEffect } from 'react';
import {
  MdTune, MdMinimize, MdOpenInFull, MdLocationOn,
  MdCalendarToday, MdLayers, MdRadar, MdRefresh,
  MdCheckCircle, MdInfoOutline, MdChevronRight, MdNavigation,
  MdWaterDrop, MdSpeed, MdThermostat
} from 'react-icons/md';
import useOceanStore from '../state/useOceanStore';
import { calculateOceanParameters, DEPTHS, soundVelocity } from '../engine/oceanEngine';

// Macro region definitions
const MACRO_REGIONS = [
  { name: 'Arabian Sea',             lat: 15.50, lon: 66.20, tag: 'AS Basin' },
  { name: 'Bay of Bengal',           lat: 14.20, lon: 88.50, tag: 'BoB Deep' },
  { name: 'Equatorial IO',           lat:  3.20, lon: 75.00, tag: 'Warm Pool' },
  { name: 'Lakshadweep Trench',      lat: 10.50, lon: 72.80, tag: 'Trench' },
  { name: 'Somali Upwelling',        lat:  8.50, lon: 52.40, tag: 'Upwelling' },
];

const LEAD_OPTIONS = [
  { days: 0,  label: '0 Days — Nowcast (D+0)' },
  { days: 7,  label: '7 Days — Weekly Forecast (D+7)' },
  { days: 14, label: '14 Days — Bi-Weekly Horizon (D+14)' },
  { days: 21, label: '21 Days — Sub-Seasonal Outlook (D+21)' },
  { days: 30, label: '30 Days — Monthly Projection (D+30)' },
];

const DATE_PRESETS = [
  { label: 'Current Autumn', date: '2026-09-27' },
  { label: 'Monsoon Peak',  date: '2024-06-14' },
  { label: 'Winter Base',   date: '2024-01-15' },
];

export default function GlobalInputCockpit() {
  const {
    selectedLatLon, setSelectedLatLon,
    selectedDate, setSelectedDate,
    leadDays, setLeadDays,
    selectedDepth, setSelectedDepth,
    activeBasin, setActiveBasin,
    selectedArgoFloat, setSelectedArgoFloat,
    argoFloats,
    isCockpitMinimized, toggleCockpitMinimized, setIsCockpitMinimized,
  } = useOceanStore();

  // Local numeric inputs for smooth editing
  const [latInput, setLatInput] = useState(String(selectedLatLon?.lat ?? 15.50));
  const [lonInput, setLonInput] = useState(String(selectedLatLon?.lon ?? 66.20));

  // Sync inputs when global lat/lon changes (e.g. from 3D map click or preset)
  useEffect(() => {
    if (selectedLatLon) {
      setLatInput(Number(selectedLatLon.lat).toFixed(2));
      setLonInput(Number(selectedLatLon.lon).toFixed(2));
    }
  }, [selectedLatLon]);

  const lat = Number(selectedLatLon?.lat ?? 15.50);
  const lon = Number(selectedLatLon?.lon ?? 66.20);
  const dateStr = selectedDate ?? '2026-09-27';
  const lead = Number(leadDays ?? 14);
  const depth = Number(selectedDepth ?? 100);

  // Compute live physics telemetry
  const engineData = useMemo(() => {
    try {
      return calculateOceanParameters(lat, lon, dateStr, lead);
    } catch {
      return null;
    }
  }, [lat, lon, dateStr, lead]);

  const params = engineData?.params;
  const prediction = engineData?.prediction;
  const heatwave = engineData?.heatwave;

  // Sound velocity at the selected depth
  const svAtDepth = useMemo(() => {
    if (!prediction || !params) return 1530;
    const depths = prediction.depths || DEPTHS;
    let closestIdx = 0;
    let minD = 99999;
    depths.forEach((d, i) => {
      const diff = Math.abs(d - depth);
      if (diff < minD) { minD = diff; closestIdx = i; }
    });
    const t = prediction.temp?.[closestIdx] ?? 22;
    return soundVelocity(t, params.sss, depth);
  }, [prediction, params, depth]);

  // Depth stratum classification
  const depthClassification = depth <= 100
    ? { name: 'Epipelagic / Mixed Layer', color: '#00d4ff' }
    : depth <= 300
    ? { name: 'Mesopelagic / Thermocline', color: '#0369a1' }
    : { name: 'Bathypelagic / Deep Abyss', color: '#0369a1' };

  // Handlers for coordinate inputs
  const handleLatCommit = (val) => {
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= -15 && parsed <= 35) {
      setSelectedLatLon({ lat: parsed, lon });
    }
  };

  const handleLonCommit = (val) => {
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 40 && parsed <= 110) {
      setSelectedLatLon({ lat, lon: parsed });
    }
  };

  const handleStepCoord = (coord, delta) => {
    if (coord === 'lat') {
      const next = Math.max(-15, Math.min(35, +(lat + delta).toFixed(2)));
      setSelectedLatLon({ lat: next, lon });
      setLatInput(next.toFixed(2));
    } else {
      const next = Math.max(40, Math.min(110, +(lon + delta).toFixed(2)));
      setSelectedLatLon({ lat, lon: next });
      setLonInput(next.toFixed(2));
    }
  };

  const handleResetBaseline = () => {
    setActiveBasin('Arabian Sea');
    setSelectedLatLon({ lat: 15.50, lon: 66.20 });
    setSelectedDate('2026-09-27');
    setLeadDays(14);
    setSelectedDepth(100);
    setSelectedArgoFloat('ARGO_5906003');
  };

  // Target date formatting
  const targetDateStr = useMemo(() => {
    try {
      const d = new Date(dateStr);
      d.setDate(d.getDate() + lead);
      return d.toISOString().split('T')[0];
    } catch {
      return dateStr;
    }
  }, [dateStr, lead]);

  // ════════════════════════════════════════════════════════════════
  // 1. MINIMIZED MODE: Sleek Bar Showcase
  // ════════════════════════════════════════════════════════════════
  if (isCockpitMinimized) {
    return (
      <aside
        id="global-input-bar-minimized"
        aria-label="Global Ocean Input Cockpit (Minimized)"
        onClick={() => setIsCockpitMinimized(false)}
        style={{
          position: 'fixed',
          top: 14,
          right: 20,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '6px 14px',
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          borderRadius: 30,
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6), 0 0 16px rgba(56, 189, 248, 0.2)',
          cursor: 'pointer',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          color: '#f8fafc',
          fontSize: 14,
          userSelect: 'none',
          maxWidth: 'calc(100vw - 100px)',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#0284c7';
          e.currentTarget.style.boxShadow = '0 10px 36px rgba(2, 28, 76, 0.14), 0 0 26px rgba(56, 189, 248, 0.25)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(186, 220, 255, 0.95)';
          e.currentTarget.style.boxShadow = '0 8px 30px rgba(2, 28, 76, 0.1), 0 0 16px rgba(56, 189, 248, 0.15)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
        title="Click to expand Global Parameter Cockpit"
      >
        {/* Live status indicator */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.08em' }}>
            ENGINE SYNC
          </span>
        </div>

        <div style={{ width: 1, height: 18, background: 'rgba(186, 220, 255, 0.9)' }} />

        {/* Spatial */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          
          <span style={{ fontWeight: 800, color: '#ffffff' }}>
            {activeBasin !== 'Custom Coordinates' ? activeBasin : 'Coord'}
          </span>
          <span style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>
            ({lat.toFixed(1)}°N, {lon.toFixed(1)}°E)
          </span>
        </div>

        <div style={{ width: 1, height: 18, background: 'rgba(186, 220, 255, 0.9)' }} />

        {/* Temporal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          
          <span style={{ color: '#ffffff', fontFamily: 'monospace', fontWeight: 700 }}>{dateStr}</span>
          <span style={{
            fontSize: 12, padding: '2px 8px', borderRadius: 10,
            background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 800, border: '1px solid rgba(56, 189, 248, 0.35)'
          }}>
            +{lead}d
          </span>
        </div>

        <div style={{ width: 1, height: 18, background: 'rgba(186, 220, 255, 0.9)' }} />

        {/* Depth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          
          <span style={{ fontWeight: 800, fontFamily: 'monospace', color: depthClassification.color }}>
            {depth}m
          </span>
        </div>

        <div style={{ width: 1, height: 18, background: 'rgba(186, 220, 255, 0.9)' }} />

        {/* ARGO Float */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 13, color: '#38bdf8', fontFamily: 'monospace', fontWeight: 700 }}>
            {selectedArgoFloat ? selectedArgoFloat.replace('ARGO_', '#') : 'Float'}
          </span>
        </div>

        {/* Expand Action Button */}
        <button
          id="expand-cockpit-btn"
          onClick={(e) => {
            e.stopPropagation();
            setIsCockpitMinimized(false);
          }}
          style={{
            marginLeft: 6,
            padding: '5px 14px',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
            border: 'none',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
            transition: 'all 0.15s',
          }}
        >
          <MdOpenInFull size={14} />
          <span>EDIT</span>
        </button>
      </aside>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // 2. EXPANDED MODE: Pop-Up Small Dashboard
  // ════════════════════════════════════════════════════════════════
  return (
    <aside
      id="global-input-cockpit-panel"
      aria-label="Global Ocean Input Cockpit (Expanded)"
      style={{
        position: 'fixed',
        top: 14,
        right: 18,
        width: 440,
        maxWidth: 'calc(100vw - 36px)',
        maxHeight: 'calc(100vh - 28px)',
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.96)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(186, 220, 255, 0.95)',
        borderRadius: 20,
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75), 0 0 30px rgba(56, 189, 248, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#0f172a',
        transition: 'box-shadow 0.2s',
      }}
    >
      {/* ── HEADER ── */}
      <div style={{
        padding: '14px 18px',
        background: 'rgba(2, 6, 23, 0.75)',
        borderBottom: '1px solid rgba(56, 189, 248, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 2px 10px rgba(2, 132, 199, 0.35)',
          }}>
            <MdTune size={20} />
          </div>
          <div>
            <div style={{
              fontSize: 16, fontWeight: 800, color: '#0f172a',
              letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              GLOBAL MODEL COCKPIT
              <span style={{
                fontSize: 12, padding: '2px 7px', borderRadius: 6,
                background: 'rgba(16, 185, 129, 0.15)', color: '#0369a1',
                border: '1px solid rgba(16, 185, 129, 0.35)', fontWeight: 800,
              }}>
                LIVE HUD
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#475569', marginTop: 2, fontWeight: 600 }}>
              Unified Inputs driving all pages & models
            </div>
          </div>
        </div>

        {/* Actions: Reset & Minimize */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleResetBaseline}
            title="Reset to default baseline"
            style={{
              background: '#ffffff',
              border: '1px solid rgba(186, 220, 255, 0.95)',
              color: '#475569',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              fontWeight: 700,
              boxShadow: '0 1px 4px rgba(2, 28, 76, 0.04)',
            }}
          >
            <MdRefresh size={15} />
            <span>Reset</span>
          </button>

          <button
            id="minimize-cockpit-btn"
            onClick={toggleCockpitMinimized}
            title="Minimize to top bar"
            style={{
              background: '#e0f2fe',
              border: '1px solid #7dd3fc',
              color: '#0369a1',
              borderRadius: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 13,
              fontWeight: 800,
              transition: 'all 0.15s',
            }}
          >
            <MdMinimize size={13} style={{ transform: 'translateY(-2px)' }} />
            <span>Minimize</span>
          </button>
        </div>
      </div>

      {/* ── SCROLLABLE INPUT FORM BODY ── */}
      <div style={{
        padding: '12px 14px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        maxHeight: 'calc(80vh - 80px)',
      }}>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* 1. SPATIAL INPUTS */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div style={{
          background: 'rgba(2, 6, 23, 0.65)',
          border: '1px solid rgba(0, 212, 255, 0.18)',
          borderRadius: 10,
          padding: '12px 14px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MdLocationOn size={16} color="#00d4ff" />
              <span style={{ fontSize: 15, fontWeight: 700, color: '#00d4ff', letterSpacing: '0.04em' }}>
                SPATIAL INPUTS
              </span>
            </div>
            <span style={{ fontSize: 13, color: '#0369a1' }}>
              Map & Manual Sync
            </span>
          </div>

          {/* Macro Region Selection */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, color: '#0369a1', marginBottom: 6, fontWeight: 600 }}>
              Macro Region Selection
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {MACRO_REGIONS.slice(0, 3).map((r) => {
                const isSelected = activeBasin === r.name;
                return (
                  <button
                    key={r.name}
                    onClick={() => setActiveBasin(r.name)}
                    style={{
                      padding: '7px 6px',
                      fontSize: 13,
                      fontWeight: isSelected ? 700 : 500,
                      borderRadius: 6,
                      border: isSelected ? '1px solid #00d4ff' : '1px solid rgba(51, 65, 85, 0.6)',
                      background: isSelected ? 'rgba(0, 212, 255, 0.22)' : 'rgba(15, 23, 42, 0.6)',
                      color: isSelected ? '#00d4ff' : '#94a3b8',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      textAlign: 'center',
                    }}
                  >
                    {r.name === 'Equatorial IO' ? 'Equatorial IO' : r.name}
                  </button>
                );
              })}
            </div>
            {/* Additional 2 Presets */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
              {MACRO_REGIONS.slice(3).map((r) => {
                const isSelected = activeBasin === r.name;
                return (
                  <button
                    key={r.name}
                    onClick={() => setActiveBasin(r.name)}
                    style={{
                      padding: '6px 8px',
                      fontSize: 13,
                      fontWeight: isSelected ? 700 : 500,
                      borderRadius: 6,
                      border: isSelected ? '1px solid #00d4ff' : '1px solid rgba(51, 65, 85, 0.6)',
                      background: isSelected ? 'rgba(0, 212, 255, 0.22)' : 'rgba(15, 23, 42, 0.6)',
                      color: isSelected ? '#00d4ff' : '#94a3b8',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {r.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Micro Point Selection (Manual Entry) */}
          <div>
            <div style={{ fontSize: 14, color: '#0369a1', marginBottom: 6, fontWeight: 600 }}>
              Micro Point Selection (Latitude °N / Longitude °E)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {/* Latitude */}
              <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '7px 10px', borderRadius: 6, border: '1px solid rgba(51, 65, 85, 0.7)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#94a3b8', marginBottom: 3 }}>
                  <span>LATITUDE</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleStepCoord('lat', -0.5)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: 13, padding: 0, fontWeight: 700 }}>-0.5</button>
                    <button onClick={() => handleStepCoord('lat', 0.5)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: 13, padding: 0, fontWeight: 700 }}>+0.5</button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    step="0.01"
                    min="-15"
                    max="35"
                    value={latInput}
                    onChange={(e) => {
                      setLatInput(e.target.value);
                      handleLatCommit(e.target.value);
                    }}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      color: '#f8fafc',
                      fontFamily: 'monospace',
                      fontSize: 16,
                      fontWeight: 700,
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: 15, color: '#00d4ff', fontFamily: 'monospace', fontWeight: 600 }}>°N</span>
                </div>
              </div>

              {/* Longitude */}
              <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '7px 10px', borderRadius: 6, border: '1px solid rgba(51, 65, 85, 0.7)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#94a3b8', marginBottom: 3 }}>
                  <span>LONGITUDE</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleStepCoord('lon', -0.5)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: 13, padding: 0, fontWeight: 700 }}>-0.5</button>
                    <button onClick={() => handleStepCoord('lon', 0.5)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: 13, padding: 0, fontWeight: 700 }}>+0.5</button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    step="0.01"
                    min="40"
                    max="110"
                    value={lonInput}
                    onChange={(e) => {
                      setLonInput(e.target.value);
                      handleLonCommit(e.target.value);
                    }}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      color: '#f8fafc',
                      fontFamily: 'monospace',
                      fontSize: 16,
                      fontWeight: 700,
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: 15, color: '#00d4ff', fontFamily: 'monospace', fontWeight: 600 }}>°E</span>
                </div>
              </div>
            </div>

            {/* Micro info note */}
            <div style={{
              marginTop: 8,
              fontSize: 13,
              color: '#0369a1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span>Water Mass: <strong style={{ color: '#00d4ff' }}>{prediction?.waterMass ? prediction.waterMass.split('(')[0] : 'Indian Ocean'}</strong></span>
              <span style={{ color: '#94a3b8', fontWeight: 600 }}>Map Clicks Sync Here</span>
            </div>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* 2. TEMPORAL INPUTS */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div style={{
          background: 'rgba(2, 6, 23, 0.65)',
          border: '1px solid rgba(56, 189, 248, 0.18)',
          borderRadius: 10,
          padding: '12px 14px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MdCalendarToday size={15} color="#38bdf8" />
              <span style={{ fontSize: 15, fontWeight: 700, color: '#0369a1', letterSpacing: '0.04em' }}>
                TEMPORAL INPUTS
              </span>
            </div>
            <span style={{ fontSize: 13, color: '#0369a1' }}>
              Base Date & Projection
            </span>
          </div>

          {/* Calendar Picker */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 14, color: '#0369a1', fontWeight: 600 }}>
                Base Observation Date
              </span>
              {/* Presets */}
              <div style={{ display: 'flex', gap: 6 }}>
                {DATE_PRESETS.map((p) => (
                  <button
                    key={p.date}
                    onClick={() => setSelectedDate(p.date)}
                    style={{
                      background: selectedDate === p.date ? 'rgba(56, 189, 248, 0.25)' : 'none',
                      border: selectedDate === p.date ? '1px solid #38bdf8' : '1px solid rgba(51, 65, 85, 0.5)',
                      color: selectedDate === p.date ? '#38bdf8' : '#94a3b8',
                      borderRadius: 4,
                      fontSize: 12,
                      padding: '2px 8px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="date"
              id="cockpit-date-picker"
              value={dateStr}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#f8fafc',
                fontFamily: 'monospace',
                fontSize: 15,
                fontWeight: 600,
                outline: 'none',
                colorScheme: 'dark',
              }}
            />
          </div>

          {/* Forecast Lead Horizon Dropdown */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 14, color: '#0369a1', fontWeight: 600 }}>
                Forecast Lead Horizon
              </span>
              <span style={{ fontSize: 13, color: '#38bdf8', fontFamily: 'monospace', fontWeight: 600 }}>
                Target: {targetDateStr}
              </span>
            </div>
            <select
              id="cockpit-lead-dropdown"
              value={lead}
              onChange={(e) => setLeadDays(Number(e.target.value))}
              style={{
                width: '100%',
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#f8fafc',
                fontSize: 15,
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {LEAD_OPTIONS.map((opt) => (
                <option key={opt.days} value={opt.days} style={{ background: '#071529', color: '#f8fafc', fontSize: 14 }}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* 3. EXPLORATION & INTERACTIVE INPUTS */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div style={{
          background: 'rgba(2, 6, 23, 0.65)',
          border: '1px solid rgba(167, 139, 250, 0.22)',
          borderRadius: 10,
          padding: '12px 14px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MdLayers size={16} color="#a78bfa" />
              <span style={{ fontSize: 15, fontWeight: 700, color: '#0369a1', letterSpacing: '0.04em' }}>
                EXPLORATION & INTERACTIVE INPUTS
              </span>
            </div>
            <span style={{
              fontSize: 13, padding: '2px 8px', borderRadius: 4,
              background: 'rgba(167, 139, 250, 0.15)', color: depthClassification.color,
              fontWeight: 700,
            }}>
              {depthClassification.name}
            </span>
          </div>

          {/* Depth Level Slicing: Continuous Slider */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 14, color: '#0369a1', fontWeight: 600 }}>
                Continuous Depth Slicing
              </span>
              <span style={{
                fontSize: 17, fontWeight: 800, fontFamily: 'monospace',
                color: depthClassification.color,
              }}>
                {depth} m
              </span>
            </div>
            <input
              type="range"
              id="cockpit-depth-slider"
              min={0}
              max={1000}
              step={5}
              value={depth}
              onChange={(e) => setSelectedDepth(Number(e.target.value))}
              style={{
                width: '100%',
                height: 8,
                accentColor: depthClassification.color,
                cursor: 'pointer',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
              <span>Surface (0m)</span>
              <span>Thermocline (~100-200m)</span>
              <span>Abyss (1000m)</span>
            </div>
          </div>

          {/* Discrete Depth Selection: 15 Push-buttons */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, color: '#0369a1', marginBottom: 6, fontWeight: 600 }}>
              Discrete Strata (15 Specific Depths)
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 5,
            }}>
              {DEPTHS.map((d) => {
                const isActive = depth === d;
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDepth(d)}
                    style={{
                      padding: '6px 3px',
                      fontSize: 13,
                      fontFamily: 'monospace',
                      fontWeight: isActive ? 800 : 600,
                      borderRadius: 4,
                      border: isActive ? '1px solid #00d4ff' : '1px solid rgba(51, 65, 85, 0.6)',
                      background: isActive ? 'rgba(0, 212, 255, 0.25)' : 'rgba(15, 23, 42, 0.5)',
                      color: isActive ? '#00d4ff' : '#94a3b8',
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                  >
                    {d}m
                  </button>
                );
              })}
            </div>
          </div>

          {/* ARGO Float Selection */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 14, color: '#0369a1', fontWeight: 600 }}>
                ARGO Float Selection (Trigger Validation)
              </span>
              <span style={{ fontSize: 13, color: '#0369a1', fontWeight: 600 }}>
                {argoFloats?.length || 8} Active Floats
              </span>
            </div>
            <select
              id="cockpit-argo-select"
              value={selectedArgoFloat || ''}
              onChange={(e) => setSelectedArgoFloat(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(167, 139, 250, 0.3)',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#f8fafc',
                fontSize: 14,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {argoFloats?.map((f) => (
                <option key={f.id} value={f.id} style={{ background: '#071529', color: '#f8fafc', fontSize: 13 }}>
                  {f.id} · {f.region || 'Indian Ocean'} ({f.lat.toFixed(1)}°N, {f.lon.toFixed(1)}°E · {f.depth}m)
                </option>
              ))}
            </select>
          </div>
        </div>

      </div>

      {/* ── FOOTER: LIVE PHYSICAL TELEMETRY READOUT ── */}
      <div style={{
        padding: '12px 14px',
        background: 'rgba(2, 9, 20, 0.98)',
        borderTop: '1px solid rgba(0, 212, 255, 0.2)',
        fontSize: 13,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: 13 }}>LIVE DERIVED MODEL OUTPUT</span>
          <span style={{ color: '#00ff88', fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>ALL PAGES SYNCED</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, textAlign: 'center' }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '6px 4px', borderRadius: 4, border: '1px solid rgba(51, 65, 85, 0.5)' }}>
            <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>SST</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
              {params?.sst ? `${params.sst}°C` : '--'}
            </div>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '6px 4px', borderRadius: 4, border: '1px solid rgba(51, 65, 85, 0.5)' }}>
            <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>SSS</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
              {params?.sss ? `${params.sss}` : '--'}
            </div>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '6px 4px', borderRadius: 4, border: '1px solid rgba(51, 65, 85, 0.5)' }}>
            <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>MLD</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
              {prediction?.mld ? `${prediction.mld}m` : '--'}
            </div>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '6px 4px', borderRadius: 4, border: '1px solid rgba(51, 65, 85, 0.5)' }}>
            <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>C@{depth}m</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
              {svAtDepth ? `${svAtDepth}` : '--'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
