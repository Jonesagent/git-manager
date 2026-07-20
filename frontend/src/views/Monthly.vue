<template>
  <div>
    <!-- 月度创建（单仓库串行 + 终端输出） -->
    <el-card class="section">
      <template #header><span>📋 创建月度开发分支 dev_YYYYMM</span></template>
      <el-form :model="createForm" label-width="100px" inline>
        <el-form-item label="年月">
          <el-input v-model="createForm.month" placeholder="202607" style="width:120px" />
        </el-form-item>
        <el-form-item label="仓库范围">
          <el-select v-model="createForm.repos" multiple placeholder="全部仓库" style="width:380px">
            <el-option v-for="r in allRepos" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="createForm.dryRun">Dry Run</el-checkbox>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="running" :disabled="running" @click="handleCreate">
            {{ createForm.dryRun ? '预览执行' : '确认创建' }}
          </el-button>
        </el-form-item>
      </el-form>

      <!-- 执行汇总条 -->
      <el-alert v-if="summary" :type="summary.fail > 0 ? 'warning' : 'success'" closable
        @close="summary = null" style="margin-bottom: 12px">
        {{ summary.text }}
      </el-alert>

      <!-- 终端输出区 -->
      <div v-if="allRuns.length > 0" class="runs-section">
        <div v-for="(run, idx) in allRuns" :key="idx" class="run-block">
          <div class="run-header">
            <span class="run-repo">{{ run.repo }}</span>
            <el-tag size="small" :type="runTagType(run.status)">
              {{ runTagLabel(run.status) }}
            </el-tag>
            <span v-if="run.message" class="run-msg">{{ run.message }}</span>
          </div>
          <Terminal :lines="run.lines" :running="run.status === 'running'" />
        </div>
      </div>
    </el-card>

    <!-- 月末合并 -->
    <el-card class="section">
      <template #header><span>🔄 月末合并到 main（单仓库）</span></template>
      <el-form :model="mergeForm" label-width="100px" inline>
        <el-form-item label="仓库">
          <el-select v-model="mergeForm.name" placeholder="选择仓库" style="width:180px">
            <el-option v-for="r in allRepos" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item label="年月">
          <el-input v-model="mergeForm.month" placeholder="202607" style="width:110px" />
        </el-form-item>
        <el-form-item label="版本号">
          <el-input v-model="mergeForm.version" placeholder="v1.4.0" style="width:130px" />
        </el-form-item>
        <el-form-item label="发布说明">
          <el-input v-model="mergeForm.message" placeholder="（可选）" style="width:250px" />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="mergeForm.dryRun">Dry Run</el-checkbox>
        </el-form-item>
        <el-form-item>
          <el-button type="danger" :loading="merging" @click="handleMerge">执行合并</el-button>
        </el-form-item>
      </el-form>
      <div v-if="mergeLines.length > 0" style="margin-top:12px">
        <Terminal :lines="mergeLines" :running="merging" />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../utils/api'
import { useAuthStore } from '../stores/auth'
import Terminal from '../components/Terminal.vue'

interface Line { type: 'cmd' | 'stdout' | 'stderr' | 'info' | 'success' | 'error'; text: string }
type RunStatus = 'pending' | 'running' | 'ok' | 'skipped' | 'fail'
interface Run { repo: string; status: RunStatus; lines: Line[]; message: string }

const auth = useAuthStore()
const allRepos = ref<string[]>([])
const running = ref(false)
const allRuns = ref<Run[]>([])
const summary = ref<{ text: string; fail: number } | null>(null)

const createForm = reactive<{ month: string; repos: string[]; dryRun: boolean }>({
  month: new Date().getFullYear().toString() + String(new Date().getMonth() + 1).padStart(2, '0'),
  repos: [],
  dryRun: false,
})

const mergeForm = reactive<{ name: string; month: string; version: string; message: string; dryRun: boolean }>({
  name: '', month: '', version: '', message: '', dryRun: false,
})
const merging = ref(false)
const mergeLines = ref<Line[]>([])

function runTagType(s: RunStatus): any {
  return { running: 'warning', ok: 'success', skipped: 'info', fail: 'danger', pending: 'info' }[s]
}
function runTagLabel(s: RunStatus): string {
  return { running: '⏳ 执行中', ok: '✅ 成功', skipped: '⏭️ 已跳过', fail: '❌ 失败', pending: '⏳ 等待' }[s]
}

