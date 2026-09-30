/**
 * GET /api/health   — system health + model version
 */

const express = require('express')
const router  = express.Router()
const { SYSTEM_STATUS } = require('../data/mockData')

const startTime = Date.now()

router.get('/health', (req, res) => {
  res.json({
    ...SYSTEM_STATUS,
    uptime_s: Math.round((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/predict/point',
      'POST /api/predict/grid',
      'GET  /api/ocean/grid/:date',
      'GET  /api/ocean/depths',
      'GET  /api/ocean/climate',
      'GET  /api/argo/nearby',
      'GET  /api/argo/compare',
      'GET  /api/heatwave/status',
      'GET  /api/heatwave/timeseries',
      'GET  /api/health',
    ],
  })
})

module.exports = router
