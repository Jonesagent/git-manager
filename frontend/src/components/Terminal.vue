<template>
  <div class="terminal" ref="container">
    <div v-for="(line, i) in lines" :key="i" :class="['term-line', line.type]">
      <span class="term-prefix" v-if="line.type === 'cmd'">$</span>
      <span class="term-text">{{ line.text }}</span>
    </div>
    <div v-if="running" class="term-line running">
      <span class="cursor">▊</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'

interface Line { type: 'cmd' | 'stdout' | 'stderr' | 'info' | 'success' | 'error'; text: string }

const props = defineProps<{
  lines: Line[]
  running: boolean
}>()

const container = ref<HTMLElement>()

// 自动滚动到底部
watch(() => props.lines.length, async () => {
  await nextTick()
  if (container.value) container.value.scrollTop = container.value.scrollHeight
})
</script>

<style scoped>
.terminal {
  background: #010409;
  border: 1px solid #30363d;
  border-radius: 8px;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  padding: 16px;
  max-height: 500px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
.term-line { display: flex; gap: 8px; }
.term-prefix { color: #3fb950; flex-shrink: 0; }
.term-text { flex: 1; }
.term-line.stdout .term-text { color: #c9d1d9; }
.term-line.stderr .term-text { color: #f85149; }
.term-line.info .term-text { color: #58a6ff; }
.term-line.success .term-text { color: #3fb950; font-weight: 600; }
.term-line.error .term-text { color: #f85149; font-weight: 600; }
.cursor { color: #58a6ff; animation: blink 1s infinite; }
@keyframes blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
</style>
