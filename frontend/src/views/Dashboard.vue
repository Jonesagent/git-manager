<template>
  <div class="dashboard">
    <!-- 快捷操作 -->
    <div class="quick-actions">
      <el-card shadow="hover" class="qcard" @click="router.push('/monthly')">
        <el-icon size="28" color="#58a6ff"><FolderOpened /></el-icon>
        <div class="qtitle">月度分支管理</div>
        <div class="qdesc">创建 dev_YYYYMM、月末合并 main</div>
      </el-card>
      <el-card shadow="hover" class="qcard" @click="router.push('/repos')">
        <el-icon size="28" color="#3fb950"><Coin /></el-icon>
        <div class="qtitle">仓库总览</div>
        <div class="qdesc">{{ repos.length }} 个受管仓库</div>
      </el-card>
      <el-card shadow="hover" class="qcard" @click="router.push('/hotfix')">
        <el-icon size="28" color="#d29922"><Tools /></el-icon>
        <div class="qtitle">热修复向导</div>
        <div class="qdesc">从 main 拉取 hotfix 分支</div>
      </el-card>
      <el-card shadow="hover" class="qcard" @click="router.push('/audit')">
        <el-icon size="28" color="#8b949e"><Document /></el-icon>
        <div class="qtitle">审计日志</div>
        <div class="qdesc">操作记录追溯</div>
      </el-card>
    </div>

    <!-- 仓库状态卡片 -->
    <h3 class="section-title">仓库状态</h3>
    <div class="repo-grid" v-loading="loading">
      <el-card v-for="r in repos" :key="r.name" shadow="hover" class="repo-card" @click="router.push(`/repos/${r.name}`)">
        <div class="repo-header">
          <span class="repo-name">{{ r.name }}</span>
          <el-tag v-if="r.initialized" size="small" type="success">已同步</el-tag>
          <el-tag v-else size="small" type="info">未初始化</el-tag>
        </div>
        <div class="repo-meta" v-if="r.initialized">
          <div><span class="meta-label">分支:</span> {{ r.head }}</div>
          <div><span class="meta-label">HEAD:</span> <code>{{ r.headSha }}</code></div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { FolderOpened, Coin, Tools, Document } from '@element-plus/icons-vue'
import { api } from '../utils/api'

const router = useRouter()
const loading = ref(false)
const repos = ref<any[]>([])

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await api.get('/repos')
    repos.value = data.repos
  } finally { loading.value = false }
})
</script>

<style scoped>
.quick-actions { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
.qcard { cursor: pointer; text-align: center; transition: transform .15s; }
.qcard:hover { transform: translateY(-2px); }
.qtitle { margin-top: 8px; font-weight: 600; color: var(--text); }
.qdesc { margin-top: 4px; font-size: 12px; color: var(--text-muted); }
.section-title { color: var(--text); margin-bottom: 16px; font-size: 16px; }
.repo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.repo-card { cursor: pointer; }
.repo-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.repo-name { font-weight: 600; color: var(--accent); }
.repo-meta { font-size: 13px; color: var(--text-muted); }
.repo-meta div { margin: 4px 0; }
.meta-label { color: var(--text-muted); }
code { background: rgba(255,255,255,.06); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
@media (max-width: 1200px) { .quick-actions, .repo-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
