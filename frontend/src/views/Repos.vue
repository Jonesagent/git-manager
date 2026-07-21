<template>
  <div>
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <span class="repo-count">共 <strong>{{ mergedRepos.length }}</strong> 个受管仓库</span>
        <el-input v-model="search" placeholder="搜索仓库..." clearable size="default" style="width:220px" />
      </div>
      <el-button type="primary" :icon="Plus" @click="showAddDialog = true" :disabled="!auth.isTechLead">
        添加仓库
      </el-button>
    </div>

    <!-- 仓库卡片网格 -->
    <div class="repo-grid" v-loading="loading">
      <div v-for="r in filteredRepos" :key="r.name" class="repo-card" @click="goDetail(r.name)">
        <div class="card-head">
          <div class="card-title">
            <span class="repo-icon">{{ r.initialized ? '📦' : '📭' }}</span>
            <div>
              <div class="repo-name">{{ r.name }}</div>
              <div class="repo-full">{{ r.full_name }}</div>
            </div>
          </div>
          <el-tag v-if="r.private" size="small" type="danger" effect="dark">私有</el-tag>
        </div>

        <div class="card-meta">
          <div class="meta-item">
            <span class="meta-key">状态</span>
            <el-tag size="small" :type="r.initialized ? 'success' : 'info'">
              {{ r.initialized ? '已同步' : '未克隆' }}
            </el-tag>
          </div>
          <div class="meta-item">
            <span class="meta-key">当前分支</span>
            <span class="meta-val branch">{{ r.head || '—' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-key">HEAD</span>
            <code class="meta-val sha">{{ r.headSha || '—' }}</code>
          </div>
        </div>

        <div class="card-actions" @click.stop>
          <el-button size="small" text type="primary" :loading="fetching === r.name"
            :disabled="!r.initialized || !auth.isDeveloper"
            @click="handleFetch(r.name)">同步</el-button>
          <el-button size="small" text @click="goDetail(r.name)">详情</el-button>
          <el-button size="small" text type="danger" :disabled="!auth.isTechLead"
            @click="handleRemove(r)">移除</el-button>
        </div>
      </div>

      <!-- 添加卡片 -->
      <div class="repo-card add-card" @click="showAddDialog = true" v-if="auth.isTechLead">
        <el-icon :size="32"><Plus /></el-icon>
        <span>添加仓库</span>
        <span class="add-hint">从 GitHub 选择</span>
      </div>
    </div>

    <!-- 添加仓库对话框 -->
    <el-dialog v-model="showAddDialog" title="添加仓库" width="680px" @open="loadGithubRepos">
      <el-form inline>
        <el-form-item label="来源">
          <el-select v-model="addOwnerFilter" placeholder="全部" clearable size="default" style="width:180px">
            <el-option v-for="o in ownerOptions" :key="o" :label="o" :value="o" />
          </el-select>
        </el-form-item>
        <el-form-item label="搜索">
          <el-input v-model="addFilter" placeholder="仓库名..." clearable size="default" style="width:200px" />
        </el-form-item>
      </el-form>

      <el-table :data="filteredGithubRepos" v-loading="loadingGithub" height="350px"
        @row-click="handleSelectRepo" highlight-current-row size="small">
        <el-table-column label="" width="46">
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
        <el-table-column label="更新时间" width="110">
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
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../utils/api'
import { useAuthStore } from '../stores/auth'
import Terminal from '../components/Terminal.vue'

interface Line { type: 'cmd' | 'stdout' | 'stderr' | 'info' | 'success' | 'error'; text: string }

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const fetching = ref('')
const search = ref('')
const repos = ref<any[]>([])
const managedDetails = ref<any[]>([])

const showAddDialog = ref(false)
const loadingGithub = ref(false)
const githubRepos = ref<any[]>([])
const addFilter = ref('')
const addOwnerFilter = ref('')
const selectedRepo = ref('')
const selectedRepoData = ref<any>(null)
const cloneNow = ref(true)
const adding = ref(false)
const cloning = ref(false)
const cloneLines = ref<Line[]>([])

// 合并 repos（本地状态）+ managedDetails（GitHub 信息）
const mergedRepos = computed(() => {
  return repos.value.map(r => {
    const detail = managedDetails.value.find(d => d.name === r.name)
    return { ...r, ...detail }
  })
})

const filteredRepos = computed(() => {
  if (!search.value) return mergedRepos.value
  const q = search.value.toLowerCase()
  return mergedRepos.value.filter(r =>
    r.name.toLowerCase().includes(q) || (r.full_name || '').toLowerCase().includes(q)
  )
})

const ownerOptions = computed(() => Array.from(new Set(githubRepos.value.map(r => r.owner))))

const filteredGithubRepos = computed(() => {
  let list = githubRepos.value
  if (addOwnerFilter.value) list = list.filter(r => r.owner === addOwnerFilter.value)
  if (addFilter.value) {
    const q = addFilter.value.toLowerCase()
    list = list.filter(r => r.full_name.toLowerCase().includes(q))
  }
  return list
})

function formatDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toISOString().replace('T', ' ').substring(0, 19)
}

function goDetail(name: string) {
  router.push(`/repos/${name}`)
}

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/repos')
    repos.value = data.repos
    managedDetails.value = data.managedDetails || []
  } finally { loading.value = false }
}

