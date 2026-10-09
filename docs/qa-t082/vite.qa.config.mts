/**
 * Cau hinh Vite RIENG cho T082 (QA a11y + responsive).
 *
 * ⭐ VI SAO CO TEP NAY: `dist/` la muc tieu build dung chung — mot teammate khac dang chay
 *    `vite build` (T081 e2e) va `emptyOutDir` XOA `dist/` giua luc audit, khien server tra ve
 *    trang "chua co ban build frontend". Phuc vụ bang Vite dev doc truc tiep tu `src/` nen
 *    ket qua khong phu thuoc vao `dist/` cua nguoi khac.
 *
 * KHONG SUA `vite.config.ts` cua du an — day la tep rieng, chi doi CONG va DICH PROXY.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('../../', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../../shared', import.meta.url)),
      '@': fileURLToPath(new URL('../../src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5199,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4310', changeOrigin: false },
    },
  },
});
