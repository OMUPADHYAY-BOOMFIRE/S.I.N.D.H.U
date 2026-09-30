/**
 * Realistic mock data payloads for S.I.N.D.H.U backend.
 * All values are oceanographically plausible for the Indian Ocean.
 * Replace with real model inference output when ml/train.py checkpoint is ready.
 */

const DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]

// ── Temperature profiles by region ────────────────────────
const PROFILES = {
  'arabian_sea': {
    temp:   [29.4, 29.1, 28.7, 27.8, 26.2, 23.1, 18.4, 14.2, 11.0, 8.5, 5.2, 3.8, 2.1, 1.4, 1.1],
    sigma:  [0.28, 0.30, 0.34, 0.39, 0.44, 0.50, 0.54, 0.58, 0.57, 0.52, 0.47, 0.43, 0.40, 0.40, 0.40],
    eof_coeffs: [2.34, -1.12, 0.87, -0.45, 0.22],
    mld: 42, thermocline_depth: 65, thermocline_gradient: -0.243,
    confidence: 97.3,
  },
  'bay_of_bengal': {
    temp:   [30.1, 29.8, 29.4, 28.5, 27.1, 24.2, 19.8, 15.3, 12.1, 9.4, 6.1, 4.3, 2.4, 1.5, 1.1],
    sigma:  [0.30, 0.33, 0.37, 0.43, 0.48, 0.53, 0.57, 0.60, 0.59, 0.54, 0.49, 0.44, 0.41, 0.41, 0.40],
    eof_coeffs: [2.71, -0.98, 1.02, -0.38, 0.19],
    mld: 28, thermocline_depth: 55, thermocline_gradient: -0.310,
    confidence: 96.1,
  },
  'equatorial': {
    temp:   [28.9, 28.7, 28.4, 27.6, 25.9, 22.4, 17.1, 13.0, 10.2, 7.8, 4.9, 3.5, 2.0, 1.4, 1.1],
    sigma:  [0.26, 0.28, 0.31, 0.36, 0.41, 0.47, 0.52, 0.55, 0.55, 0.50, 0.45, 0.41, 0.39, 0.39, 0.38],
    eof_coeffs: [2.05, -1.30, 0.71, -0.52, 0.28],
    mld: 55, thermocline_depth: 80, thermocline_gradient: -0.198,
    confidence: 98.0,
  },
}

// Select profile by lat/lon region
function getProfile(lat, lon) {
  if (lon < 75) return PROFILES.arabian_sea
  if (lat > 8 && lon > 78) return PROFILES.bay_of_bengal
  return PROFILES.equatorial
}

// Apply lead-time perturbation (forecast uncertainty grows with lead)
function applyLeadTime(profile, leadDays) {
  const leadFactor = 1 + (leadDays - 7) / 30 * 0.15
  return {
    ...profile,
    temp:  profile.temp.map(t => +(t * (1 + (Math.random() - 0.5) * 0.005)).toFixed(3)),
    sigma: profile.sigma.map(s => +(s * leadFactor).toFixed(3)),
  }
}

// ── ARGO float catalog ─────────────────────────────────────
const ARGO_FLOATS = [
  { id: 'ARGO_5906003', lat: 11.83, lon: 66.78, date: '2024-06-14', depth_range: 1000 },
  { id: 'ARGO_5906104', lat: 15.20, lon: 72.10, date: '2024-06-13', depth_range: 2000 },
  { id: 'ARGO_5905877', lat:  8.40, lon: 78.30, date: '2024-06-14', depth_range: 1500 },
  { id: 'ARGO_5906215', lat: 20.10, lon: 65.50, date: '2024-06-12', depth_range: 2000 },
  { id: 'ARGO_5905990', lat: 13.70, lon: 80.20, date: '2024-06-14', depth_range: 1000 },
  { id: 'ARGO_6900880', lat: 17.50, lon: 58.90, date: '2024-06-13', depth_range: 1000 },
  { id: 'ARGO_6900921', lat: 22.30, lon: 92.10, date: '2024-06-14', depth_range: 2000 },
  { id: 'ARGO_6901023', lat:  6.80, lon: 96.40, date: '2024-06-12', depth_range: 1500 },
]

// ── Heatwave status ────────────────────────────────────────
const HEATWAVE_STATUS = {
  arabian_sea_nw:   { category: 2, category_name: 'Strong',   sst_anomaly: 1.8, duration_days: 12, cumulative_intensity: 21.6, spatial_extent_km2: 142000 },
  arabian_sea_c:    { category: 1, category_name: 'Moderate', sst_anomaly: 1.1, duration_days:  6, cumulative_intensity:  6.6, spatial_extent_km2:  64000 },
  bay_of_bengal_n:  { category: 3, category_name: 'Severe',   sst_anomaly: 2.4, duration_days: 18, cumulative_intensity: 43.2, spatial_extent_km2: 218000 },
  bay_of_bengal_s:  { category: 1, category_name: 'Moderate', sst_anomaly: 0.9, duration_days:  4, cumulative_intensity:  3.6, spatial_extent_km2:  41000 },
  equatorial_io:    { category: 0, category_name: 'Normal',   sst_anomaly: 0.2, duration_days:  0, cumulative_intensity:  0.0, spatial_extent_km2:       0 },
}

// ── System health ──────────────────────────────────────────
const SYSTEM_STATUS = {
  status:          'demo',
  model_version:   'OceanNetHybrid-v0.3-proto',
  checkpoint:      'oceannet_epoch30.pt',
  data_last_ingested: '2024-06-14',
  argo_floats_active: 312,
  grid_coverage:   '5°N-30°N · 45°E-105°E',
  inference_latency_ms: 187,
  mode:            'Scientific Demo Mode (no GPU)',
  satellite_feeds: {
    sst: 'online', sss: 'online', sla: 'online',
    currents: 'online', winds: 'online', chl: 'degraded',
  },
  uptime_s: 7200,
}

// ── Climate indices ────────────────────────────────────────
const CLIMATE = {
  iod:    0.42,
  nino34: -0.18,
  phase:  'Positive IOD / La Niña developing',
  last_updated: new Date().toISOString(),
}

module.exports = { DEPTHS, PROFILES, getProfile, applyLeadTime, ARGO_FLOATS, HEATWAVE_STATUS, SYSTEM_STATUS, CLIMATE }
