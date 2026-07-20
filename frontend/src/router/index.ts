import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/Login.vue') },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'dashboard', component: () => import('../views/Dashboard.vue'), meta: { title: '总览' } },
      { path: 'repos', name: 'repos', component: () => import('../views/Repos.vue'), meta: { title: '仓库' } },
      { path: 'repos/:name', name: 'repo-detail', component: () => import('../views/RepoDetail.vue'), meta: { title: '仓库详情' } },
      { path: 'monthly', name: 'monthly', component: () => import('../views/Monthly.vue'), meta: { title: '月度管理' } },
      { path: 'hotfix', name: 'hotfix', component: () => import('../views/Hotfix.vue'), meta: { title: '热修复' } },
      { path: 'audit', name: 'audit', component: () => import('../views/Audit.vue'), meta: { title: '审计日志' } },
      { path: 'settings', name: 'settings', component: () => import('../views/Settings.vue'), meta: { title: '设置' } },
    ],
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore()
  if (to.name === 'login') return next()
  if (!auth.token) return next({ name: 'login' })
  next()
})
