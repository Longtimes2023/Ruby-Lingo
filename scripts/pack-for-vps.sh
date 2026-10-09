#!/usr/bin/env bash
# =============================================================================
# RubyLingo — ĐÓNG GÓI MÃ NGUỒN để đưa lên VPS (Nhóm 12)
# =============================================================================
#
# ⭐ VÌ SAO CẦN SCRIPT NÀY:
#   `deploy.sh` chạy `docker compose up -d --build` với **thư mục hiện tại** làm build context
#   ⇒ mã nguồn PHẢI CÓ MẶT trên VPS trước khi deploy. Repo này **không dùng git**
#   (`git rev-parse` ⇒ "not a git repository") và `deploy.sh` cũng không gọi git ⇒ đường đi là:
#       đóng gói (script này) → scp lên VPS → giải nén → chạy `./scripts/deploy.sh`
#
# ⚠️⚠️ WHITELIST, KHÔNG BLACKLIST — và đây là quyết định có chủ ý:
#   Cách viết "lấy hết rồi loại `node_modules`, `data`, `.env`…" sẽ **quên** một thư mục mới xuất
#   hiện sau này và **âm thầm** đưa nó lên VPS. Ví dụ nghiêm trọng nhất: một tệp bí mật mới, hoặc
#   264 MB `node_modules` (nặng, và sai nền tảng — image tự cài bản của nó).
#   Whitelist thì thứ MỚI sẽ **không** được đưa lên cho tới khi có người chủ động thêm vào danh sách
#   dưới đây — hướng sai AN TOÀN.
#
# ⚠️ `.env` KHÔNG BAO GIỜ được vào gói: nó chứa `SESSION_SECRET`. VPS tự có `.env` riêng.
#   Gói chỉ mang `.env.example` làm mẫu. (Script kiểm CHÍNH XÁC: mục `.env*` duy nhất được phép
#   là `.env.example`.)
#
# ⚠️ KHÔNG DÙNG TỆP TẠM: môi trường này chặn `rm`, tệp tạm sẽ nằm lại vĩnh viễn. Vì vậy danh sách
#   gói được đọc **một lần** vào biến `LISTING` rồi kiểm trên biến đó (không giải nén 20 lần).
#
# -----------------------------------------------------------------------------
# DÙNG
# -----------------------------------------------------------------------------
#   ./scripts/pack-for-vps.sh                     # ra ../rubylingo-src-<ISO-UTC>.tar.gz
#   OUT=/tmp/rl.tar.gz ./scripts/pack-for-vps.sh  # chọn đường dẫn ra
#
#   Rồi trên máy VPS:
#     mkdir -p /srv/rubylingo && tar -xzf rubylingo-src-*.tar.gz -C /srv/rubylingo
#     cd /srv/rubylingo && cp .env.example .env   # rồi điền SUBDOMAIN/DOMAIN_NAME/SESSION_SECRET…
#     ./scripts/deploy.sh
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${OUT:-$(dirname "$REPO_ROOT")/rubylingo-src-${STAMP}.tar.gz}"

# --- Tiện ích in ấn ---------------------------------------------------------
step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
ok()   { printf '\033[32m  ✓ %s\033[0m\n' "$1"; }
note() { printf '\033[36m  ⓘ %s\033[0m\n' "$1"; }
warn() { printf '\033[33m  ⚠ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m✗ %s\033[0m\n' "$1"; exit 1; }

# -----------------------------------------------------------------------------
# DANH SÁCH ĐƯA LÊN — mỗi mục kèm LÝ DO, để người sau không xoá nhầm
# -----------------------------------------------------------------------------
FILES=(
  # --- cần cho `docker build` (Dockerfile gọi `npm ci` + `npm run build`) ---
  package.json package-lock.json
  tsconfig.json tsconfig.app.json tsconfig.server.json tsconfig.shared.json tsconfig.test.json
  vite.config.ts tailwind.config.ts postcss.config.js index.html
  # --- mã nguồn ---
  src server shared
  # --- ⚠️ `tests/` + `scripts/` KHÔNG phải "cho vui": `npm run build` chạy `typecheck`, mà
  #     `tsconfig.test.json` gom `tests/**` và `tsconfig.server.json` gom `scripts/**`.
  #     Thiếu một trong hai ⇒ `tsc` báo "No inputs were found" ⇒ build ĐỎ, và lỗi đọc ra rất dễ
  #     bị đoán nhầm sang phần bundling.
  tests scripts
  # --- ⚠️ TÀI SẢN BẮT BUỘC: Vite copy `public/` vào `dist/` lúc build. Trong đó có 201 ảnh
  #     webp từ vựng + 9 ảnh cảnh + font + logo. Thiếu ⇒ app chạy nhưng MẤT HẾT ẢNH. ---
  public
  # --- bộ tệp triển khai ---
  Dockerfile docker-compose.yml .dockerignore
  deploy .env.example
  # --- cấu hình lint/format: KHÔNG bắt buộc để deploy, nhưng để VPS chạy được `npm run ci`
  #     (ci = typecheck + lint + validate:content + gen + test). Ba tệp, vài KB. ---
  .eslintrc.cjs .prettierrc .editorconfig
)

