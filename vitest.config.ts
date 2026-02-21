import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'tinyland-grafana',
    include: ['tests/**/*.test.ts'],
    globals: true,
  },
});
