import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from '@/App.vue'
import { router } from '@/router'
import '@/style.css'
import { applyTheme, getStoredTheme } from '@/utils/theme'

// 启动时应用已保存的主题（默认暗色）
applyTheme(getStoredTheme())

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
for (const [key, comp] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, comp)
}
app.mount('#app')
// cache-bust: 2026-07-21-force-update
// cache-bust-2: 2026-07-21-1500-force-all-chunks-change
