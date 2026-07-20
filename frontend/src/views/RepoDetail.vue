<template>
  <div v-loading="loading">
    <div class="repo-title">
      <el-button text @click="router.push('/repos')"><el-icon><ArrowLeft /></el-icon> 返回</el-button>
      <h3>{{ repoName }}</h3>
      <el-button size="small" :loading="fetching" @click="handleFetch">同步仓库</el-button>
    </div>
    <el-tabs v-model="activeTab">
      <el-tab-pane label="分支列表" name="branches">
        <el-input v-model="search" placeholder="搜索分支..." clearable size="small" style="margin-bottom:12px;width:300px" />
        <el-table :data="filteredBranches" stripe size="small">
          <el-table-column prop="name" label="分支" min-width="200">
            <template #default="{ row }">
              <span :class="['branch-name', row.kind]">{{ row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="kindTag(row.kind)">{{ kindLabel(row.kind) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="来源" width="80">
            <template #default="{ row }">{{ row.remote ? '远程' : '本地' }}</template>
          </el-table-column>
          <el-table-column prop="sha" label="最新提交" width="120" />
          <el-table-column prop="last_commit_author" label="提交者" width="120" />
          <el-table-column prop="last_commit_date" label="提交时间" width="180" />
          <el-table-column prop="last_commit_subject" label="提交信息" min-width="200" show-overflow-tooltip />
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { api } from '../utils/api'

const route = useRoute()
const router = useRouter()
const repoName = computed(() => route.params.name as string)
const loading = ref(false)
const fetching = ref(false)
const activeTab = ref('branches')
const search = ref('')
const branches = ref<any[]>([])

const filteredBranches = computed(() => {
  if (!search.value) return branches.value
  return branches.value.filter(b => b.name.includes(search.value))
})

const kindLabels: Record<string, string> = { main: '主分支', monthly: '月度', feature: '特性', hotfix: '热修复', other: '其他' }
const kindTagTypes: Record<string, any> = { main: 'danger', monthly: 'warning', feature: 'success', hotfix: '', other: 'info' }
function kindLabel(k: string) { return kindLabels[k] || k }
function kindTag(k: string) { return kindTagTypes[k] || 'info' }

async function loadBranches() {
  loading.value = true
  try {
    const { data } = await api.get(`/repos/${repoName.value}/branches`)
    branches.value = data.branches || []
  } catch (e: any) {
    ElMessage.error('加载分支失败')
  } finally { loading.value = false }
}

async function handleFetch() {
  fetching.value = true
  try {
    await api.post(`/repos/${repoName.value}/fetch`)
    ElMessage.success('同步成功')
    await loadBranches()
  } catch (e: any) {
    ElMessage.error(`同步失败: ${e.response?.data?.stderr || e.message}`)
  } finally { fetching.value = false }
}

watch(repoName, loadBranches)
onMounted(loadBranches)
</script>

<style scoped>
.repo-title { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.repo-title h3 { flex: 1; color: var(--accent); }
.branch-name { font-weight: 600; }
.branch-name.main { color: var(--red); }
.branch-name.monthly { color: var(--yellow); }
.branch-name.feature { color: var(--green); }
.branch-name.hotfix { color: var(--accent); }
</style>
