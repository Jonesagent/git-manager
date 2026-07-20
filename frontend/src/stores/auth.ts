import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../utils/api'

export interface UserInfo {
  id: number
  username: string
  email: string
  role: 'tech_lead' | 'developer' | 'viewer'
  status: string
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '')
  const user = ref<UserInfo | null>(
    localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null,
  )

  const isLoggedIn = computed(() => !!token.value)
  const isTechLead = computed(() => user.value?.role === 'tech_lead')

  async function login(username: string, password: string) {
    const { data } = await api.post('/auth/login', { username, password })
    token.value = data.token
    user.value = data.user
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  async function fetchMe() {
    try {
      const { data } = await api.get('/auth/me')
      user.value = data.user
      localStorage.setItem('user', JSON.stringify(data.user))
    } catch { logout() }
  }

  return { token, user, isLoggedIn, isTechLead, login, logout, fetchMe }
})
