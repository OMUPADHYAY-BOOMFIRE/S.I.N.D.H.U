/**
 * POST /api/predict/point
 *   Body: { lat, lon, date, lead_days }
 *   Returns: 15-depth temperature + sigma + EOF coefficients
 *
 * POST /api/predict/grid
 *   Body: { date, lead_days, bbox }
 *   Returns: downsampled 3D temperature grid for Digital Twin
 */

const express = require('express')
const router  = express.Router()
const { DEPTHS, getProfile, applyLeadTime } = require('../data/mockData')

router.post('/point', (req, res) => {
  const { lat = 11.83, lon = 66.78, date = '2024-06-14', lead_days = 14 } = req.body

  // Validate inputs
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: 'lat/lon out of range' })
  }
  if (lead_days < 1 || lead_days > 30) {
    return res.status(400).json({ error: 'lead_days must be 1–30' })
  }

  // Get profile for region and perturb by lead time
  const profile = applyLeadTime(getProfile(lat, lon), lead_days)

  // Derive sound velocity profile (UNESCO simplified)
  const svp = profile.temp.map((T, i) => {
    const d = DEPTHS[i]
    const S = 35.0
    const c = 1449.2 + 4.6*T - 0.055*T*T + 0.00029*T*T*T + (1.34 - 0.01*T)*(S - 35) + 0.016*d
    return +c.toFixed(1)
  })

  res.json({
    // Metadata
    lat: +lat, lon: +lon, date, lead_days: +lead_days,
    model: 'OceanNetHybrid-v0.3-proto',
    // Primary output
    depths:            DEPTHS,
    temp:              profile.temp,
    sigma:             profile.sigma,
    eof_coeffs:        profile.eof_coeffs,
    // Derived
    sound_velocity:    svp,
    mld:               profile.mld,
    thermocline_depth: profile.thermocline_depth,
    thermocline_gradient: profile.thermocline_gradient,
    confidence:        profile.confidence,
    // Expert routing info (illustrative)
    atp_routing: { thermal: 0.41, transport: 0.33, mixing: 0.26 },
    top_codebook_entries: [{ id: 'C18', weight: 0.41 }, { id: 'C86', weight: 0.33 }, { id: 'C37', weight: 0.26 }],
  })
})

router.post('/grid', (req, res) => {
  const { date = '2024-06-14', lead_days = 14 } = req.body
  const NX = 20, NY = 12, NZ = 15

  // Generate a small mock 3D grid [depth][lat][lon]
  const grid = Array.from({ length: NZ }, (_, di) =>
    Array.from({ length: NY }, (_, hi) =>
      Array.from({ length: NX }, (_, wi) => {
        const base = 29.5 - di * 1.8 + Math.sin(hi * 0.4 + wi * 0.3) * 2 + (Math.random() - 0.5) * 0.5
        return +Math.max(1, base).toFixed(2)
      })
    )
  )

  res.json({
    date, lead_days, depths: DEPTHS,
    grid, h_coords: NY, w_coords: NX,
    lat_range: [5, 30], lon_range: [45, 105],
    model: 'OceanNetHybrid-v0.3-proto',
  })
})

module.exports = router