# -----------------------------------------------------------------------------
# KIỂM TRƯỚC KHI ĐÓNG GÓI — bắt lỗi ở máy này rẻ hơn nhiều so với trên VPS
# -----------------------------------------------------------------------------
step "Kiểm trước khi đóng gói"

miss=0
for f in "${FILES[@]}"; do
  [ -e "$f" ] || { printf '  \033[31m✗ thiếu: %s\033[0m\n' "$f"; miss=1; }
done
[ "$miss" -eq 0 ] || fail "Thiếu tệp bắt buộc ⇒ DỪNG (không tạo gói thiếu)."

# ⚠️ `.env` phải TỒN TẠI ở máy này (đang chạy dev) nhưng KHÔNG được vào gói.
[ -f .env ] && note ".env có ở máy này và sẽ KHÔNG được đóng gói (đúng)"

WORD_IMAGES="$(find public/assets/words -maxdepth 1 -name '*.webp' -type f | wc -l | tr -d ' ')"
[ "$WORD_IMAGES" -ge 200 ] \
  || fail "Chỉ có ${WORD_IMAGES} ảnh webp trong public/assets/words (cần 201) ⇒ DỪNG."
SCENE_IMAGES="$(find public/assets/scenes -name '*.webp' -type f | wc -l | tr -d ' ')"
MIGRATIONS="$(find server/db/migrations -maxdepth 1 -name '*.sql' -type f | wc -l | tr -d ' ')"
[ "$MIGRATIONS" -ge 1 ] || fail "Không thấy migration .sql nào ⇒ DỪNG."

ok "có đủ ${#FILES[@]} mục whitelist"
ok "${WORD_IMAGES} ảnh webp từ vựng + ${SCENE_IMAGES} ảnh cảnh"
ok "${MIGRATIONS} tệp migration .sql"

# -----------------------------------------------------------------------------
# ĐÓNG GÓI
# -----------------------------------------------------------------------------
step "Đóng gói"
printf '  → %s\n' "$OUT"
# ⚠️ CHUẨN HOÁ CHỦ SỞ HỮU — và một cái bẫy đã trả giá:
#   Không có cờ này, gói mang UID/GID của Windows (`197609/197121` = mảnh SID). Trên VPS Linux,
#   giải nén bằng `sudo` ⇒ `/srv/rubylingo` thuộc về một người dùng KHÔNG TỒN TẠI ⇒ `ls -l` hiện
#   số, và sau đó thao tác bằng người dùng thường sẽ bị "Permission denied" khó hiểu.
#   ⚠️ `--owner=root --group=root` **BỊ BỎ QUA ÂM THẦM** trên tar của Windows (đã thử: vẫn ra
#      197609/197121, KHÔNG có cảnh báo). CHỈ dạng SỐ hoạt động, và phải kèm `--numeric-owner`.
tar -czf "$OUT" --numeric-owner --owner=0 --group=0 "${FILES[@]}"

# -----------------------------------------------------------------------------
# KIỂM CHỨNG GÓI — không tin "đã đóng gói xong"
# -----------------------------------------------------------------------------
step "Kiểm chứng gói"

gzip -t "$OUT" || fail "Gói hỏng (gzip -t thất bại)."
LISTING="$(tar -tzf "$OUT")"
SIZE="$(du -h "$OUT" | cut -f1)"
COUNT="$(printf '%s\n' "$LISTING" | wc -l | tr -d ' ')"
printf '  gói: %s\n  kích thước: %s — %s mục\n' "$(basename "$OUT")" "$SIZE" "$COUNT"

