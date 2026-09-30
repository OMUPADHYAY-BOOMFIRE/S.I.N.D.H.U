/**
 * GET /api/ocean/grid/:date   — mock input feature grid for map display
 * GET /api/ocean/depths       — depth level list
 * GET /api/ocean/climate      — climate indices (IOD, Niño 3.4)
 */

const express = require('express')
const router  = express.Router()
const { DEPTHS, CLIMATE, SYSTEM_STATUS } = require('../data/mockData')

router.get('/grid/:date', (req, res) => {
  const { date } = req.params
  const NX = 20, NY = 12

  // Surface input fields (2D mock grids at 0.25° stride)
  const makeField = (meanVal, amp) =>
    Array.from({ length: NY }, (_, i) =>
      Array.from({ length: NX }, (_, j) =>
        +(meanVal + amp * Math.sin(i * 0.4 + j * 0.3) + (Math.random() - 0.5) * amp * 0.3).toFixed(3)
      )
    )

  res.json({
    date,
    lat_range: [5, 30], lon_range: [45, 105], resolution: 0.25,
    fields: {
      sst:            makeField(29.5, 2.0),
      sss:            makeField(35.8, 0.8),
      sla:            makeField(0.02, 0.05),
      u_surface:      makeField(0.25, 0.3),
      v_surface:      makeField(0.35, 0.3),
      wind_speed:     makeField(8.2,  2.5),
      wind_stress_curl: makeField(0.0, 1e-7),
      mld:            makeField(42,   15),
    },
  })
})

router.get('/depths', (req, res) => {
  res.json({ depths: DEPTHS, units: 'metres', n_levels: DEPTHS.length })
})

router.get('/climate', (req, res) => {
  res.json({
    ...CLIMATE,
    historical: [
      { month: '2024-01', iod: 0.05, nino34: 0.3 },
      { month: '2024-02', iod: 0.10, nino34: 0.2 },
      { month: '2024-03', iod: 0.18, nino34: 0.1 },
      { month: '2024-04', iod: 0.25, nino34: 0.0 },
      { month: '2024-05', iod: 0.33, nino34: -0.1 },
      { month: '2024-06', iod: 0.42, nino34: -0.18 },
    ],
  })
})

module.exports = router
