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
    </aside>
    <main class="content">
      <header class="topbar">
        <h2>{{ route.meta.title || 'Git Manager' }}</h2>
        <div class="topbar-actions">
          <el-tooltip :content="isDark ? '切换为亮色' : '切换为暗色'" placement="bottom">
            <el-button text :icon="isDark ? Sunny : Moon" @click="handleToggleTheme" />
          </el-tooltip>
          <div class="user-menu-wrapper" v-if="auth.user">
            <el-dropdown @command="handleUserMenuCommand">
              <span class="user-trigger">
                <el-avatar :size="32" class="user-avatar">{{ auth.user.username.charAt(0).toUpperCase() }}</el-avatar>
                <span class="user-info-box">
                  <span class="user-name">{{ auth.user.username }}</span>
                  <el-tag size="small" :type="roleTagType" class="user-role">{{ roleLabel }}</el-tag>
                </span>
                <el-icon class="el-icon--right"><arrow-down /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="settings">
                    <el-icon><Setting /></el-icon>
                    设置
                  </el-dropdown-item>
                  <el-dropdown-item divided command="logout">
                    <el-icon><SwitchButton /></el-icon>
                    退出登录
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </header>
      <div class="page-body">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { getStoredTheme, toggleTheme } from '../utils/theme'
import {
  DataBoard, Coin, FolderOpened, Share, Tools, Document, Setting, Box, Branch, Sunny, Moon,
  ArrowDown, SwitchButton
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// 主题切换
const isDark = ref(getStoredTheme() === 'dark')
function handleToggleTheme() {
  isDark.value = toggleTheme() === 'dark'
}

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
      { path: '/repos', label: '仓库', icon: Coin },
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

function handleUserMenuCommand(command: string) {
  if (command === 'logout') {
    handleLogout()
  } else if (command === 'settings') {
    router.push('/settings')
  }
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
.content { flex: 1; margin-left: 220px; display: flex; flex-direction: column; }
.topbar { height: 56px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 0 24px; }
.topbar h2 { font-size: 16px; color: var(--text); font-weight: 600; }
.topbar-actions { display: flex; align-items: center; gap: 8px; }
.topbar-actions .el-button { color: var(--text-muted); font-size: 18px; }
.topbar-actions .el-button:hover { color: var(--accent); }
.user-menu-wrapper { margin-left: 8px; padding-left: 16px; border-left: 1px solid var(--border); }
.user-trigger {
  display: flex; align-items: center; gap: 10px; cursor: pointer;
  padding: 4px 10px; border-radius: 6px; transition: background .15s;
}
.user-trigger:hover { background: rgba(255,255,255,.05); }
.user-avatar { background: var(--accent); color: #fff; font-weight: 600; }
.user-info-box { display: flex; flex-direction: column; gap: 2px; line-height: 1; }
.user-name { color: var(--text); font-size: 13px; font-weight: 500; }
.user-role { transform: scale(0.8); transform-origin: left center; width: fit-content; }
.page-body { flex: 1; padding: 24px; overflow-y: auto; }
</style>
