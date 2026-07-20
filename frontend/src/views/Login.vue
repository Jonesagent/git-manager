<template>
  <div class="login-wrap">
    <div class="login-card">
      <h1>🌿 Git Manager</h1>
      <p class="subtitle">lionking-cloud 分支管理平台</p>
      <el-form :model="form" @submit.prevent="handleLogin" class="form">
        <el-form-item>
          <el-input v-model="form.username" placeholder="用户名" size="large" :prefix-icon="User" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码" size="large"
            show-password :prefix-icon="Lock" @keyup.enter="handleLogin" />
        </el-form-item>
        <el-button type="primary" size="large" style="width:100%" :loading="loading" @click="handleLogin">
          登 录
        </el-button>
      </el-form>
      <p v-if="error" class="err">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock } from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const error = ref('')
const form = reactive({ username: '', password: '' })

async function handleLogin() {
  if (!form.username || !form.password) return
  loading.value = true
  error.value = ''
  try {
    await auth.login(form.username, form.password)
    router.push('/')
  } catch (e: any) {
    error.value = e.response?.data?.error || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-wrap {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: var(--bg);
}
.login-card {
  width: 380px; padding: 40px; border: 1px solid var(--border); border-radius: 12px;
  background: var(--bg-card);
}
h1 { text-align: center; color: var(--accent); margin-bottom: 4px; }
.subtitle { text-align: center; color: var(--text-muted); margin-bottom: 28px; font-size: 14px; }
.err { color: var(--red); text-align: center; margin-top: 12px; font-size: 14px; }
</style>