async function handleCreate() {
  if (!/^\d{6}$/.test(createForm.month)) return ElMessage.warning('请输入正确的年月')

  const targets = createForm.repos.length ? createForm.repos : allRepos.value

  if (!createForm.dryRun) {
    try {
      await ElMessageBox.confirm(
        `将在 ${targets.length} 个仓库创建 dev_${createForm.month} 并推送到 GitHub，确认执行？`,
        '操作确认',
        { confirmButtonText: '确认创建', cancelButtonText: '取消', type: 'warning' },
      )
    } catch { return }
  }

  running.value = true
  summary.value = null
  // 用 splice 替换整个数组确保响应式
  allRuns.value = targets.map(r => ({ repo: r, status: 'pending' as RunStatus, lines: [] as Line[], message: '' }))

  for (let i = 0; i < targets.length; i++) {
    const repoName = targets[i]
    // 用 splice 触发响应式更新
    allRuns.value.splice(i, 1, { ...allRuns.value[i], status: 'running', lines: [{ type: 'cmd', text: `create-monthly.sh ${repoName} ${createForm.month}${createForm.dryRun ? ' [DRY_RUN]' : ''}` }] })

    try {
      await runOne(repoName, i)
    } catch (e: any) {
      const run = allRuns.value[i]
      run.lines.push({ type: 'error', text: e.message || String(e) })
      run.message = e.message || String(e)
      allRuns.value.splice(i, 1, { ...run, status: 'fail' })
    }
  }

  running.value = false
  const ok = allRuns.value.filter(r => r.status === 'ok').length
  const skip = allRuns.value.filter(r => r.status === 'skipped').length
  const fail = allRuns.value.filter(r => r.status === 'fail').length
  summary.value = {
    text: `完成：✅ ${ok} 创建  ⏭️ ${skip} 跳过  ❌ ${fail} 失败`,
    fail,
  }
  if (fail > 0) ElMessage.warning(`有 ${fail} 个仓库执行失败`)
  else ElMessage.success('全部完成')
}

async function runOne(repoName: string, idx: number) {
  const url = '/api/monthly/create-stream'
  const body = { name: repoName, month: createForm.month, dryRun: createForm.dryRun }
  const token = auth.token || localStorage.getItem('token') || ''

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => '')
    throw new Error(`HTTP ${resp.status}: ${text.substring(0, 200)}`)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalStatus: RunStatus = 'fail'
  let finalMsg = ''

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

      let event: string
      let data: any
      try {
        event = eventMatch[1].trim()
        data = JSON.parse(dataMatch[1])
      } catch { continue }

      const run = allRuns.value[idx]

      if (event === 'start') {
        run.lines.push({ type: 'info', text: `▶ pid=${data.pid}` })
      } else if (event === 'stdout') {
        run.lines.push({ type: 'stdout', text: data.line })
      } else if (event === 'stderr') {
        run.lines.push({ type: 'stderr', text: data.line })
      } else if (event === 'done') {
        if (data.code === 0) {
          run.lines.push({ type: 'success', text: '✅ 分支创建并推送成功' })
          finalStatus = 'ok'
          finalMsg = '创建成功'
        } else if (data.code === 10) {
          const reason = data.result || 'exists'
          run.lines.push({ type: 'info', text: `⏭️ 分支已存在，已跳过 (${reason})` })
          finalStatus = 'skipped'
          finalMsg = '分支已存在'
        } else {
          run.lines.push({ type: 'error', text: `❌ 失败 (exit=${data.code})` })
          finalStatus = 'fail'
          finalMsg = `exit=${data.code}`
        }
      } else if (event === 'timeout') {
        run.lines.push({ type: 'error', text: '⏱️ 执行超时' })
        finalStatus = 'fail'
        finalMsg = '超时'
      } else if (event === 'error') {
        run.lines.push({ type: 'error', text: data.message })
        finalStatus = 'fail'
        finalMsg = data.message
      }

      // 每次收到事件后触发响应式更新
      allRuns.value.splice(idx, 1, { ...run })
    }
  }

  // 最终状态
  const run = allRuns.value[idx]
  allRuns.value.splice(idx, 1, { ...run, status: finalStatus, message: finalMsg })
}

async function handleMerge() {
  const f = mergeForm
  if (!f.name || !/^\d{6}$/.test(f.month) || !/^v\d+\.\d+\.\d+$/.test(f.version)) {
    return ElMessage.warning('请填写：仓库、年月（202607）、版本号（v1.4.0）')
  }
  if (!f.dryRun) {
    try {
      await ElMessageBox.confirm(
        `⚠️ 确认将 ${f.name} 的 dev_${f.month} 合并到 main 并打 tag ${f.version}？\n此操作不可撤销。`,
        '危险操作确认',
        { confirmButtonText: '⚠️ 确认执行', cancelButtonText: '取消', type: 'error' },
      )
    } catch { return }
  }
  merging.value = true
  mergeLines.value = [{ type: 'cmd', text: `merge-to-main.sh ${f.name} ${f.month} ${f.version}` }]
  try {
    const { data } = await api.post('/monthly/merge', f)
    if (data.ok) {
      mergeLines.value.push({ type: 'success', text: `✅ 合并成功，tag ${f.version} 已推送` })
      ElMessage.success('合并成功')
    } else {
      mergeLines.value.push({ type: 'error', text: data.stderr || '合并失败' })
      ElMessage.error('合并失败')
    }
  } catch (e: any) {
    const stderr = e.response?.data?.stderr || e.message
    mergeLines.value.push({ type: 'error', text: stderr })
    ElMessage.error('合并失败')
  } finally { merging.value = false }
}

onMounted(async () => {
  try {
    const { data } = await api.get('/repos')
    allRepos.value = data.managed
  } catch {}
})
</script>

<style scoped>
.section { margin-bottom: 20px; }
.runs-section { margin-top: 16px; display: flex; flex-direction: column; gap: 16px; }
.run-block { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.run-header { padding: 8px 16px; background: #161b22; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
.run-repo { font-weight: 600; color: var(--accent); }
.run-msg { color: var(--text-muted); font-size: 12px; margin-left: auto; }
</style>
