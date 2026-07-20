<template>
  <div>
    <el-card class="section">
      <template #header><span>👤 账户信息</span></template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="用户名">{{ auth.user?.username }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ auth.user?.email }}</el-descriptions-item>
        <el-descriptions-item label="角色">
          <el-tag :type="auth.isTechLead ? 'danger' : 'warning'">{{ auth.user?.role }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="状态">{{ auth.user?.status }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card class="section">
      <template #header><span>🔑 修改密码</span></template>
      <el-form :model="pwForm" label-width="120px" style="max-width:440px">
        <el-form-item label="当前密码">
          <el-input v-model="pwForm.oldPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="pwForm.newPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input v-model="pwForm.confirmPassword" type="password" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="changing" @click="handleChangePw">修改密码</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="section">
      <template #header><span>📁 仓库配置</span></template>
      <el-form label-width="140px" style="max-width:560px">
        <el-form-item label="克隆根路径">
          <el-input v-model="reposDir" placeholder="/opt/openhands/projects" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="savingDir" @click="handleSaveDir">保存配置</el-button>
          <el-button @click="loadConfig">重置</el-button>
        </el-form-item>
      </el-form>
      <div class="path-hint">
        新添加的仓库将克隆到此目录下。修改不会影响已存在的仓库。<br>
        当前管理的仓库路径可在「仓库管理」页面查看。
      </div>
    </el-card>

    <el-card class="section">
      <template #header><span>ℹ️ 系统信息</span></template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="组织">{{ sysConfig.org }}</el-descriptions-item>
        <el-descriptions-item label="受管仓库数">{{ sysConfig.managedCount }}</el-descriptions-item>
        <el-descriptions-item label="仓库根路径">{{ sysConfig.reposDir }}</el-descriptions-item>
        <el-descriptions-item label="脚本目录">{{ sysConfig.scriptsDir }}</el-descriptions-item>
        <el-descriptions-item label="后端服务端口">3011</el-descriptions-item>
        <el-descriptions-item label="部署方式">Nginx + systemd</el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../utils/api'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const changing = ref(false)
const savingDir = ref(false)
const pwForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const reposDir = ref('')
const sysConfig = reactive({ reposDir: '', scriptsDir: '', org: '', managedCount: 0 })

async function loadConfig() {
  try {
    const { data } = await api.get('/config')
    reposDir.value = data.reposDir
    Object.assign(sysConfig, data)
  } catch {}
}

async function handleSaveDir() {
  if (!reposDir.value) return ElMessage.warning('请输入路径')
  savingDir.value = true
  try {
    await api.post('/config/repos-dir', { reposDir: reposDir.value })
    ElMessage.success('配置已保存，重启后端后生效')
    await loadConfig()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '保存失败')
  } finally { savingDir.value = false }
}

async function handleChangePw() {
  if (!pwForm.oldPassword || !pwForm.newPassword) return ElMessage.warning('请填写完整')
  if (pwForm.newPassword !== pwForm.confirmPassword) return ElMessage.warning('两次新密码不一致')
  if (pwForm.newPassword.length < 8) return ElMessage.warning('新密码至少 8 位')
  changing.value = true
  try {
    await api.post('/auth/change-password', { oldPassword: pwForm.oldPassword, newPassword: pwForm.newPassword })
    ElMessage.success('密码修改成功')
    pwForm.oldPassword = ''; pwForm.newPassword = ''; pwForm.confirmPassword = ''
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '修改失败')
  } finally { changing.value = false }
}

onMounted(loadConfig)
</script>

<style scoped>
.section { margin-bottom: 20px; }
.path-hint { margin-top: 8px; color: var(--text-muted); font-size: 13px; }
</style>
