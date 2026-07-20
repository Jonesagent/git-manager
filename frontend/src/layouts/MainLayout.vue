<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="logo">🌿 Git Manager</div>
      <nav>
        <div v-for="group in menuGroups" :key="group.label" class="nav-group">
          <div class="nav-group-title">{{ group.label }}</div>
          <router-link
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            :class="{ active: isItemActive(item) }"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </router-link>
        </div>
      </nav>
      <div class="user-box">
        <div class="user-info">
          <span class="user-name">{{ auth.user?.username }}</span>
          <el-tag size="small" :type="roleTagType">{{ roleLabel }}</el-tag>
        </div>
        <el-button text size="small" @click="handleLogout">退出</el-button>
      </div>
    </aside>
    <main class="content">
      <header class="topbar">
        <h2>{{ route.meta.title || 'Git Manager' }}</h2>
      </header>
      <div class="page-body">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import {
  DataBoard, Coin, FolderOpened, Share, Tools, Document, Setting, Box, Branch,
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const menuGroups = [
  {
    label: '',
    items: [
      { path: '/dashboard', label: '总览', icon: DataBoard },
    ],
  },
  {
    label: '仓库',
    items: [
      { path: '/repos', label: '仓库列表', icon: Coin },
      { path: '/repo-manage', label: '仓库管理', icon: Box },
    ],
  },
  {
    label: '分支',
    items: [
      { path: '/branches', label: '分支管理', icon: Share },
      { path: '/monthly', label: '月度分支', icon: FolderOpened },
      { path: '/hotfix', label: '热修复', icon: Tools },
    ],
  },
  {
    label: '系统',
    items: [
      { path: '/audit', label: '审计日志', icon: Document },
      { path: '/settings', label: '设置', icon: Setting },
    ],
  },
]

function isItemActive(item: { path: string }) {
  // 仓库详情 /repos/:name 高亮 "仓库列表"
  if (route.path.startsWith('/repos/') && item.path === '/repos') return true
  return route.path === item.path || route.path.startsWith(item.path + '/')
}

const roleLabel = computed(() => {
  const map: Record<string, string> = { tech_lead: 'Tech Lead', developer: 'Developer', viewer: 'Viewer' }
  return map[auth.user?.role || ''] || ''
})
const roleTagType = computed(() => {
  return auth.user?.role === 'tech_lead' ? 'danger' : auth.user?.role === 'developer' ? 'warning' : 'info'
})

function handleLogout() {
  auth.logout()
  router.push('/login')
}

onMounted(() => { if (auth.token) auth.fetchMe() })
</script>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.sidebar {
  width: 220px; background: var(--bg-card); border-right: 1px solid var(--border);
  display: flex; flex-direction: column; position: fixed; top: 0; bottom: 0; left: 0; z-index: 100;
}
.logo { padding: 20px 24px; font-size: 18px; font-weight: 700; color: var(--accent); border-bottom: 1px solid var(--border); }
nav { flex: 1; padding: 8px 0; overflow-y: auto; }
.nav-group { margin-bottom: 4px; }
.nav-group-title {
  padding: 8px 24px 4px; font-size: 11px; font-weight: 600;
  color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;
}
.nav-item {
  display: flex; align-items: center; gap: 10px; padding: 9px 24px;
  color: var(--text-muted); font-size: 14px; transition: all .15s;
}
.nav-item:hover { color: var(--text); background: rgba(255,255,255,.03); text-decoration: none; }
.nav-item.active { color: var(--accent); background: rgba(88,166,255,.08); border-right: 3px solid var(--accent); }
.user-box {
  border-top: 1px solid var(--border); padding: 16px 20px;
  display: flex; align-items: center; justify-content: space-between;
}
.user-name { color: var(--text); font-size: 14px; }
.content { flex: 1; margin-left: 220px; display: flex; flex-direction: column; }
.topbar { height: 56px; border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 24px; }
.topbar h2 { font-size: 16px; color: var(--text); font-weight: 600; }
.page-body { flex: 1; padding: 24px; overflow-y: auto; }
</style>
