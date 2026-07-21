<template>
  <div>
    <el-table :data="rows" v-loading="loading" stripe size="small">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="username" label="用户" width="120" />
      <el-table-column prop="action" label="操作" width="200" />
      <el-table-column prop="resource" label="目标" width="150" />
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag size="small" :type="row.status === 'ok' ? 'success' : row.status === 'fail' ? 'danger' : 'info'">
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="ip" label="IP" width="130" />
      <el-table-column prop="created_at" label="时间" width="180">
        <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
      </el-table-column>
      <el-table-column prop="detail" label="详情" min-width="200" show-overflow-tooltip />
    </el-table>
    <div style="margin-top:12px;text-align:right;color:var(--text-muted);font-size:13px">
      共 {{ total }} 条记录
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../utils/api'

const loading = ref(false)
const rows = ref<any[]>([])
const total = ref(0)
function formatDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toISOString().replace('T', ' ').substring(0, 19)
}

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await api.get('/audit', { params: { limit: 200 } })
    rows.value = data.rows
    total.value = data.total
  } finally { loading.value = false }
})
</script>
