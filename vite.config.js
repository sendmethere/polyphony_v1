import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// JS/JSX only — TypeScript 미사용 (사용자 요청)
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
})
