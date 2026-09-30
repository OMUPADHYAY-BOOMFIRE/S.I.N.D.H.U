import client from './client'
import useOceanStore from '../state/useOceanStore'
import { DEPTHS, ARGO_FLOATS } from './mockData'

export async function getNearbyFloats(lat, lon, radius_km = 500) {
  try {
    if (import.meta.env.VITE_USE_BACKEND === 'true') {
      const res = await client.get('/argo/nearby', { params: { lat, lon, radius_km } })
      return res.data
    }
  } catch {
    // fallback
  }

  return { floats: ARGO_FLOATS }
}

export async function compareArgo(floatId, date) {
  const store = useOceanStore.getState()
  store.setLoading('argo', true)
  try {
    if (import.meta.env.VITE_USE_BACKEND === 'true') {
      const res = await client.get('/argo/compare', { params: { float_id: floatId, date } })
      store.setArgoComparison(res.data)
      return res.data
    }
  } catch {
    // fallback
  }

  const mock = {
    depths: DEPTHS,
    temp:        [29.4, 29.1, 28.7, 27.8, 26.2, 23.1, 18.4, 14.2, 11.0, 8.5, 5.2, 3.8, 2.1, 1.4, 1.1],
    argo_temp:   [29.2, 28.9, 28.5, 27.4, 25.9, 22.8, 18.1, 14.0, 10.8, 8.3, 5.0, 3.7, 2.0, 1.3, 1.0],
    glorys_temp: [29.5, 29.2, 28.9, 27.9, 26.4, 23.3, 18.6, 14.4, 11.2, 8.7, 5.4, 3.9, 2.2, 1.5, 1.2],
    residual_mae: 0.18,
    float_id: floatId,
    location: `${date}`,
  }
  store.setArgoComparison(mock)
  store.setLoading('argo', false)
  return mock
}
