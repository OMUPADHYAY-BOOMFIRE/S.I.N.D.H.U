/**
 * GET /api/heatwave/status?lat=&lon=
 * GET /api/heatwave/timeseries?lat=&lon=&year=
 */

const express = require('express')
const router  = express.Router()
const { HEATWAVE_STATUS } = require('../data/mockData')

// Assign a heatwave region based on lat/lon
function getRegionKey(lat, lon) {
  if (lon < 75 && lat > 16) return 'arabian_sea_nw'
  if (lon < 75)             return 'arabian_sea_c'
  if (lat > 12 && lon > 80) return 'bay_of_bengal_n'
  if (lon > 80)             return 'bay_of_bengal_s'
  return 'equatorial_io'
}

router.get('/status', (req, res) => {
  const lat = parseFloat(req.query.lat) || 11.83
  const lon = parseFloat(req.query.lon) || 66.78
  const key = getRegionKey(lat, lon)
  const hw  = HEATWAVE_STATUS[key]

  // 90th-percentile climatological threshold + current SST
  const threshold_90p = 29.1
  const current_sst   = +(threshold_90p + hw.sst_anomaly + (Math.random() - 0.5) * 0.1).toFixed(2)

  res.json({
    ...hw,
    lat, lon, region: key.replace(/_/g, ' '),
    threshold_90p,
    current_sst,
    start_date: '2024-06-03',
    last_updated: new Date().toISOString(),
  })
})

router.get('/timeseries', (req, res) => {
  const year = parseInt(req.query.year) || 2024
  const lat  = parseFloat(req.query.lat) || 11.83
  const lon  = parseFloat(req.query.lon) || 66.78
  const key  = getRegionKey(lat, lon)
  const base = HEATWAVE_STATUS[key].sst_anomaly

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  // Seasonal envelope: peak Jun-Sep in Arabian Sea
  const seasonal = [0.1, 0.2, 0.4, 0.7, 1.1, 1.7, 2.0, 1.8, 1.3, 0.8, 0.4, 0.15]

  const series = months.map((m, i) => {
    const anomaly = +(seasonal[i] * (base / 1.8) + (Math.random() - 0.5) * 0.1).toFixed(3)
    const category = anomaly > 2.0 ? 3 : anomaly > 1.2 ? 2 : anomaly > 0.5 ? 1 : 0
    return { month: m, year, sst_anomaly: anomaly, category }
  })

  res.json({ series, lat, lon, region: key, threshold_90p: 29.1 })
})

module.exports = router
