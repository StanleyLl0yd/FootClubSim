import { defineConfig } from 'vite';

/** Keep Vite output separate from TypeScript's dist/core test artifacts. */
export default defineConfig({
  build: { outDir: 'web-dist', license: { fileName: 'THIRD_PARTY_LICENSES.txt' } },
});
