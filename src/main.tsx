import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import './styles/index.css';
import './i18n/index.js';
import { App } from './App.js';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Không tìm thấy phần tử #root trong index.html');

/**
 * TanStack Query quản lý trạng thái đến từ server (tiến độ, thưởng, nhiệm vụ).
 * Cấu hình cho mạng yếu / tablet của bé:
 *   - retry 2 lần (không retry mãi gây treo UI)
 *   - không refetch khi cửa sổ được focus (bé hay chuyển app qua lại ⇒ tránh tải thừa)
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
    mutations: {
      retry: 1,
    },
  },
});

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
