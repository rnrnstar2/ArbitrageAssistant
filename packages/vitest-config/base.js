import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/.next/**',
      '**/target/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'out/',
        '.next/',
        'target/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/vitest.setup.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './'),
      '@repo/ui': path.resolve(process.cwd(), '../../packages/ui/src'),
      '@repo/shared-types': path.resolve(process.cwd(), '../../packages/shared-types/src')
    }
  }
})