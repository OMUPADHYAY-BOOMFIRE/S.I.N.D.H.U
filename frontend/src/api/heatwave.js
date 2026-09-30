import client from './client'
import useOceanStore from '../state/useOceanStore'
import { HEATWAVE_STATUS } from './mockData'

function getRegionKey(lat = 15, lon = 65) {
  if (lon < 75) {
    return lat > 18 ? 'arabian_sea_nw' : 'arabian_sea_c'
  }
  if (lon >= 75 && lon <= 100 && lat >= 5) {
    return lat > 15 ? 'bay_of_bengal_n' : 'bay_of_bengal_s'
  }
  return 'equatorial_io'
}

export async function getHeatwaveStatus(lat, lon) {
  const store = useOceanStore.getState()
  try {
    if (import.meta.env.VITE_USE_BACKEND === 'true') {
      const res = await client.get('/heatwave/status', { params: { lat, lon } })
      store.setHeatwave(res.data)
      return res.data
    }
  } catch {
    // fallback
  }

  const regionKey = getRegionKey(lat, lon)
  const mock = HEATWAVE_STATUS[regionKey] || HEATWAVE_STATUS.arabian_sea_nw
  store.setHeatwave(mock)
  return mock
}

export async function getHeatwaveTimeSeries(lat, lon, year = 2024) {
  try {
    if (import.meta.env.VITE_USE_BACKEND === 'true') {
      const res = await client.get('/heatwave/timeseries', { params: { lat, lon, year } })
      return Array.isArray(res.data) ? res.data : (res.data?.series || [])
    }
  } catch {
    // fallback
  }

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return months.map((m, i) => ({
    month: m,
    sst_anomaly: [0.1, 0.2, 0.4, 0.8, 1.2, 1.8, 2.1, 1.9, 1.4, 0.9, 0.5, 0.2][i],
    category: [0, 0, 0, 1, 1, 2, 2, 2, 1, 1, 0, 0][i],
  }))
}
