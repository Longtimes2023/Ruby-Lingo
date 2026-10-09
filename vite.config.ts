import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// RubyLingo — Vite config
// - dev: proxy /api -> Fastify trên 127.0.0.1:3000 (cookie same-origin, không CORS)
// - build: output vào dist/ ; server Node phục vụ chính dist/ này ở production
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2020',
    rollupOptions: {
      output: {
        // Tách vendor để cache tốt hơn trên mạng yếu (điện thoại của bé)
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-form': ['react-hook-form', 'zod', '@hookform/resolvers'],
          'vendor-query': ['@tanstack/react-query'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],

    /**
     * ⚠️ CHẠY TUẦN TỰ THEO FILE — ĐỪNG BẬT LẠI MÀ KHÔNG KIỂM CHỨNG.
     *
     * Vitest mặc định chạy mỗi file test trong một tiến trình riêng, song song. Trên máy
     * dev này (WorkBuddy sandbox trên Windows), các tiến trình đó ghi cache biến đổi vào
     * thư mục tạm của hệ điều hành và bị chặn (`EPERM`). Hệ quả KHÔNG phải là báo lỗi, mà
     * là **file test biến mất khỏi kết quả** — đo 3 lần liên tiếp được 4, 5, 5 file trong
     * khi thực tế có 6. CI vì thế báo "passed" trong khi một phần test CHƯA HỀ CHẠY.
     *
     * Kiểu thất bại này tệ hơn hẳn một test đỏ: nó âm thầm, và nó phá đúng thứ mà cổng CI
     * sinh ra để bảo vệ. Chạy tuần tự làm kết quả tất định; 171 test mất ~4 s nên cái giá
     * là không đáng kể. Khi số test lớn lên và cần tốc độ, hãy đo lại trên môi trường đích
     * (VPS/CI thật) TRƯỚC khi bật `fileParallelism`, và luôn đối chiếu số file chạy được
     * với số file thật trên đĩa.
     */
    fileParallelism: false,
  },
});
