import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // The default forks pool cannot start a worker on this Windows setup; threads runs the same
    // suite without it.
    pool: 'threads',
  },
})
