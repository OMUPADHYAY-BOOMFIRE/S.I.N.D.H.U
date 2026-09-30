import { create } from 'zustand'

// ── Mock data (used as fallback when backend is not running) ──
const MOCK_PREDICTION = {
  depths: [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000],
  temp:   [29.4, 29.1, 28.7, 27.8, 26.2, 23.1, 18.4, 14.2, 11.0, 8.5, 5.2, 3.8, 2.1, 1.4, 1.1],
  sigma:  [0.3,  0.3,  0.35, 0.4,  0.45, 0.5,  0.55, 0.6,  0.6,  0.55,0.5, 0.45,0.4, 0.4, 0.4],
  eof_coeffs: [2.34, -1.12, 0.87, -0.45, 0.22],
  confidence: 97.3,
  mld: 42,
  thermocline_depth: 65,
  thermocline_gradient: -0.24,
}

const MOCK_ARGO = {
  depths: [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000],
  argo_temp:   [29.2, 28.9, 28.5, 27.4, 25.9, 22.8, 18.1, 14.0, 10.8, 8.3, 5.0, 3.7, 2.0, 1.3, 1.0],
  glorys_temp: [29.5, 29.2, 28.9, 27.9, 26.4, 23.3, 18.6, 14.4, 11.2, 8.7, 5.4, 3.9, 2.2, 1.5, 1.2],
  residual_mae: 0.18,
  float_id: 'ARGO_5906003',
  location: '11.83°N, 66.78°E',
}

const MOCK_CLIMATE = {
  iod: 0.42,
  nino34: -0.18,
  phase: 'Positive IOD / La Niña developing',
  last_updated: new Date().toISOString(),
}

const MOCK_HEATWAVE = {
  category: 2,
  category_name: 'Strong',
  sst_anomaly: 1.8,
  threshold_90p: 29.1,
  current_sst: 30.9,
  duration_days: 12,
  cumulative_intensity: 21.6,
  spatial_extent_km2: 142000,
}

const MOCK_SYSTEM_STATUS = {
  model_version: 'OceanNetHybrid-v0.3-proto',
  checkpoint: 'oceannet_epoch30.pt',
  data_last_ingested: '2024-06-14',
  argo_floats_active: 312,
  grid_coverage: '5°N-30°N · 45°E-105°E',
  satellite_feeds: {
    sst: 'online', sss: 'online', sla: 'online',
    currents: 'online', winds: 'online', chl: 'degraded',
  },
  inference_latency_ms: 187,
  mode: 'Scientific Demo Mode',
}

