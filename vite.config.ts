import { defineConfig, loadEnv } from 'vite'
  import vue from '@vitejs/plugin-vue'
  import tailwindcss from '@tailwindcss/vite'
  import os from 'os'

// 获取局域网 IP
function getLocalIP() {
  const interfaces = os.networkInterfaces()
  for (const name in interfaces) {
    for (const iface of interfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return 'localhost'
}
const localIP = getLocalIP()
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // 允许通过环境变量配置后端基地址，例如：VITE_API_BASE=http://127.0.0.1:8080
  //const apiBase = env.VITE_API_BASE || `http://localhost:3000`
  const apiBase = `http://${localIP}:3000`|| `http://localhost:3000`;
  return {
    plugins: [vue(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      port: 3001,
      open: true,
    },
    define: {
      API_BASE: JSON.stringify(apiBase),
    },
  }
})
