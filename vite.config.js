import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// 빌드 시 sw.js의 CACHE_NAME에 타임스탬프 주입
function injectSwVersion() {
  return {
    name: 'inject-sw-version',
    closeBundle() {
      const swPath = path.resolve(__dirname, 'dist/sw.js')
      if (!fs.existsSync(swPath)) return
      const version = Date.now()
      let content = fs.readFileSync(swPath, 'utf-8')
      content = content.replace(/dosirak-v1/, `dosirak-v${version}`)
      fs.writeFileSync(swPath, content)
      console.log(`SW cache version: dosirak-v${version}`)
    }
  }
}

export default defineConfig({
  plugins: [react(), injectSwVersion()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
