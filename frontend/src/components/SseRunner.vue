<template>
  <div class="sse-runner">
    <Terminal :lines="lines" :running="running" />
    <div v-if="result" class="result-bar" :class="resultOk ? 'ok' : 'fail'">
      <span v-if="resultOk">✅ {{ resultLabel }}</span>
      <span v-else>❌ {{ resultLabel }}</span>
      <span class="exit-code">exit={{ exitCode }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Terminal from './Terminal.vue'
import { useAuthStore } from '../stores/auth'

const props = defineProps<{
  url: string
  body: any
}>()

const emit = defineEmits<{
  done: [result: { ok: boolean; code: number; result: string | null }]
}>()

interface Line { type: 'cmd' | 'stdout' | 'stderr' | 'info' | 'success' | 'error'; text: string }

const lines = ref<Line[]>([])
const running = ref(false)
const exitCode = ref<number | null>(null)
const resultStr = ref<string | null>(null)

const result = computed(() => exitCode.value !== null)
const resultOk = computed(() => {
  // 0 = 成功, 10 = 幂等跳过（也不算失败）
  return exitCode.value === 0 || exitCode.value === 10
})
const resultLabel = computed(() => {
  const map: Record<string, string> = {
    'created': '分支创建并推送成功',
    'exists_remote': '分支已存在（远端），已跳过',
    'exists_local': '分支已存在（本地），已跳过',
    'exists_local_pushed': '本地分支已存在，已推送到远端',
    'dry_run_ok': 'Dry Run 完成',
    'push_failed': '推送失败',
    'deleted': '分支已删除',
    'not_found': '分支不存在',
    'protected': '受保护分支，禁止操作',
    'repo_not_found': '仓库未找到',
    'source_not_found': '源分支不存在',
    'invalid_month': '月份格式无效',
    'errors': '执行有错误',
  }
  return map[resultStr.value || ''] || resultStr.value || (resultOk.value ? '完成' : '失败')
})

async function run() {
  lines.value = []
  running.value = true
  exitCode.value = null
  resultStr.value = null

  const auth = useAuthStore()
  lines.value.push({ type: 'cmd', text: `${props.url} ${JSON.stringify(props.body)}` })

  try {
    const resp = await fetch(props.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`,
      },
      body: JSON.stringify(props.body),
    })

    if (!resp.ok || !resp.body) {
      const text = await resp.text()
      lines.value.push({ type: 'error', text: `HTTP ${resp.status}: ${text}` })
      running.value = false
      exitCode.value = -1
      emit('done', { ok: false, code: -1, result: null })
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
          lines.value.push({ type: 'info', text: `▶ 开始执行 (pid=${data.pid})` })
        } else if (event === 'stdout') {
          lines.value.push({ type: 'stdout', text: data.line })
        } else if (event === 'stderr') {
          lines.value.push({ type: 'stderr', text: data.line })
        } else if (event === 'done') {
          exitCode.value = data.code
          resultStr.value = data.result
          if (data.code === 0) {
            lines.value.push({ type: 'success', text: `✅ 执行成功 (exit=${data.code})` })
          } else if (data.code === 10) {
            lines.value.push({ type: 'info', text: `⏭️ 分支已存在，已跳过 (exit=${data.code})` })
          } else {
            lines.value.push({ type: 'error', text: `❌ 执行失败 (exit=${data.code})` })
          }
          emit('done', { ok: data.code === 0 || data.code === 10, code: data.code, result: data.result })
        } else if (event === 'timeout') {
          lines.value.push({ type: 'error', text: '⏱️ 执行超时' })
        } else if (event === 'error') {
          lines.value.push({ type: 'error', text: data.message })
        }
      }
    }
  } catch (e: any) {
    lines.value.push({ type: 'error', text: e.message })
    exitCode.value = -1
    emit('done', { ok: false, code: -1, result: null })
  } finally {
    running.value = false
  }
}

defineExpose({ run })
</script>

<style scoped>
.result-bar {
  margin-top: 8px; padding: 10px 16px; border-radius: 8px;
  font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 12px;
}
.result-bar.ok { background: rgba(63,185,80,.1); color: #3fb950; border: 1px solid rgba(63,185,80,.3); }
.result-bar.fail { background: rgba(248,81,73,.1); color: #f85149; border: 1px solid rgba(248,81,73,.3); }
.exit-code { margin-left: auto; font-weight: 400; opacity: .7; }
</style>
