<template>
  <div>
    <el-table :data="repos" v-loading="loading" stripe>
      <el-table-column prop="name" label="仓库" width="200">
        <template #default="{ row }">
          <router-link :to="`/repos/${row.name}`" style="font-weight:600">{{ row.name }}</router-link>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag v-if="row.initialized" size="small" type="success">已同步</el-tag>
          <el-tag v-else size="small" type="info">未初始化</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="head" label="当前分支" width="120" />
      <el-table-column prop="headSha" label="HEAD" width="140">
        <template #default="{ row }"><code>{{ row.headSha || '-' }}</code></template>
      </el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button size="small" :loading="fetching === row.name"
            :disabled="!auth.isTechLead && auth.user?.role !== 'developer'"
            @click="handleFetch(row.name)">同步</el-button>
          <el-button size="small" @click="router.push(`/repos/${row.name}`)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api } from '../utils/api'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const fetching = ref('')
const repos = ref<any[]>([])

async function load() {
  loading.value = true
  try { const { data } = await api.get('/repos'); repos.value = data.repos }
  finally { loading.value = false }
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

onMounted(load)
</script>
