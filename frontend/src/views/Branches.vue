<template>
  <div>
    <!-- 仓库选择 -->
    <div class="repo-selector">
      <el-select v-model="selectedRepo" placeholder="选择仓库" filterable @change="loadBranches" style="width:240px">
        <el-option v-for="r in repos" :key="r" :label="r" :value="r" />
      </el-select>
      <el-input v-model="search" placeholder="搜索分支..." clearable size="default" style="margin-left:12px;width:260px" />
      <el-button @click="loadBranches" :icon="Refresh" :loading="loadingBranches" style="margin-left:8px">刷新</el-button>
      <el-button type="primary" @click="showCreateDialog = true" :icon="Plus" style="margin-left:8px"
        :disabled="!selectedRepo">创建分支</el-button>
    </div>

    <!-- 分支列表 -->
    <el-table :data="filteredBranches" v-loading="loadingBranches" stripe style="margin-top:16px" size="default">
      <el-table-column prop="name" label="分支名" min-width="220">
        <template #default="{ row }">
          <span :class="['branch-name', row.kind]">{{ row.name }}</span>
        </template>
      </el-table-column>
      <el-table-column label="类型" width="90" key="kind">
        <template #default="{ row }">
          <el-tag size="small" :type="kindTagType(row.kind || 'other')">{{ kindLabels[row.kind || 'other'] || row.kind || '其他' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="来源" width="70" key="source">
        <template #default="{ row }">{{ row.remote ? '远程' : '本地' }}</template>
      </el-table-column>
      <el-table-column prop="sha" label="最新 SHA" width="120" />
      <el-table-column prop="last_commit_author" label="提交者" width="110" />
      <el-table-column prop="last_commit_date" label="提交时间" width="170">
        <template #default="{ row }">{{ formatDate(row.last_commit_date) }}</template>
      </el-table-column>
      <el-table-column prop="last_commit_subject" label="提交信息" min-width="200" show-overflow-tooltip />
      <el-table-column label="操作" width="100" show-overflow-tooltip key="actions">
        <template #default="{ row }">
          <el-button size="small" type="danger" text :icon="Delete"
            :disabled="row.kind === 'main' || !auth.isTechLead"
            @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 创建分支对话框 -->
    <el-dialog v-model="showCreateDialog" title="创建新分支" width="500px">
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="仓库">
          <el-tag>{{ selectedRepo }}</el-tag>
        </el-form-item>
        <el-form-item label="分支名">
          <el-input v-model="createForm.branch" placeholder="如 feature/202607_add_sms 或 dev_202608" />
        </el-form-item>
        <el-form-item label="源分支">
          <el-select v-model="createForm.source" style="width:100%">
            <el-option label="main" value="main" />
            <el-option v-for="b in sourceBranchOptions" :key="b.name" :label="b.name" :value="b.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="推送到远端">
          <el-switch v-model="createForm.push" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreate">确认创建</el-button>
      </template>
    </el-dialog>

    <!-- 执行终端 -->
    <div v-if="terminalLines.length > 0" style="margin-top:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="color:var(--text-muted);font-size:14px">执行日志</span>
        <el-button text size="small" @click="terminalLines = []">清空</el-button>
      </div>
      <Terminal :lines="terminalLines" :running="executing" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { Plus, Delete, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../utils/api'
import { useAuthStore } from '../stores/auth'
import Terminal from '../components/Terminal.vue'

interface Line { type: 'cmd' | 'stdout' | 'stderr' | 'info' | 'success' | 'error'; text: string }

const auth = useAuthStore()
const repos = ref<string[]>([])
const selectedRepo = ref('')
const search = ref('')
const loadingBranches = ref(false)
const branches = ref<any[]>([])

const showCreateDialog = ref(false)
const creating = ref(false)
const executing = ref(false)
const terminalLines = ref<Line[]>([])

const createForm = reactive<{ branch: string; source: string; push: boolean }>({
  branch: '', source: 'main', push: true,
})

const kindLabels: Record<string, string> = { main: '主分支', monthly: '月度', feature: '特性', hotfix: '热修复', other: '其他' }
const kindTagTypes: Record<string, any> = { main: 'danger', monthly: 'warning', feature: 'success', hotfix: '', other: 'info' }

function formatDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toISOString().replace('T', ' ').substring(0, 19)
}
const filteredBranches = computed(() => {
  if (!search.value) return branches.value
  return branches.value.filter(b => b.name.includes(search.value))
})

const sourceBranchOptions = computed(() => {
  return branches.value.filter(b => b.kind !== 'main')
})

async function loadRepos() {
  try {
    const { data } = await api.get('/repos')
    repos.value = data.managed
    if (repos.value.length > 0) {
      selectedRepo.value = repos.value[0]
      await loadBranches()
    }
  } catch {}
}

async function loadBranches() {
  if (!selectedRepo.value) return
  loadingBranches.value = true
  try {
    const { data } = await api.get(`/repos/${selectedRepo.value}/branches`)
    branches.value = data.branches || []
  } catch {
    ElMessage.error('加载分支失败')
    branches.value = []
  } finally { loadingBranches.value = false }
}

async function handleCreate() {
  if (!createForm.branch || !/^[a-zA-Z0-9._\/-]+$/.test(createForm.branch)) {
    return ElMessage.warning('请输入合法的分支名（字母、数字、._/-）')
  }
  showCreateDialog.value = false
  executing.value = true
  terminalLines.value = [{ type: 'cmd', text: `create-branch.sh ${selectedRepo.value} ${createForm.branch} ${createForm.source}${createForm.push ? ' --push' : ''}` }]

  try {
    await runSSE('/api/branches/create-stream', {
      name: selectedRepo.value,
      branch: createForm.branch,
      source: createForm.source,
      push: createForm.push,
    })
    await loadBranches()
  } finally {
    executing.value = false
    createForm.branch = ''
  }
}

async function handleDelete(branch: any) {
  if (branch.kind === 'main') return ElMessage.warning('main 分支不允许删除')
  try {
    await ElMessageBox.confirm(
      `确认删除 ${selectedRepo.value} 的分支 ${branch.name}？\n此操作不可撤销，将同时删除本地和远程分支。`,
      '危险操作',
      { confirmButtonText: '⚠️ 确认删除', cancelButtonText: '取消', type: 'error' },
    )
  } catch { return }

  executing.value = true
  terminalLines.value = [{ type: 'cmd', text: `delete-branch.sh ${selectedRepo.value} ${branch.name}` }]
  try {
    await runSSE('/api/branches/delete-stream', {
      name: selectedRepo.value,
      branch: branch.name,
    })
    await loadBranches()
  } finally { executing.value = false }
}

async function runSSE(url: string, body: any) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auth.token}`,
    },
    body: JSON.stringify(body),
  })
  if (!resp.ok || !resp.body) {
    const text = await resp.text()
    terminalLines.value.push({ type: 'error', text: `HTTP ${resp.status}: ${text}` })
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
        terminalLines.value.push({ type: 'info', text: `▶ pid=${data.pid}` })
      } else if (event === 'stdout') {
        terminalLines.value.push({ type: 'stdout', text: data.line })
      } else if (event === 'stderr') {
        terminalLines.value.push({ type: 'stderr', text: data.line })
      } else if (event === 'done') {
        if (data.code === 0) {
          terminalLines.value.push({ type: 'success', text: `✅ 操作成功 (exit=0)` })
          ElMessage.success('操作成功')
        } else if (data.code === 10) {
          terminalLines.value.push({ type: 'info', text: `⏭️ ${data.result || '已存在/不存在，跳过'}` })
          ElMessage.info(data.result || '已跳过')
        } else if (data.code === 30) {
          terminalLines.value.push({ type: 'error', text: '🚫 受保护分支，禁止操作' })
          ElMessage.error('受保护分支')
        } else {
          terminalLines.value.push({ type: 'error', text: `❌ 失败 (exit=${data.code})` })
          ElMessage.error('操作失败')
        }
      }
    }
  }
}

onMounted(loadRepos)
</script>

<style scoped>
.repo-selector { display: flex; align-items: center; }
.branch-name { font-weight: 600; }
.branch-name.main { color: var(--red); }
.branch-name.monthly { color: var(--yellow); }
.branch-name.feature { color: var(--green); }
.branch-name.hotfix { color: var(--accent); }
</style>
