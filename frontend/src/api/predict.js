import client from './client'
import useOceanStore from '../state/useOceanStore'
import { DEPTHS, getProfile, applyLeadTime } from './mockData'

export async function predictPoint(lat, lon, date, leadDays) {
  const store = useOceanStore.getState()
  store.setLoading('predict', true)
  try {
    if (import.meta.env.VITE_USE_BACKEND === 'true') {
      const res = await client.post('/predict/point', { lat, lon, date, lead_days: leadDays })
      store.setLastPrediction(res.data)
      return res.data
    }
  } catch {
    // fallback
  }

  const base = getProfile(lat, lon)
  const mock = applyLeadTime(base, leadDays)
  store.setLastPrediction(mock)
  store.setLoading('predict', false)
  return mock
}

export async function predictGrid(date, leadDays, bbox) {
  const store = useOceanStore.getState()
  store.setLoading('grid', true)
  try {
    if (import.meta.env.VITE_USE_BACKEND === 'true') {
      const res = await client.post('/predict/grid', { date, lead_days: leadDays, bbox })
      store.setLoading('grid', false)
      return res.data
    }
  } catch {
    // fallback
  }

  // Return a downsampled 15x10x20 mock grid for the 3D voxel cube
  const grid = Array.from({ length: 15 }, (_, di) =>
    Array.from({ length: 10 }, (_, hi) =>
      Array.from({ length: 20 }, (_, wi) => {
        const base = 30 - di * 2 + Math.sin(hi * 0.5 + wi * 0.3) * 2
        return Math.max(1, base + (Math.random() - 0.5))
      })
    )
  )
  store.setLoading('grid', false)
  return { depths: DEPTHS, grid, h_coords: 10, w_coords: 20 }
}
