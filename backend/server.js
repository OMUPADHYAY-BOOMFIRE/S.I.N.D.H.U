/**
 * S.I.N.D.H.U — Node.js Express Backend
 * Serves realistic mock JSON to the frontend.
 * Drop in real ML inference by replacing mockData responses.
 */

const express = require('express')
const cors    = require('cors')
require('dotenv').config()

const predictRoutes  = require('./routes/predict')
const oceanRoutes    = require('./routes/ocean')
const argoRoutes     = require('./routes/argo')
const heatwaveRoutes = require('./routes/heatwave')
const healthRoutes   = require('./routes/health')

const app  = express()
const PORT = process.env.PORT || 8000

// ── Middleware ──────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }))
app.use(express.json())

// Request logger (lightweight)
app.use((req, _, next) => {
  process.stdout.write(`[${new Date().toISOString()}] ${req.method} ${req.path}\n`)
  next()
})

// ── Routes ──────────────────────────────────────────────────
app.use('/api/predict',   predictRoutes)
app.use('/api/ocean',     oceanRoutes)
app.use('/api/argo',      argoRoutes)
app.use('/api/heatwave',  heatwaveRoutes)
app.use('/api',           healthRoutes)

// 404 fallback
app.use((req, res) => res.status(404).json({ error: 'Route not found', path: req.path }))

// Global error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error', message: err.message })
})

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌊 S.I.N.D.H.U Backend running at http://localhost:${PORT}`)
  console.log(`   Mode: ${process.env.NODE_ENV || 'development'} (Scientific Demo)`)
  console.log(`   Routes: /api/predict  /api/ocean  /api/argo  /api/heatwave  /api/health\n`)
})

module.exports = app