// ── Store ──
const useOceanStore = create((set, get) => ({
  // ── Selection state ──
  selectedLatLon: { lat: 15.50, lon: 66.20 }, // default: Arabian Sea
  selectedDate: '2026-09-27',
  leadDays: 14,
  selectedDepth: 100,
  sliceIdx: 7, // index of 100m in DEPTHS [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]
  activeBasin: 'Arabian Sea',
  selectedArgoFloat: 'ARGO_5906003',
  isCockpitMinimized: false,
  activeLandingSection: 'section-hero',
  setActiveLandingSection: (sec) => set({ activeLandingSection: sec }),

  // ── Prediction results ──
  lastPrediction: MOCK_PREDICTION,
  argoComparison: MOCK_ARGO,
  heatwave: MOCK_HEATWAVE,
  climate: MOCK_CLIMATE,
  systemStatus: MOCK_SYSTEM_STATUS,

  // ── Input grid (for map display) ──
  inputGrid: null,

  // ── Nearby ARGO floats ──
  argoFloats: [
    { id: 'ARGO_5906003', lat: 11.83, lon: 66.78, date: '2024-06-14', depth: 1000, region: 'Arabian Sea' },
    { id: 'ARGO_5906104', lat: 15.20, lon: 72.10, date: '2024-06-13', depth: 2000, region: 'Central Arabian Sea' },
    { id: 'ARGO_5905877', lat: 8.40,  lon: 78.30, date: '2024-06-14', depth: 1500, region: 'Equatorial Indian Ocean' },
    { id: 'ARGO_5906215', lat: 20.10, lon: 65.50, date: '2024-06-12', depth: 2000, region: 'North Arabian Sea' },
    { id: 'ARGO_5905990', lat: 13.70, lon: 80.20, date: '2024-06-14', depth: 1000, region: 'Bay of Bengal' },
    { id: 'ARGO_6900880', lat: 17.50, lon: 58.90, date: '2024-06-13', depth: 1000, region: 'Oman / Somali Coast' },
    { id: 'ARGO_6900921', lat: 22.30, lon: 92.10, date: '2024-06-14', depth: 2000, region: 'Northern Bay of Bengal' },
    { id: 'ARGO_6901023', lat: 6.80,  lon: 96.40, date: '2024-06-12', depth: 1500, region: 'Andaman Sea' },
  ],

  // ── Loading / error ──
  loading: false,
  error: null,
  activeRequests: {},

  // ── Actions ──
  setSelectedLatLon: (latLon) => {
    // Check if coordinates correspond closely to any preset
    const BASIN_PRESETS = {
      'Arabian Sea':             { lat: 15.50, lon: 66.20 },
      'Bay of Bengal':           { lat: 14.20, lon: 88.50 },
      'Equatorial IO':           { lat:  3.20, lon: 75.00 },
      'Lakshadweep Trench':      { lat: 10.50, lon: 72.80 },
      'Somali Upwelling':        { lat:  8.50, lon: 52.40 },
    };
    let matchedBasin = 'Custom Coordinates';
    for (const [basin, coords] of Object.entries(BASIN_PRESETS)) {
      if (Math.abs(coords.lat - latLon.lat) < 0.25 && Math.abs(coords.lon - latLon.lon) < 0.25) {
        matchedBasin = basin;
        break;
      }
    }
    set({ selectedLatLon: latLon, activeBasin: matchedBasin });
  },
  setSelectedDate: (date) => set({ selectedDate: date }),
  setLeadDays: (days) => set({ leadDays: Number(days) }),
  setSelectedDepth: (depth) => {
    const DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];
    const num = Number(depth);
    let closestIdx = 0;
    let minDiff = 99999;
    DEPTHS.forEach((d, i) => {
      const diff = Math.abs(d - num);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    });
    set({ selectedDepth: num, sliceIdx: closestIdx });
  },
  setSliceIdx: (idx) => {
    const DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];
    const clamped = Math.max(0, Math.min(DEPTHS.length - 1, Number(idx)));
    set({ sliceIdx: clamped, selectedDepth: DEPTHS[clamped] });
  },
  setActiveBasin: (basin) => {
    const basinPresets = {
      'Arabian Sea':             { lat: 15.50, lon: 66.20 },
      'Bay of Bengal':           { lat: 14.20, lon: 88.50 },
      'Equatorial IO':           { lat:  3.20, lon: 75.00 },
      'Lakshadweep Trench':      { lat: 10.50, lon: 72.80 },
      'Somali Upwelling':        { lat:  8.50, lon: 52.40 },
    };
    const coords = basinPresets[basin];
    if (coords) {
      set({ activeBasin: basin, selectedLatLon: coords });
    } else {
      set({ activeBasin: basin });
    }
  },
  setSelectedArgoFloat: (floatId) => {
    const float = get().argoFloats.find(f => f.id === floatId);
    if (float) {
      set({
        selectedArgoFloat: floatId,
        selectedLatLon: { lat: float.lat, lon: float.lon },
        activeBasin: float.region || 'ARGO Float',
        selectedDepth: Math.min(1000, float.depth),
      });
    } else {
      set({ selectedArgoFloat: floatId });
    }
  },
  setIsCockpitMinimized: (minimized) => set({ isCockpitMinimized: minimized }),
  toggleCockpitMinimized: () => set((s) => ({ isCockpitMinimized: !s.isCockpitMinimized })),

  setLastPrediction: (pred) => set({ lastPrediction: pred }),
  setArgoComparison: (comp) => set({ argoComparison: comp }),
  setHeatwave: (hw) => set({ heatwave: hw }),
  setClimate: (clim) => set({ climate: clim }),
  setInputGrid: (grid) => set({ inputGrid: grid }),

  setLoading: (key, val) => set((s) => ({
    activeRequests: { ...s.activeRequests, [key]: val },
    loading: val || Object.values({ ...s.activeRequests, [key]: val }).some(Boolean),
  })),
  setError: (msg) => set({ error: msg }),
  clearError: () => set({ error: null }),

  // ── Derived helpers ──
  getProfileAtDepth: (depth) => {
    const pred = get().lastPrediction;
    if (!pred) return null;
    const idx = pred.depths.findIndex(d => d >= depth);
    const i = idx === -1 ? pred.depths.length - 1 : Math.max(0, idx - 1);
    return {
      depth: pred.depths[i],
      temp: pred.temp[i],
      sigma: pred.sigma[i],
    };
  },
  getSoundVelocity: (depth) => {
    const pred = get().lastPrediction;
    if (!pred) return null;
    const idx = pred.depths.findIndex(d => d >= depth);
    const i = idx === -1 ? pred.depths.length - 1 : Math.max(0, idx - 1);
    const T = pred.temp[i];
    const S = 35.0;
    const z = pred.depths[i];
    return (1449.2 + 4.6*T - 0.055*T*T + 0.00029*T*T*T + (1.34 - 0.01*T)*(S-35) + 0.016*z).toFixed(1);
  },
}))

export default useOceanStore
