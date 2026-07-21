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

        <el-table :data="filteredBranches" v-loading="loadingBranches" stripe border size="default">
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
          <el-table-column prop="sha" label="SHA" width="120" />
          <el-table-column prop="last_commit_author" label="提交者" width="110" />
          <el-table-column prop="last_commit_date" label="提交时间" width="170" />
          <el-table-column prop="last_commit_subject" label="提交信息" min-width="200" show-overflow-tooltip />
          <el-table-column label="操作" width="150" show-overflow-tooltip key="actions">
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
      <!-- Tab 3: README -->
      <el-tab-pane label="README" name="readme">
        <div v-loading="loadingReadme">
          <div v-if="readmeContent" class="readme-wrap">
            <div class="readme-toolbar">
              <el-select v-if="subReadmes.length > 1" v-model="readmeFilename" size="small"
                style="width:260px" @change="loadReadmeByFile">
                <el-option v-for="f in subReadmes" :key="f" :label="f" :value="f" />
              </el-select>
              <span v-else class="readme-file">{{ readmeFilename }}</span>
              <el-tag size="small" :type="readmeSource === 'local' ? 'success' : 'info'">
                {{ readmeSource === 'local' ? '本地文件' : 'GitHub' }}
              </el-tag>
              <el-button size="small" text @click="loadReadme" style="margin-left:auto">刷新</el-button>
            </div>
            <div class="readme-body" v-html="renderedReadme"></div>
          </div>
          <el-empty v-else-if="!loadingReadme" description="该仓库没有 README 文件" />
        </div>
      </el-tab-pane>

      <!-- Tab 4: 文件浏览（本地仓库，左目录/右内容） -->
      <el-tab-pane label="文件" name="files">
        <div v-loading="loadingFiles" class="files-browser">
          <div class="files-breadcrumb">
            <span class="crumb" @click="navigateTo('')">📁 {{ repoName }}</span>
            <template v-for="(seg, i) in pathSegments" :key="i">
              <span class="crumb-sep">/</span>
              <span class="crumb" @click="navigateTo(seg.path)">{{ seg.name }}</span>
            </template>
            <el-button size="small" text style="margin-left:auto" @click="loadFiles(currentPath)">刷新</el-button>
          </div>
          <div class="files-panes">
            <!-- 左：目录/文件列表 -->
            <div class="files-list">
              <div v-if="currentPath" class="file-row up" @click="goUp">
                <span class="file-icon">⬆️</span>
                <span class="file-name">..</span>
              </div>
              <div v-for="e in fileEntries" :key="e.name" class="file-row"
                :class="{ active: selectedFile === joinPath(currentPath, e.name) }"
                @click="e.type === 'dir' ? navigateTo(joinPath(currentPath, e.name)) : openFile(joinPath(currentPath, e.name))">
                <span class="file-icon">{{ e.type === 'dir' ? '📁' : fileIcon(e.name) }}</span>
                <span class="file-name">{{ e.name }}</span>
                <span v-if="e.type === 'file'" class="file-size">{{ formatSize(e.size) }}</span>
              </div>
              <el-empty v-if="!loadingFiles && fileEntries.length === 0" description="空目录" :image-size="60" />
            </div>
            <!-- 右：文件内容预览 -->
            <div class="file-preview">
              <div v-if="!selectedFile" class="preview-empty">
                <el-empty description="选择左侧文件查看内容" :image-size="80" />
              </div>
              <template v-else>
                <div class="preview-header">
                  <span class="preview-path">{{ selectedFile }}</span>
                  <el-tag v-if="fileMeta.binary" size="small" type="warning">二进制</el-tag>
                  <el-tag v-else-if="fileMeta.tooLarge" size="small" type="warning">过大</el-tag>
                  <el-tag v-else size="small">{{ formatSize(fileMeta.size || 0) }}</el-tag>
                </div>
                <div v-if="fileMeta.binary || fileMeta.tooLarge" class="preview-notice">
                  {{ fileMeta.binary ? '二进制文件，无法预览' : '文件超过 2MB，无法预览' }}
                </div>
                <div v-else-if="isMarkdown(selectedFile)" class="readme-body" v-html="renderedFileContent"></div>
                <pre v-else class="code-preview">{{ fileContent }}</pre>
              </template>
            </div>
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
import { marked } from 'marked'
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

