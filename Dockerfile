# syntax=docker/dockerfile:1
# =============================================================================
# RubyLingo — IMAGE PRODUCTION (Nhóm 12). Đa tầng: build → runtime.
# =============================================================================
# ⚠️⚠️ ĐỌC MỤC "SÁU LỖI HỎNG-IM-LẶNG" Ở `ARCHITECTURE.md` (Nhóm 12) TRƯỚC KHI SỬA TỆP NÀY.
#   Mỗi dòng dưới đây chặn một lỗi cụ thể; bỏ một dòng là mở lại một lỗi KHÔNG có thông báo.
#
#   S1 MẤT DB      : `DB_PATH` giải theo `process.cwd()` (`server/config.ts`) ⇒ `WORKDIR /app`
#                    + `DB_PATH` TUYỆT ĐỐI + volume `./data:/app/data` (đặt ở compose).
#   S2 THIẾU ENV   : `NODE_ENV=production` (đặt ở compose) — thiếu ⇒ tắt CSP + không in cảnh báo an ninh.
#   S3 HEALTH GIẢ  : healthcheck compose KHÔNG thay được smoke test đọc `migrationsApplied` (xem chú thích cuối tệp).
#   S4 `npm start` : script đó cần `cross-env` (devDependency) ⇒ `CMD` gọi thẳng `node`.
#   S5 ORIGIN LỆCH : `PUBLIC_ORIGIN` phải KHÔNG có `/` cuối (đặt ở compose).
#   S6 `.env` VÀO IMAGE: `.dockerignore` loại `.env`.
#
# ⚠️⚠️ MIGRATIONS — LỖI IM LẶNG NGUY HIỂM NHẤT CỦA TỆP NÀY (cùng họ S1/S3):
#   `server/db/migrate.ts` giải thư mục migration bằng
#       join(dirname(fileURLToPath(import.meta.url)), 'migrations')
#   Bundle là `dist-server/index.js` (`--format=esm`), và esbuild GIỮ NGUYÊN `import.meta.url`
#   (đã kiểm trên bundle thật: `dist-server/index.js:` `var MIGRATIONS_DIR = join(dirname2(
#   fileURLToPath(import.meta.url)), "migrations");`). ⇒ LÚC CHẠY đường dẫn là **/app/dist-server/migrations**.
#   Và esbuild (bundle JS) KHÔNG nhúng tệp `.sql`.
#   Nếu image thiếu thư mục đó: `runMigrations()` ném "Không tìm thấy thư mục migration" ⇒ app
#   KHÔNG khởi động (may mắn), NHƯNG nếu chỉ thiếu MỘT PHẦN thì app chạy trên schema thiếu bảng
#   mà `/api/health` vẫn xanh. Vì vậy: copy ĐÚNG thư mục + TỰ KIỂM ngay lúc build (xem `RUN test`).
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — BUILD
# -----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Manifest copy TRƯỚC mã nguồn để tận dụng cache layer: đổi một tệp `.ts` không phải `npm ci` lại.
COPY package.json package-lock.json ./

# ⚠️ CẦN devDependencies: `npm run build` = `typecheck` (tsc) + `vite build` + `esbuild`.
#    `npm ci --omit=dev` ở đây sẽ làm build ĐỎ vì thiếu tsc/vite/esbuild.
RUN npm ci

# Cấu hình build ở gốc repo.
COPY tsconfig.json tsconfig.shared.json tsconfig.app.json tsconfig.server.json tsconfig.test.json ./
COPY vite.config.ts tailwind.config.ts postcss.config.js index.html ./

# Mã nguồn. ⚠️ `scripts/` và `tests/` là BẮT BUỘC, không phải để cho vui:
#   `npm run typecheck` chạy cả `tsconfig.server.json` (gom `server/`, `shared/`, `scripts/`)
#   và `tsconfig.test.json` (gom `tests/**`). Thiếu một thư mục ⇒ tsc báo "No inputs were found"
#   ⇒ build đỏ ở bước typecheck, KHÔNG phải ở bước bundling.
COPY src ./src
COPY server ./server
COPY shared ./shared
COPY scripts ./scripts
COPY tests ./tests

# `public/` được Vite copy vào `dist/` (fonts, logo, assets tĩnh của SPA).
COPY public ./public

RUN npm run build

