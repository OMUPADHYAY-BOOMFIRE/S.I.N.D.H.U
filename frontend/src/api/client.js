import axios from 'axios'

// Base axios instance — falls back to mock data if backend not available
const client = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    // If backend is down, we swallow and let individual callers use mock fallback
    console.warn('[API] Request failed, using mock data:', err.message)
    return Promise.reject(err)
  }
)

export default client