const loadingReadme = ref(false)
const readmeContent = ref('')
const readmeFilename = ref('')
const readmeSource = ref('')
const subReadmes = ref<string[]>([])

// 文件浏览状态
const loadingFiles = ref(false)
const filesInited = ref(false)
const currentPath = ref('')
const fileEntries = ref<any[]>([])
const selectedFile = ref('')
const fileContent = ref('')
const fileMeta = ref<any>({})

const pathSegments = computed(() => {
  if (!currentPath.value) return []
  const parts = currentPath.value.split('/').filter(Boolean)
  return parts.map((name, i) => ({ name, path: parts.slice(0, i + 1).join('/') }))
})

const renderedFileContent = computed(() => {
  if (!fileContent.value) return ''
  return marked.parse(fileContent.value) as string
})

const renderedReadme = computed(() => {
  if (!readmeContent.value) return ''
  return marked.parse(readmeContent.value) as string
})

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
  const d = new Date(iso)
  return d.toISOString().replace('T', ' ').substring(0, 19)
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
    const { data } = await api.get(`/repos/${repoName.value}/overview`)
    overview.value = data
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '加载 GitHub 概览失败')
  } finally { loadingOverview.value = false }
}

async function loadReadme() {
  if (!repoName.value) return
  loadingReadme.value = true
  try {
    const { data } = await api.get(`/repos/${repoName.value}/readme`)
    readmeContent.value = data.content || ''
    readmeFilename.value = data.filename || 'README.md'
    readmeSource.value = data.source || ''
    subReadmes.value = data.subReadmes || (data.filename ? [data.filename] : [])
  } catch {
    readmeContent.value = ''
  } finally { loadingReadme.value = false }
}

async function loadReadmeByFile(filename: string) {
  // 切换子目录 README：直接读本地文件
  if (!repoName.value) return
  loadingReadme.value = true
  try {
    const { data } = await api.get(`/repos/${repoName.value}/readme?file=${encodeURIComponent(filename)}`)
    readmeContent.value = data.content || ''
    readmeFilename.value = data.filename || filename
    readmeSource.value = data.source || ''
  } catch {
    ElMessage.error('加载失败')
  } finally { loadingReadme.value = false }
}

