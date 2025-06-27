import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    name: 'integration-tests',
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.next'],
    environment: 'node',
    timeout: 30000, // 30秒タイムアウト（Integration テスト用）
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    globals: true,
    reporter: ['verbose', 'json'],
    outputFile: 'test-results/integration-results.json'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
      '@/lib': resolve(__dirname, './lib'),
      '@/components': resolve(__dirname, './components'),
      '@/features': resolve(__dirname, './features')
    }
  },
  define: {
    'process.env.NODE_ENV': '"test"',
    'process.env.INTEGRATION_TEST': '"true"'
  }
});