/**
 * GET /api/argo/nearby?lat=&lon=&radius_km=
 * GET /api/argo/compare?float_id=&date=
 */

const express = require('express')
const router  = express.Router()
const { DEPTHS, ARGO_FLOATS, getProfile } = require('../data/mockData')

// Haversine distance in km
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = d => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

router.get('/nearby', (req, res) => {
  const lat = parseFloat(req.query.lat) || 11.83
  const lon = parseFloat(req.query.lon) || 66.78
  const radius = parseFloat(req.query.radius_km) || 500

  const floats = ARGO_FLOATS.filter(f => haversine(lat, lon, f.lat, f.lon) <= radius)
  res.json({ floats, count: floats.length, center: { lat, lon }, radius_km: radius })
})

router.get('/compare', (req, res) => {
  const { float_id = 'ARGO_5906003', date = '2024-06-14' } = req.query
  const float = ARGO_FLOATS.find(f => f.id === float_id) || ARGO_FLOATS[0]

  // AI prediction at float location
  const aiProfile = getProfile(float.lat, float.lon)

  // ARGO in-situ: add small random bias to AI prediction (realistic ~0.2°C offset)
  const argo_temp = aiProfile.temp.map(t =>
    +(t + (Math.random() - 0.5) * 0.4 - 0.12).toFixed(3)
  )

  // GLORYS reanalysis: slightly warmer than ARGO at surface, converges at depth
  const glorys_temp = aiProfile.temp.map((t, i) =>
    +(t + (Math.random() - 0.5) * 0.2 + Math.max(0, (1 - i/14) * 0.15)).toFixed(3)
  )

  // Compute MAE vs ARGO
  const residuals = aiProfile.temp.map((t, i) => Math.abs(t - argo_temp[i]))
  const mae = +(residuals.reduce((s, r) => s + r, 0) / residuals.length).toFixed(3)

  res.json({
    float_id,
    float_lat: float.lat, float_lon: float.lon,
    date,
    depths:      DEPTHS,
    ai_temp:     aiProfile.temp,
    argo_temp,
    glorys_temp,
    residuals,
    residual_mae: mae,
    residual_rmse: +(Math.sqrt(residuals.reduce((s, r) => s + r*r, 0) / residuals.length)).toFixed(3),
    correlation: 0.981,
  })
})

module.exports = router
