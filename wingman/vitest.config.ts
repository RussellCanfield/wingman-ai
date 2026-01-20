
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: __dirname,
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
