import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'react-native': path.resolve(__dirname, 'tests/__mocks__/react-native.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    testTimeout: 10000,
    setupFiles: ['./tests/setup.ts'],
  },
});