async function handleFetch(name: string) {
  fetching.value = name
  try {
    const { data } = await api.post(`/repos/${name}/fetch`)
    if (data.code === 0) ElMessage.success(`${name} 同步成功`)
    else ElMessage.warning(`${name} 同步完成（有警告）`)
    await load()
  } catch (e: any) {
    ElMessage.error(`${name} 同步失败: ${e.response?.data?.stderr || e.message}`)
  } finally { fetching.value = '' }
}

async function handleRemove(row: any) {
  try {
    await ElMessageBox.confirm(
      `确认从管理列表移除 ${row.full_name || row.name}？\n（不会删除本地文件和 GitHub 仓库）`,
      '移除仓库',
      { confirmButtonText: '确认移除', cancelButtonText: '取消', type: 'warning' },
    )
    await api.delete(`/repos/manage/${row.name}`)
    ElMessage.success('已移除')
    await load()
  } catch { /* cancelled */ }
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

async function handleAdd() {
  if (!selectedRepo.value) return
  adding.value = true
  try {
    const { data } = await api.post('/repos/manage/add', { full_name: selectedRepo.value })
    if (data.ok) {
      ElMessage.success(`已添加 ${selectedRepo.value}`)
      await load()
      showAddDialog.value = false
      const sshUrl = selectedRepoData.value?.ssh_url
      const name = selectedRepoData.value?.name
      selectedRepo.value = ''
      if (cloneNow.value && sshUrl) await cloneRepo(sshUrl, name)
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
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
            await load()
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

onMounted(load)
</script>

<style scoped>
.toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.toolbar-left { display: flex; align-items: center; gap: 16px; }
.repo-count { color: var(--text-muted); font-size: 14px; }
.repo-count strong { color: var(--accent); font-size: 16px; }

.repo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.repo-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  transition: all .18s ease;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.repo-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,.35);
}

.card-head { display: flex; align-items: flex-start; justify-content: space-between; }
.card-title { display: flex; gap: 10px; align-items: center; }
.repo-icon { font-size: 22px; }
.repo-name { font-weight: 700; font-size: 15px; color: var(--text); }
.repo-full { font-size: 11px; color: var(--text-muted); margin-top: 1px; }

.card-meta { display: flex; flex-direction: column; gap: 6px; }
.meta-item { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.meta-key { color: var(--text-muted); min-width: 64px; }
.meta-val { color: var(--text); }
.meta-val.branch { color: var(--yellow, #d29922); font-weight: 600; }
.meta-val.sha { font-size: 12px; color: var(--accent); }

.card-actions {
  display: flex; gap: 4px; border-top: 1px solid var(--border);
  padding-top: 10px; margin-top: auto;
}

.add-card {
  align-items: center; justify-content: center;
  border-style: dashed; color: var(--text-muted);
  min-height: 150px;
}
.add-card:hover { color: var(--accent); }
.add-hint { font-size: 11px; opacity: .6; }

.selected-info {
  margin-top: 12px; padding: 10px 16px;
  background: rgba(88,166,255,.05); border-radius: 8px;
  display: flex; align-items: center; gap: 16px;
}
</style>
