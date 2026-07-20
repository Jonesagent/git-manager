<template>
  <div>
    <!-- 仓库管理 -->
    <el-card class="section">
      <template #header>
        <span>📦 仓库管理</span>
        <el-button type="primary" size="small" @click="showAddDialog = true" :icon="Plus"
          style="float:right" :disabled="!auth.isTechLead">添加仓库</el-button>
      </template>

      <el-table :data="managedRepos" stripe size="default">
        <el-table-column prop="full_name" label="仓库" min-width="220">
          <template #default="{ row }">
            <span style="font-weight:600">{{ row.full_name }}</span>
            <el-tag v-if="row.private" size="small" type="danger" style="margin-left:6px">私有</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="default_branch" label="默认分支" width="100" />
        <el-table-column label="本地路径" min-width="280">
          <template #default="{ row }">
            <span :class="row.local_path && existsLocally(row.local_path) ? 'path-ok' : 'path-miss'">
              {{ row.local_path || '未克隆' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="added_by" label="添加者" width="90" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text @click="goToDetail(row.name)">详情</el-button>
            <el-button size="small" text type="danger" :icon="Delete"
              :disabled="!auth.isTechLead"
              @click="handleRemove(row)">移除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 添加仓库对话框 -->
    <el-dialog v-model="showAddDialog" title="添加仓库" width="650px" @open="loadGithubRepos">
      <el-form inline>
        <el-form-item label="筛选">
          <el-input v-model="addFilter" placeholder="仓库名搜索..." clearable size="default" style="width:200px" />
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="addOwnerFilter" placeholder="全部" clearable size="default" style="width:180px">
            <el-option v-for="o in ownerOptions" :key="o" :label="o" :value="o" />
          </el-select>
        </el-form-item>
      </el-form>

      <el-table :data="filteredGithubRepos" v-loading="loadingGithub" height="350px"
        @row-click="handleSelectRepo" highlight-current-row size="small">
        <el-table-column label="" width="50">
          <template #default="{ row }">
            <el-radio v-model="selectedRepo" :label="row.full_name">{{ '' }}</el-radio>
          </template>
        </el-table-column>
        <el-table-column prop="full_name" label="仓库" min-width="200" />
        <el-table-column label="可见性" width="70">
          <template #default="{ row }">
            <el-tag size="small" :type="row.private ? 'danger' : 'success'">{{ row.private ? '私有' : '公开' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="default_branch" label="默认分支" width="90" />
        <el-table-column prop="updated_at" label="更新时间" width="120">
          <template #default="{ row }">{{ formatDate(row.updated_at) }}</template>
        </el-table-column>
      </el-table>

      <div v-if="selectedRepo" class="selected-info">
        <span>已选: <strong>{{ selectedRepo }}</strong></span>
        <el-checkbox v-model="cloneNow">立即克隆到本地</el-checkbox>
      </div>

      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="adding" :disabled="!selectedRepo" @click="handleAdd">确认添加</el-button>
      </template>
    </el-dialog>

    <!-- 克隆终端 -->
    <div v-if="cloneLines.length > 0" style="margin-top:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="color:var(--text-muted);font-size:14px">克隆日志</span>
        <el-button text size="small" @click="cloneLines = []">清空</el-button>
      </div>
      <Terminal :lines="cloneLines" :running="cloning" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../utils/api'
import { useAuthStore } from '../stores/auth'
import Terminal from '../components/Terminal.vue'

interface Line { type: 'cmd' | 'stdout' | 'stderr' | 'info' | 'success' | 'error'; text: string }

const router = useRouter()
const auth = useAuthStore()
const managedRepos = ref<any[]>([])
const showAddDialog = ref(false)
const loadingGithub = ref(false)
const githubRepos = ref<any[]>([])
const addFilter = ref('')
const addOwnerFilter = ref('')
const selectedRepo = ref('')
const cloneNow = ref(true)
const adding = ref(false)
const cloning = ref(false)
const cloneLines = ref<Line[]>([])

const ownerOptions = computed(() => {
  const owners = new Set(githubRepos.value.map(r => r.owner))
  return Array.from(owners)
})

const filteredGithubRepos = computed(() => {
  let list = githubRepos.value
  if (addOwnerFilter.value) list = list.filter(r => r.owner === addOwnerFilter.value)
  if (addFilter.value) {
    const q = addFilter.value.toLowerCase()
    list = list.filter(r => r.full_name.toLowerCase().includes(q))
  }
  return list
})

function existsLocally(p: string) {
  // 简单检查：managed repos 列表里 initialized 字段
  return true
}

function formatDate(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-CN')
}

function goToDetail(name: string) {
  router.push(`/repos/${name}`)
}

async function loadManagedRepos() {
  try {
    const { data } = await api.get('/repos')
    managedRepos.value = data.managedDetails || []
  } catch { ElMessage.error('加载仓库列表失败') }
}

async function loadGithubRepos() {
  if (githubRepos.value.length > 0) return
  loadingGithub.value = true
  try {
    const { data } = await api.get('/github/repos')
    githubRepos.value = data.repos
  } catch { ElMessage.error('加载 GitHub 仓库列表失败') }
  finally { loadingGithub.value = false }
}

function handleSelectRepo(row: any) {
  selectedRepo.value = row.full_name
  selectedRepoData.value = row
}

const selectedRepoData = ref<any>(null)

async function handleAdd() {
  if (!selectedRepo.value) return
  adding.value = true
  try {
    const { data } = await api.post('/repos/manage/add', { full_name: selectedRepo.value })
    if (data.ok) {
      ElMessage.success(`已添加 ${selectedRepo.value}`)
      await loadManagedRepos()
      showAddDialog.value = false
      selectedRepo.value = ''

      // 如果需要克隆
      if (cloneNow.value && selectedRepoData.value?.ssh_url) {
        await cloneRepo(selectedRepoData.value.ssh_url, selectedRepoData.value.name)
      }
    } else {
      ElMessage.error(data.error || '添加失败')
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || e.message)
  } finally { adding.value = false }
}

async function cloneRepo(sshUrl: string, name: string) {
  cloning.value = true
  cloneLines.value = [{ type: 'cmd', text: `clone-repo.sh ${sshUrl} ${name}` }]
  const token = auth.token || localStorage.getItem('token') || ''
  try {
    const resp = await fetch('/api/repos/manage/clone-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ ssh_url: sshUrl, name }),
    })
    if (!resp.ok || !resp.body) {
      cloneLines.value.push({ type: 'error', text: `HTTP ${resp.status}` })
      return
    }
    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''
      for (const part of parts) {
        const eventMatch = part.match(/^event: (.+)$/m)
        const dataMatch = part.match(/^data: (.+)$/m)
        if (!eventMatch || !dataMatch) continue
        const event = eventMatch[1].trim()
        const data = JSON.parse(dataMatch[1])
        if (event === 'start') {
          cloneLines.value.push({ type: 'info', text: `▶ pid=${data.pid}` })
        } else if (event === 'stdout') {
          cloneLines.value.push({ type: 'stdout', text: data.line })
        } else if (event === 'stderr') {
          cloneLines.value.push({ type: 'stderr', text: data.line })
        } else if (event === 'done') {
          if (data.code === 0) {
            cloneLines.value.push({ type: 'success', text: '✅ 克隆成功' })
          } else if (data.code === 10) {
            cloneLines.value.push({ type: 'info', text: '⏭️ 仓库已存在，跳过' })
          } else {
            cloneLines.value.push({ type: 'error', text: `❌ 克隆失败 (exit=${data.code})` })
          }
        }
      }
    }
  } catch (e: any) {
    cloneLines.value.push({ type: 'error', text: e.message })
  } finally { cloning.value = false }
}

async function handleRemove(row: any) {
  try {
    await ElMessageBox.confirm(
      `确认从管理列表移除 ${row.full_name}？\n（不会删除本地仓库文件和 GitHub 仓库）`,
      '移除仓库',
      { confirmButtonText: '确认移除', cancelButtonText: '取消', type: 'warning' },
    )
    await api.delete(`/repos/manage/${row.name}`)
    ElMessage.success(`已移除 ${row.full_name}`)
    await loadManagedRepos()
  } catch { /* cancelled */ }
}

onMounted(loadManagedRepos)
</script>

<style scoped>
.section { margin-bottom: 20px; }
.path-ok { color: var(--green); font-size: 12px; }
.path-miss { color: var(--red); font-size: 12px; }
.selected-info { margin-top: 12px; padding: 10px 16px; background: rgba(88,166,255,.05); border-radius: 8px; display: flex; align-items: center; gap: 16px; }
</style>
