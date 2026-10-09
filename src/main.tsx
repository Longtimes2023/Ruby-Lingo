import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import './styles/index.css';
import './i18n/index.js';
import { App } from './App.js';
// ⚠️ `queryClient` nằm ở `lib/queryClient.ts` (không phải dựng ở đây): `GameResultService` cần
//    LÀM MỚI danh sách kết quả game sau khi một lượt chơi tới server, mà import trực tiếp từ
//    `main.tsx` sẽ tạo VÒNG IMPORT (main → App → … → GameResultService → main). Xem đầu tệp đó.
import { queryClient } from './lib/queryClient.js';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Không tìm thấy phần tử #root trong index.html');

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
