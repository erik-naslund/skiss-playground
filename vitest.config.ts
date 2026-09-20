import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // The palette is part of what the editor promises, so a test reads
    // `style.css` as text (`?raw`). Vitest hands back an empty string for a
    // stylesheet unless it is told to process one.
    css: true,
  },
});
