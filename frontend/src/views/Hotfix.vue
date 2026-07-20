<template>
  <div>
    <el-card>
      <template #header><span>🔧 热修复分支创建</span></template>
      <el-alert type="info" :closable="false" style="margin-bottom:16px">
        从 main 分支拉取 hotfix/vX.Y.Z 分支。修复完成后，需要在 GitHub 提 PR 合入 main，并手动同步回当月 dev_YYYYMM。
      </el-alert>
      <el-form :model="form" label-width="80px" inline>
        <el-form-item label="仓库">
          <el-select v-model="form.name" placeholder="选择仓库" style="width:200px">
            <el-option v-for="r in repos" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item label="版本号">
          <el-input v-model="form.version" placeholder="v1.3.1" style="width:140px" />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="form.dryRun">Dry Run</el-checkbox>
        </el-form-item>
        <el-form-item>
          <el-button type="warning" :loading="loading" @click="handleCreate">创建热修复分支</el-button>
        </el-form-item>
      </el-form>
      <el-alert v-if="result" :type="resultOk ? 'success' : 'error'" :title="result" closable
        @close="result = ''" style="margin-top:12px" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../utils/api'

const repos = ref<string[]>([])
const loading = ref(false)
const result = ref('')
const resultOk = ref(false)
const form = reactive({ name: '', version: '', dryRun: false })

async function handleCreate() {
  if (!form.name || !/^v\d+\.\d+\.\d+$/.test(form.version)) {
    return ElMessage.warning('请填写仓库和版本号（如 v1.3.1）')
  }
  loading.value = true
  result.value = ''
  try {
    const { data } = await api.post('/hotfix/create', form)
    if (data.ok) {
      result.value = `${form.name} 热修复分支 hotfix/${form.version} 创建成功`
      resultOk.value = true
      ElMessage.success('热修复分支创建成功')
    } else {
      result.value = data.stderr || '创建失败'
      resultOk.value = false
    }
  } catch (e: any) {
    result.value = e.response?.data?.stderr || e.message
    resultOk.value = false
  } finally { loading.value = false }
}

onMounted(async () => {
  try {
    const { data } = await api.get('/repos')
    repos.value = data.managed
  } catch {}
})
</script>