# --- (1) `.env*`: mục DUY NHẤT được phép là `.env.example` -------------------
ENVLIKE="$(printf '%s\n' "$LISTING" | grep -E '^\.env' || true)"
if [ "$ENVLIKE" != ".env.example" ]; then
  printf '  \033[31m✗ mục .env* trong gói:\033[0m\n'
  printf '      %s\n' "${ENVLIKE:-<không có .env.example!>}"
  fail "Gói chứa tệp môi trường ngoài '.env.example' (nguy cơ lộ SESSION_SECRET) ⇒ DỪNG."
fi
ok ".env KHÔNG có trong gói; .env.example có (làm mẫu)"

# --- (2) TUYỆT ĐỐI KHÔNG ĐƯỢC CÓ MẶT ---------------------------------------
BAD='^node_modules/|^data/|^backups/|^_verify/|^outputs/|^generated-images/|^asset-src/|^coverage/|^dist/|^dist-server/|^\.workbuddy-ai/|\.timestamp-.*\.mjs$'
hit="$(printf '%s\n' "$LISTING" | grep -E "$BAD" | head -n5 || true)"
if [ -n "$hit" ]; then
  printf '  \033[31m✗ GÓI CHỨA THỨ KHÔNG NÊN CÓ:\033[0m\n'
  printf '      %s\n' "$hit"
  fail "DỪNG — không dùng gói này. Kiểm lại danh sách whitelist."
fi
ok "không có node_modules / data / backups / _verify / dist* / asset-src / rác Vite"

# --- (3) NHỮNG THỨ BẮT BUỘC PHẢI CÓ ----------------------------------------
NEED=(
  package.json package-lock.json
  Dockerfile docker-compose.yml .dockerignore .env.example
  vite.config.ts tailwind.config.ts postcss.config.js index.html
  tsconfig.json tsconfig.app.json tsconfig.server.json tsconfig.shared.json tsconfig.test.json
  src/ server/ shared/ scripts/ tests/ public/
  server/db/migrations/ deploy/README.md
)
for n in "${NEED[@]}"; do
  printf '%s\n' "$LISTING" | grep -qxF "$n" \
    || fail "THIẾU trong gói: $n"
done
ok "có đủ tệp build + mã nguồn + tài sản + bộ deploy"

# --- (4) ĐẾM ẢNH VÀ MIGRATION *TRONG GÓI* (không chỉ ở đĩa) -----------------
IN_PACK="$(printf '%s\n' "$LISTING" | grep -c '^public/assets/words/.*\.webp$' || true)"
[ "$IN_PACK" -eq "$WORD_IMAGES" ] \
  || fail "ảnh từ vựng trong gói (${IN_PACK}) ≠ trên đĩa (${WORD_IMAGES})."
SC_IN_PACK="$(printf '%s\n' "$LISTING" | grep -c '^public/assets/scenes/.*\.webp$' || true)"
[ "$SC_IN_PACK" -eq "$SCENE_IMAGES" ] \
  || fail "ảnh cảnh trong gói (${SC_IN_PACK}) ≠ trên đĩa (${SCENE_IMAGES})."
MIG_IN_PACK="$(printf '%s\n' "$LISTING" | grep -c '^server/db/migrations/.*\.sql$' || true)"
[ "$MIG_IN_PACK" -eq "$MIGRATIONS" ] \
  || fail "migration trong gói (${MIG_IN_PACK}) ≠ trên đĩa (${MIGRATIONS})."
ok "${IN_PACK} ảnh từ vựng + ${SC_IN_PACK} ảnh cảnh + ${MIG_IN_PACK} migration có trong gói"

# --- (5) ĐỌC THẬT NỘI DUNG RA (không chỉ tin danh sách tên tệp) -------------
tar -xzOf "$OUT" Dockerfile 2>/dev/null | grep -q 'syntax=docker/dockerfile' \
  || fail "Không đọc được nội dung Dockerfile từ gói (tệp rỗng?)."
tar -xzOf "$OUT" package.json 2>/dev/null | grep -q '"rubylingo"' \
  || fail "Không đọc được nội dung package.json từ gói."
tar -xzOf "$OUT" docker-compose.yml 2>/dev/null | grep -q 'traefik_network' \
  || fail "docker-compose.yml trong gói KHÔNG có traefik_network (sai tệp?)."
tar -xzOf "$OUT" deploy/README.md 2>/dev/null | grep -q . \
  || fail "deploy/README.md trong gói rỗng."
