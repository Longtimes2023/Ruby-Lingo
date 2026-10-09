/// <reference types="vite/client" />

/**
 * Biến môi trường của Vite được nhúng vào bundle lúc build.
 * Chỉ những biến có tiền tố VITE_ mới lộ ra client — KHÔNG bao giờ đặt bí mật ở đây.
 */
interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
