<template>
  <div v-if="repoName">
    <el-tabs v-model="activeTab" class="repo-detail-tabs">
      <!-- Tab 1: 分支列表 -->
      <el-tab-pane label="分支列表" name="branches">
        <div style="margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <el-input v-model="search" placeholder="搜索分支..." clearable size="default" style="width:240px" />
          <el-button @click="loadBranches" :icon="Refresh" :loading="loadingBranches">刷新</el-button>
          <el-button type="primary" @click="showCreateDialog = true" :icon="Plus"
            :disabled="!auth.isTechLead && !auth.isDeveloper">创建分支</el-button>
        </div>

        <el-table :data="filteredBranches" v-loading="loadingBranches" stripe size="default">
          <el-table-column prop="name" label="分支名" min-width="220">
            <template #default="{ row }">
              <span :class="['branch-name', row.kind]">{{ row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="90">
            <template #default="{ row }">
              <el-tag size="small" :type="kindTagType(row.kind)">{{ kindLabels[row.kind] || row.kind }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="来源" width="70">
            <template #default="{ row }">{{ row.remote ? '远程' : '本地' }}</template>
          </el-table-column>
          <el-table-column prop="sha" label="SHA" width="120" />
          <el-table-column prop="last_commit_author" label="提交者" width="110" />
          <el-table-column prop="last_commit_date" label="提交时间" width="170" />
          <el-table-column prop="last_commit_subject" label="提交信息" min-width="200" show-overflow-tooltip />
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button size="small" text type="success" :icon="Switch"
                :disabled="row.kind === 'main'"
                @click="handleCheckout(row)">切换</el-button>
              <el-button size="small" text type="danger" :icon="Delete"
                :disabled="row.kind === 'main' || !auth.isTechLead"
                @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- Tab 2: GitHub 概览（API 聚合，不用 iframe） -->
      <el-tab-pane label="GitHub 概览" name="overview">
        <div v-loading="loadingOverview">
          <div v-if="overview" class="overview-grid">
            <!-- 仓库信息卡 -->
            <el-card class="overview-card">
              <template #header>
                <span>📦 {{ overview.repo.full_name }}</span>
                <el-link :href="overview.repo.html_url" target="_blank" type="primary" style="float:right">
                  GitHub ↗
                </el-link>
              </template>
              <div class="repo-meta">
                <div v-if="overview.repo.description" class="meta-row">
                  <span class="meta-label">描述</span>
                  <span>{{ overview.repo.description }}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">默认分支</span>
                  <el-tag size="small">{{ overview.repo.default_branch }}</el-tag>
                </div>
                <div class="meta-row">
                  <span class="meta-label">语言</span>
                  <span>{{ overview.repo.language || '—' }}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">License</span>
                  <span>{{ overview.repo.license || '—' }}</span>
                </div>
                <div class="meta-row stats">
                  <span>⭐ {{ overview.repo.stargazers_count }}</span>
                  <span>🍴 {{ overview.repo.forks_count }}</span>
                  <span>📋 {{ overview.repo.open_issues_count }} issues</span>
                </div>
              </div>
            </el-card>

            <!-- 分支概览 -->
            <el-card class="overview-card">
              <template #header><span>🌿 分支 ({{ overview.branches.length }})</span></template>
              <div class="branch-list">
                <div v-for="b in overview.branches.slice(0, 20)" :key="b.name" class="branch-row">
                  <span class="branch-name" :class="b.name === overview.repo.default_branch ? 'main' : 'other'">{{ b.name }}</span>
                  <span class="branch-sha">{{ b.sha }}</span>
                  <el-tag v-if="b.protected" size="small" type="warning">protected</el-tag>
                </div>
              </div>
            </el-card>

            <!-- 最近提交 -->
            <el-card class="overview-card">
              <template #header><span>📝 最近提交</span></template>
              <div class="commit-list">
                <div v-for="c in overview.commits" :key="c.sha" class="commit-row">
                  <img v-if="c.avatar" :src="c.avatar" class="commit-avatar" />
                  <div class="commit-info">
                    <div class="commit-msg">{{ c.message }}</div>
                    <div class="commit-meta">
                      <span>{{ c.author }}</span>
                      <span>{{ c.sha }}</span>
                      <span>{{ formatDate(c.date) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </el-card>

            <!-- PR 列表 -->
            <el-card class="overview-card">
              <template #header><span>🔀 Pull Requests ({{ overview.pulls.length }})</span></template>
              <div v-if="overview.pulls.length === 0" class="empty">暂无 PR</div>
              <div v-for="p in overview.pulls" :key="p.number" class="pr-row">
                <el-tag size="small" :type="p.state === 'open' ? 'success' : 'info'">{{ p.state }}</el-tag>
                <span class="pr-title">#{{ p.number }} {{ p.title }}</span>
                <span class="pr-user">@{{ p.user }}</span>
                <el-link :href="p.html_url" target="_blank" type="primary" size="small">查看 ↗</el-link>
              </div>
            </el-card>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 创建分支对话框 -->
    <el-dialog v-model="showCreateDialog" title="创建新分支" width="500px">
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="仓库">
          <el-tag>{{ repoName }}</el-tag>
        </el-form-item>
        <el-form-item label="分支名">
          <el-input v-model="createForm.branch" placeholder="如 feature/add_login 或 dev_202608" />
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
  <div v-else>
    <el-empty description="请从仓库管理页面选择一个仓库" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Plus, Delete, Refresh, Switch } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../utils/api'
import { useAuthStore } from '../stores/auth'
import Terminal from '../components/Terminal.vue'

interface Line { type: 'cmd' | 'stdout' | 'stderr' | 'info' | 'success' | 'error'; text: string }

const route = useRoute()
const auth = useAuthStore()
const repoName = computed(() => route.params.name as string)
const activeTab = ref('branches')

const search = ref('')
const loadingBranches = ref(false)
const branches = ref<any[]>([])
const showCreateDialog = ref(false)
const creating = ref(false)
const executing = ref(false)
const terminalLines = ref<Line[]>([])

const loadingOverview = ref(false)
const overview = ref<any>(null)

const createForm = reactive<{ branch: string; source: string; push: boolean }>({
  branch: '', source: 'main', push: true,
})

const kindLabels: Record<string, string> = { main: '主分支', monthly: '月度', feature: '特性', hotfix: '热修复', other: '其他' }
const kindTagTypes: Record<string, any> = { main: 'danger', monthly: 'warning', feature: 'success', hotfix: '', other: 'info' }

const filteredBranches = computed(() => {
  if (!search.value) return branches.value
  return branches.value.filter(b => b.name.includes(search.value))
})

const sourceBranchOptions = computed(() => branches.value.filter(b => b.kind !== 'main'))

function formatDate(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' })
}

async function loadBranches() {
  if (!repoName.value) return
  loadingBranches.value = true
  try {
    const { data } = await api.get(`/repos/${repoName.value}/branches`)
    branches.value = data.branches || []
  } catch {
    ElMessage.error('加载分支失败')
    branches.value = []
  } finally { loadingBranches.value = false }
}

async function loadOverview() {
  if (!repoName.value) return
  loadingOverview.value = true
  try {
    const { data } = await api.get(`/github/overview/lionking-cloud/${repoName.value}`)
    overview.value = data
  } catch {
    ElMessage.error('加载 GitHub 概览失败')
  } finally { loadingOverview.value = false }
}

async function handleCreate() {
  if (!createForm.branch || !/^[a-zA-Z0-9._\/-]+$/.test(createForm.branch)) {
    return ElMessage.warning('请输入合法的分支名')
  }
  showCreateDialog.value = false
  executing.value = true
  terminalLines.value = [{ type: 'cmd', text: `create-branch.sh ${repoName.value} ${createForm.branch} ${createForm.source}` }]
  try {
    await runSSE('/api/branches/create-stream', {
      name: repoName.value, branch: createForm.branch, source: createForm.source, push: createForm.push,
    })
    await loadBranches()
  } finally {
    executing.value = false
    createForm.branch = ''
  }
}

async function handleDelete(branch: any) {
  if (branch.kind === 'main') return
  try {
    await ElMessageBox.confirm(
      `确认删除 ${repoName.value} 的分支 ${branch.name}？`,
      '危险操作',
      { confirmButtonText: '⚠️ 确认删除', cancelButtonText: '取消', type: 'error' },
    )
  } catch { return }
  executing.value = true
  terminalLines.value = [{ type: 'cmd', text: `delete-branch.sh ${repoName.value} ${branch.name}` }]
  try {
    await runSSE('/api/branches/delete-stream', { name: repoName.value, branch: branch.name })
    await loadBranches()
  } finally { executing.value = false }
}

async function handleCheckout(branch: any) {
  try {
    await ElMessageBox.confirm(
      `确认切换 ${repoName.value} 的本地分支到 ${branch.name}？`,
      '切换分支',
      { confirmButtonText: '确认切换', cancelButtonText: '取消', type: 'info' },
    )
  } catch { return }
  executing.value = true
  terminalLines.value = [{ type: 'cmd', text: `checkout-branch.sh ${repoName.value} ${branch.name}` }]
  try {
    await runSSE(`/repos/${repoName.value}/checkout-stream`, { branch: branch.name })
    await loadBranches()
  } finally { executing.value = false }
}

async function runSSE(url: string, body: any) {
  const token = auth.token || localStorage.getItem('token') || ''
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (!resp.ok || !resp.body) {
    const text = await resp.text()
    terminalLines.value.push({ type: 'error', text: `HTTP ${resp.status}: ${text.substring(0, 200)}` })
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
          terminalLines.value.push({ type: 'success', text: '✅ 操作成功' })
          ElMessage.success('操作成功')
        } else if (data.code === 10) {
          terminalLines.value.push({ type: 'info', text: `⏭️ ${data.result || '跳过'}` })
        } else if (data.code === 30) {
          terminalLines.value.push({ type: 'error', text: '🚫 受保护分支' })
        } else {
          terminalLines.value.push({ type: 'error', text: `❌ 失败 (exit=${data.code})` })
        }
      }
    }
  }
}

watch(repoName, () => { if (repoName.value) loadBranches() })
watch(activeTab, (tab) => {
  if (tab === 'overview' && !overview.value) loadOverview()
})
onMounted(() => { if (repoName.value) loadBranches() })
</script>

<style scoped>
.branch-name { font-weight: 600; }
.branch-name.main { color: #f85149; }
.branch-name.monthly { color: #d29922; }
.branch-name.feature { color: #3fb950; }
.branch-name.hotfix { color: #58a6ff; }
.branch-name.other { color: #c9d1d9; }
.overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.overview-card { margin-bottom: 0; }
.repo-meta { display: flex; flex-direction: column; gap: 8px; }
.meta-row { display: flex; gap: 12px; align-items: center; font-size: 14px; }
.meta-label { color: var(--text-muted); min-width: 60px; }
.stats { gap: 20px; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); }
.branch-list { display: flex; flex-direction: column; gap: 4px; max-height: 300px; overflow-y: auto; }
.branch-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
.branch-sha { color: var(--text-muted); font-size: 12px; font-family: monospace; }
.commit-list { display: flex; flex-direction: column; gap: 12px; max-height: 350px; overflow-y: auto; }
.commit-row { display: flex; gap: 10px; align-items: flex-start; }
.commit-avatar { width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; }
.commit-info { flex: 1; }
.commit-msg { font-size: 13px; color: var(--text); }
.commit-meta { display: flex; gap: 12px; font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.pr-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid rgba(48,54,61,.3); }
.pr-title { flex: 1; font-size: 13px; }
.pr-user { font-size: 12px; color: var(--text-muted); }
.empty { color: var(--text-muted); text-align: center; padding: 20px; }
</style>
