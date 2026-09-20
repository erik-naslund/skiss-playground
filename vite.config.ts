import { defineConfig } from 'vite';

export default defineConfig({
  // The site is a GitHub project page, served under the repository's name and
  // not at a domain root (ADR-0001). Every asset URL is resolved against this,
  // which is why anything path-dependent is only really verified by
  // `pnpm build && pnpm preview` — the dev server would serve it from `/`.
  base: '/skiss-playground/',
});
