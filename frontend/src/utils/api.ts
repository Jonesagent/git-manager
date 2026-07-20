import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import { router } from '../router'

export const api = axios.create({
  baseURL: '/api',
  timeout: 120_000,
})

api.interceptors.request.use(config => {
  const auth = useAuthStore()
  if (auth.token) config.headers.Authorization = `Bearer ${auth.token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      const auth = useAuthStore()
      auth.logout()
      router.push({ name: 'login' })
    }
    return Promise.reject(err)
  },
)
