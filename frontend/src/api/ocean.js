import client from './client'
import useOceanStore from '../state/useOceanStore'
import { DEPTHS, SYSTEM_STATUS, CLIMATE } from './mockData'

export { DEPTHS }

export async function getOceanGrid(date) {
  try {
    if (import.meta.env.VITE_USE_BACKEND === 'true') {
      const res = await client.get(`/ocean/grid/${date}`)
      useOceanStore.getState().setInputGrid(res.data)
      return res.data
    }
  } catch {
    // fallback
  }
  return null
}

export async function getDepths() {
  try {
    if (import.meta.env.VITE_USE_BACKEND === 'true') {
      const res = await client.get('/ocean/depths')
      return res.data.depths
    }
  } catch {
    // fallback
  }
  return DEPTHS
}

export async function getSystemHealth() {
  try {
    if (import.meta.env.VITE_USE_BACKEND === 'true') {
      const res = await client.get('/health')
      return res.data
    }
  } catch {
    // fallback
  }
  return SYSTEM_STATUS
}

export async function getClimateIndices() {
  try {
    if (import.meta.env.VITE_USE_BACKEND === 'true') {
      const res = await client.get('/ocean/climate')
      useOceanStore.getState().setClimate(res.data)
      return res.data
    }
  } catch {
    // fallback
  }

  useOceanStore.getState().setClimate(CLIMATE)
  return CLIMATE
}