# Đếm số migration NGAY Ở STAGE BUILD, ghi ra tệp để stage runtime đối chiếu được.
# ⚠️ Vì sao không hardcode "10": thêm migration mới KHÔNG được đòi sửa Dockerfile. Ta so SỐ ĐƯỢC
#    COPY với SỐ CÓ TRONG NGUỒN — chép thiếu một tệp là lệch ngay.
RUN ls -1 server/db/migrations/*.sql | wc -l > /tmp/migrations-count.txt

# -----------------------------------------------------------------------------
# Stage 2 — RUNTIME
# -----------------------------------------------------------------------------
# ⚠️⚠️ CÙNG `node:20-bookworm-slim`, TUYỆT ĐỐI **KHÔNG dùng alpine**:
#   `better-sqlite3` và `@node-rs/argon2` là module NATIVE. Bản alpine dùng musl ⇒ phải tự build
#   từ mã nguồn (cần python/make/g++ trong image) hoặc tải prebuilt musl; bản bookworm-slim có
#   prebuilt **glibc** ⇒ `npm ci` cài xong là chạy. Đổi sang alpine sẽ làm app chết lúc khởi động
#   với lỗi nạp module native — và đó là lỗi IM LẶNG ở tầng build config.
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Bản build frontend (SPA) và bundle server.
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

# ⭐ MIGRATIONS: copy vào ĐÚNG chỗ bundle sẽ tìm (xem khối chú thích ở đầu tệp).
COPY --from=build /app/server/db/migrations ./dist-server/migrations

# Số migration ĐẾM ĐƯỢC Ở NGUỒN (stage build) — để đối chiếu, không hardcode.
COPY --from=build /tmp/migrations-count.txt /tmp/migrations-count.txt

# ⭐ TỰ KIỂM NGAY LÚC BUILD — SO SỐ LƯỢNG, không chỉ "có một tệp nào đó":
#    `test -f 001_account.sql` chỉ chứng minh ĐÚNG MỘT tệp tồn tại. Nếu lệnh copy sai đường dẫn
#    mà tình cờ có 1 tệp, hoặc copy bị hụt vài tệp `.sql`, thì build vẫn xanh trong khi app chạy
#    trên schema THIẾU BẢNG — mà `/api/health` vẫn báo "ok" (S3).
#    So SỐ ĐƯỢC COPY với SỐ Ở NGUỒN ⇒ lệch một tệp là BUILD ĐỎ.
RUN test "$(ls -1 ./dist-server/migrations/*.sql | wc -l)" -eq "$(cat /tmp/migrations-count.txt)" \
 && echo "→ migrations trong image: $(ls -1 ./dist-server/migrations/*.sql | wc -l) tệp (khớp nguồn)" \
 && ls -1 ./dist-server/migrations/*.sql

EXPOSE 3000

# ⚠️ KHÔNG `npm start`: script đó là `cross-env NODE_ENV=production node …`, mà `cross-env` là
#    devDependency ⇒ image `npm ci --omit=dev` sẽ chết với `cross-env: not found` (S4).
#    `NODE_ENV` KHÔNG hardcode ở đây — nó đến từ compose (S2), để một image dùng được cho cả dev.
CMD ["node", "dist-server/index.js"]

# =============================================================================
# ⚠️ S3 — HEALTHCHECK KHÔNG THAY ĐƯỢC SMOKE TEST (đọc kỹ, đây là lỗi đã lọt lưới một lần)
# =============================================================================
#   `/api/health` trả 200 miễn `pingDb()` xanh, và `countAppliedMigrations()` NUỐT lỗi rồi trả 0
#   (`server/db/migrate.ts`). Nghĩa là health có thể trả `status: "ok"` kèm
#   `migrationsApplied: 0` — app "khoẻ" trên schema RỖNG. Healthcheck của compose (đặt ở
#   `docker-compose.yml`) chỉ trả lời "tiến trình còn sống", KHÔNG trả lời "database đã migrate".
#   ⇒ Sau deploy PHẢI chạy thêm một smoke test ĐỌC VÀ SO:
#        curl -s https://<tên miền>/api/health | grep -o '"migrationsApplied":[0-9]*'
#        # phải bằng SỐ TỆP trong server/db/migrations/ (hiện tại: 10)
#   và bên trong container:
#        docker compose exec rubylingo ls -1 dist-server/migrations | wc -l   # phải bằng 10
