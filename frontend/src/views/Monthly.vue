<template>
  <div>
    <!-- 月度创建 -->
    <el-card class="section">
      <template #header><span>📋 创建月度开发分支</span></template>
      <el-form :model="createForm" label-width="100px" inline>
        <el-form-item label="年月">
          <el-input v-model="createForm.month" placeholder="202607" style="width:120px" />
        </el-form-item>
        <el-form-item label="仓库范围">
          <el-select v-model="createForm.repos" multiple placeholder="全部仓库" style="width:400px">
            <el-option v-for="r in allRepos" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="createForm.dryRun">Dry Run（预览）</el-checkbox>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="creating" @click="handleCreate">创建分支</el-button>
        </el-form-item>
      </el-form>
      <el-alert v-if="createResult" :type="createResultOk ? 'success' : 'warning'" :title="createResultSummary"
        closable @close="createResult = null" style="margin-top:12px" />
    </el-card>

    <!-- 月末合并 -->
    <el-card class="section">
      <template #header><span>🔄 月末合并到 main</span></template>
      <el-form :model="mergeForm" label-width="100px" inline>
        <el-form-item label="仓库">
          <el-select v-model="mergeForm.name" placeholder="选择仓库" style="width:200px">
            <el-option v-for="r in allRepos" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item label="年月">
          <el-input v-model="mergeForm.month" placeholder="202607" style="width:120px" />
        </el-form-item>
        <el-form-item label="版本号">
          <el-input v-model="mergeForm.version" placeholder="v1.4.0" style="width:140px" />
        </el-form-item>
        <el-form-item label="发布说明">
          <el-input v-model="mergeForm.message" placeholder="（可选）" style="width:300px" />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="mergeForm.dryRun">Dry Run</el-checkbox>
        </el-form-item>
        <el-form-item>
          <el-button type="danger" :loading="merging" @click="handleMerge">执行合并</el-button>
        </el-form-item>
      </el-form>
      <el-alert v-if="mergeResult" type="warning" :title="mergeResult" closable
        @close="mergeResult = ''" style="margin-top:12px" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../utils/api'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const allRepos = ref<string[]>([])
const creating = ref(false)
const merging = ref(false)
const createResult = ref<any>(null)
const createResultOk = ref(false)
const mergeResult = ref('')

const createForm = reactive<{ month: string; repos: string[]; dryRun: boolean }>({
  month: new Date().getFullYear().toString() + String(new Date().getMonth() + 1).padStart(2, '0'),
  repos: [],
  dryRun: false,
})
const mergeForm = reactive<{ name: string; month: string; version: string; message: string; dryRun: boolean }>({
  name: '', month: '', version: '', message: '', dryRun: false,
})

const createResultSummary = computed(() => {
  if (!createResult.value) return ''
  const r = createResult.value
  const ok = r.results?.filter((x: any) => x.code === 0) || []
  const fail = r.results?.filter((x: any) => x.code !== 0) || []
  return `成功 ${ok.length}/${r.results?.length || 0}${fail.length ? `，失败 ${fail.length}` : ''}`
})

async function handleCreate() {
  if (!/^\d{6}$/.test(createForm.month)) return ElMessage.warning('请输入正确的年月，如 202607')
  creating.value = true
  createResult.value = null
  try {
    const { data } = await api.post('/monthly/create', {
      month: createForm.month,
      repos: createForm.repos.length ? createForm.repos : undefined,
      dryRun: createForm.dryRun,
    })
    createResult.value = data
    createResultOk.value = !createForm.dryRun
    if (createForm.dryRun) ElMessage.info('Dry Run 完成，查看结果')
    else ElMessage.success('月度分支创建完成')
  } catch (e: any) {
    ElMessage.error('创建失败: ' + (e.response?.data?.stderr || e.message))
  } finally { creating.value = false }
}

async function handleMerge() {
  const f = mergeForm
  if (!f.name || !/^\d{6}$/.test(f.month) || !/^v\d+\.\d+\.\d+$/.test(f.version)) {
    return ElMessage.warning('请填写：仓库、年月（如 202607）、版本号（如 v1.4.0）')
  }
  if (!f.dryRun) {
    try {
      await ElMessageBox.confirm(
        `确认将 ${f.name} 的 dev_${f.month} 合并到 main 并打 tag ${f.version}？此操作不可撤销。`,
        '危险操作确认',
        { confirmButtonText: '确认执行', cancelButtonText: '取消', type: 'warning' },
      )
    } catch { return }
  }
  merging.value = true
  mergeResult.value = ''
  try {
    const { data } = await api.post('/monthly/merge', f)
    if (data.ok) {
      ElMessage.success('合并并打 tag 成功')
    } else {
      mergeResult.value = data.stderr || '合并失败'
      ElMessage.error('合并失败')
    }
  } catch (e: any) {
    mergeResult.value = e.response?.data?.stderr || e.message
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
</style>