// ------- 文件浏览 -------
function joinPath(base: string, name: string) {
  return base ? `${base}/${name}` : name
}
function isMarkdown(p: string) {
  return /\.md$/i.test(p)
}
function fileIcon(name: string) {
  if (/\.(md|txt|rst)$/i.test(name)) return '📄'
  if (/\.(js|ts|vue|json|sh|py|java|xml|yml|yaml|css|html)$/i.test(name)) return '📝'
  if (/\.(png|jpe?g|gif|svg|ico|webp)$/i.test(name)) return '🖼️'
  if (/\.(zip|tar|gz|jar|class)$/i.test(name)) return '📦'
  return '📄'
}
function formatSize(bytes: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0, n = bytes
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`
}

async function loadFiles(path = '') {
  if (!repoName.value) return
  loadingFiles.value = true
  try {
    const { data } = await api.get(`/repos/${repoName.value}/files`, { params: { path } })
    fileEntries.value = data.entries || []
    currentPath.value = path
  } catch {
    ElMessage.error('加载文件列表失败')
    fileEntries.value = []
  } finally { loadingFiles.value = false }
}

function navigateTo(path: string) {
  loadFiles(path)
}

function goUp() {
  const parts = currentPath.value.split('/').filter(Boolean)
  parts.pop()
  loadFiles(parts.join('/'))
}

async function openFile(path: string) {
  selectedFile.value = path
  fileContent.value = ''
  fileMeta.value = {}
  try {
    const { data } = await api.get(`/repos/${repoName.value}/file-content`, { params: { path } })
    fileContent.value = data.content || ''
    fileMeta.value = { size: data.size, binary: data.binary, tooLarge: data.tooLarge }
  } catch {
    ElMessage.error('读取文件失败')
  }
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
  if (tab === 'readme' && !readmeContent.value) loadReadme()
  if (tab === 'files' && !filesInited.value) { filesInited.value = true; loadFiles('') }
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

/* 文件浏览 */
.files-browser { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.files-breadcrumb {
  display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
  padding: 10px 16px; background: var(--bg-elevated, var(--bg-card));
  border-bottom: 1px solid var(--border);
}
.crumb { cursor: pointer; color: var(--accent); font-size: 13px; }
.crumb:hover { text-decoration: underline; }
.crumb-sep { color: var(--text-muted); }
.files-panes { display: flex; height: 560px; }
.files-list { width: 320px; flex-shrink: 0; border-right: 1px solid var(--border); overflow-y: auto; }
.file-row {
  display: flex; align-items: center; gap: 8px; padding: 8px 16px;
  cursor: pointer; font-size: 13px; border-bottom: 1px solid var(--border-light, rgba(48,54,61,.25));
}
.file-row:hover { background: var(--bg-hover, rgba(88,166,255,.06)); }
.file-row.active { background: var(--bg-active, rgba(88,166,255,.12)); }
.file-row.up { color: var(--text-muted); }
.file-icon { flex-shrink: 0; }
.file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); }
.file-size { color: var(--text-muted); font-size: 11px; }
.file-preview { flex: 1; overflow: auto; display: flex; flex-direction: column; min-width: 0; }
.preview-empty { flex: 1; display: flex; align-items: center; justify-content: center; }
.preview-header {
  display: flex; align-items: center; gap: 10px; padding: 10px 16px;
  border-bottom: 1px solid var(--border); background: var(--bg-elevated, var(--bg-card));
}
.preview-path {
  font-family: 'SF Mono', Consolas, monospace; font-size: 12px; color: var(--accent);
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.preview-notice { padding: 40px; text-align: center; color: var(--text-muted); }
.code-preview {
  padding: 16px 20px; margin: 0; font-family: 'SF Mono', Consolas, monospace;
  font-size: 13px; line-height: 1.6; color: var(--text); white-space: pre; overflow: auto;
}

/* README / Markdown 渲染（变量驱动，适配亮/暗主题） */
.readme-wrap { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.readme-toolbar {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px; background: var(--bg-elevated); border-bottom: 1px solid var(--border);
}
.readme-file { font-family: monospace; font-size: 13px; color: var(--accent); font-weight: 600; }
.readme-body {
  padding: 28px 36px; background: var(--bg);
  font-size: 15px; line-height: 1.75; color: var(--text);
  max-height: 700px; overflow-y: auto;
}
.readme-body h1, .readme-body h2, .readme-body h3, .readme-body h4 {
  color: var(--text-strong); font-weight: 700; margin: 1.4em 0 .6em;
  padding-bottom: .3em; border-bottom: 1px solid var(--border);
}
.readme-body h1 { font-size: 1.9em; }
.readme-body h2 { font-size: 1.5em; }
.readme-body h3 { font-size: 1.2em; border-bottom: none; }
.readme-body p { margin: .8em 0; }
.readme-body a { color: var(--accent); text-decoration: none; }
.readme-body a:hover { text-decoration: underline; }
.readme-body code {
  background: var(--code-bg, rgba(110,118,129,.25)); padding: .2em .45em;
  border-radius: 5px; font-size: .88em; font-family: 'SF Mono', Consolas, monospace;
}
.readme-body pre {
  background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px;
  padding: 16px; overflow-x: auto; margin: 1em 0;
}
.readme-body pre code { background: none; padding: 0; font-size: 13px; }
.readme-body blockquote {
  border-left: 4px solid var(--accent); padding: .4em 1em;
  color: var(--text-muted); background: var(--blockquote-bg, rgba(56,139,253,.06)); margin: 1em 0;
}
.readme-body table { border-collapse: collapse; margin: 1em 0; width: 100%; }
.readme-body th, .readme-body td { border: 1px solid var(--border); padding: 8px 14px; text-align: left; }
.readme-body th { background: var(--bg-elevated); font-weight: 600; color: var(--text-strong); }
.readme-body ul, .readme-body ol { padding-left: 1.8em; margin: .8em 0; }
.readme-body li { margin: .3em 0; }
.readme-body img { max-width: 100%; border-radius: 6px; }
.readme-body hr { border: none; border-top: 1px solid var(--border); margin: 1.5em 0; }
</style>