ok "đọc ngược được nội dung Dockerfile / package.json / docker-compose.yml / deploy/README.md"

# --- (6) MỌI `COPY <nguồn>` CỦA DOCKERFILE PHẢI CÓ TRONG GÓI -----------------
# ⚠️ ĐÂY LÀ CHỐT KIỂM QUAN TRỌNG NHẤT: (3) chỉ chứng minh "có `src/`, `public/`…";
#    bước này chứng minh "ĐỦ ĐỂ `docker build` CHẠY". Nếu ai thêm một `COPY` mới vào Dockerfile
#    mà quên thêm vào whitelist ở đầu script này, gói sẽ THIẾU tệp đó ⇒ `docker build` đỏ trên VPS
#    với "COPY failed: file not found" — lỗi mà ta hoàn toàn có thể bắt NGAY Ở MÁY NÀY.
#    Bỏ qua `COPY --from=...` (nguồn nằm trong stage build, không phải trong gói).
COPY_SRCS="$(grep -E '^[[:space:]]*COPY[[:space:]]' Dockerfile | grep -v -- '--from=' | awk '{for(i=2;i<NF;i++) print $i}')"
[ -n "$COPY_SRCS" ] || fail "Không đọc được dòng COPY nào từ Dockerfile (định dạng lạ?) — không kiểm được."
n_copysrc=0
while IFS= read -r srcpath; do
  [ -n "$srcpath" ] || continue
  n_copysrc=$((n_copysrc + 1))
  clean="${srcpath#./}"
  printf '%s\n' "$LISTING" | grep -qxF "$clean" \
    || printf '%s\n' "$LISTING" | grep -q "^${clean}/" \
    || fail "Dockerfile có 'COPY ${srcpath}' nhưng gói KHÔNG chứa '${clean}' ⇒ build sẽ đỏ trên VPS."
done <<< "$COPY_SRCS"
ok "mọi nguồn 'COPY' của Dockerfile (${n_copysrc} mục) đều có trong gói ⇒ build được"

# --- (7) CHỦ SỞ HỮU ĐÃ CHUẨN HOÁ CHƯA (bắt việc gỡ mất cờ `--owner=0`) -------
OWNERS="$(tar --numeric-owner -tzvf "$OUT" | awk '{print $2}' | sort -u | tr '\n' ' ')"
if [ "$OWNERS" = "0/0 " ]; then
  ok "chủ sở hữu trong gói đã chuẩn hoá (0/0)"
else
  warn "chủ sở hữu trong gói KHÁC 0/0: ${OWNERS% }"
  warn "  ⇒ giải nén bằng sudo sẽ tạo tệp thuộc người dùng không tồn tại trên VPS."
  warn "  ⇒ kiểm lại cờ '--numeric-owner --owner=0 --group=0' trong lệnh tar của script này."
fi

# -----------------------------------------------------------------------------
step "XONG"
printf '\n\033[32m✅ GÓI SẴN SÀNG: %s\033[0m\n' "$OUT"
printf '   (%s — %s mục)\n\n' "$SIZE" "$COUNT"
printf '   1) Từ máy này, chuyển lên VPS:\n'
printf '        scp "%s" user@vps:/tmp/\n\n' "$(basename "$OUT")"
printf '   2) Trên VPS, giải nén:\n'
printf '        mkdir -p /srv/rubylingo && tar -xzf /tmp/%s -C /srv/rubylingo\n' "$(basename "$OUT")"
printf '        cd /srv/rubylingo\n\n'
printf '   3) Tạo .env TẠI VPS (không dùng .env của máy dev):\n'
printf '        cp .env.example .env\n'
printf '        # điền: SUBDOMAIN, DOMAIN_NAME, SESSION_SECRET, COOKIE_SECURE=true, PUBLIC_ORIGIN\n'
printf '        #   SESSION_SECRET sinh bằng:\n'
printf '        #   node -e "console.log(require(\x27crypto\x27).randomBytes(48).toString(\x27base64url\x27))"\n\n'
printf '   4) Deploy:\n'
printf '        ./scripts/deploy.sh\n\n'
printf '   (Tài liệu kiến trúc + PRD nằm NGOÀI repo, ở ../deliverables/english-starters/ —\n'
printf '    không cần cho deploy; muốn mang theo thì scp riêng.)\n\n'
