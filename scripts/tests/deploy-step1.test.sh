#!/usr/bin/env bash
# =============================================================================
# KIỂM CHỨNG BƯỚC 1 CỦA scripts/deploy.sh — CHỐNG TÁI PHÁT LỖI "SCRIPT THOÁT IM LẶNG"
# =============================================================================
# VÌ SAO TỆP NÀY TỒN TẠI (lỗi thật, 2026-10-09, người dùng gặp trên VPS):
#   `./scripts/deploy.sh` in ra tới dòng `✓ cấu hình hợp lệ, URL công khai sẽ kiểm: https://…`
#   rồi TRẢ VỀ DẤU NHẮC SHELL — không lỗi, không mã thoát khác 0 nhìn thấy được, không gợi ý.
#   Người dùng tưởng script "treo"/"dừng giữa chừng" và không biết phải làm gì.
#
#   Nguyên nhân: `set -euo pipefail` + phép GÁN `VAR="$(… | grep -oE 'X=…' | head -n1 | cut …)"`.
#   Khi `grep` KHÔNG khớp, cả pipeline trả 1 ⇒ `set -e` coi phép gán là lệnh thất bại ⇒ **thoát
#   ngay tại dòng đó, im lặng**. Dòng `[ -n "$VAR" ] || fail …` ngay dưới trở thành MÃ CHẾT.
#   Và `grep` không khớp vì `docker compose config` CHUẨN HOÁ `labels` sang dạng MAP (`k: v`,
#   dấu `:`) trong khi mã cũ chỉ tìm dấu `=`.
#
#   ➜ Loại lỗi này VÔ HÌNH với mọi cổng hiện có: `tsc`, `eslint`, `prettier`, `vitest` đều không
#     mở tệp `.sh`; `actionlint` chỉ soi `run:` BÊN TRONG workflow, không soi script rời.
#     Cách duy nhất bắt được là CHẠY THẬT với một `docker` giả — đó là việc của tệp này.
#
# CÁCH DÙNG:
#   bash scripts/tests/deploy-step1.test.sh
#   DEPLOY_SH=/đường/dẫn/bản/cũ/deploy.sh bash scripts/tests/deploy-step1.test.sh   # kiểm test có răng
#
# Không cần Docker, không cần mạng, không cần VPS. Chạy được trên Linux (CI) và Git Bash (Windows).
# =============================================================================

# ⚠️ CỐ Ý KHÔNG dùng `set -e`: tệp này phải tự đếm số ca HỎNG rồi mới quyết định mã thoát.
#    Dùng `set -e` ở đây thì chính tệp kiểm chứng lại mắc đúng cái bệnh nó đang canh.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
DEPLOY_SH="${DEPLOY_SH:-$REPO_ROOT/scripts/deploy.sh}"

[ -f "$DEPLOY_SH" ] || { printf 'không thấy deploy.sh: %s\n' "$DEPLOY_SH" >&2; exit 2; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# --- `docker` GIẢ: chỉ trả lời `compose config`, mọi lệnh khác no-op thành công ---------------
# ⚠️ Đặt trong $WORK/bin rồi CHÈN LÊN ĐẦU PATH ⇒ luôn thắng `docker` thật của máy.
#    Nhờ vậy test không cần Docker, không cần quyền, và KHÔNG BAO GIỜ chạm vào máy thật.
mkdir -p "$WORK/bin"
cat > "$WORK/bin/docker" <<'STUB'
#!/usr/bin/env bash
if [ "${1:-}" = "compose" ] && [ "${2:-}" = "config" ]; then
  cat "${STUB_CONFIG:?STUB_CONFIG chưa được đặt}"
  exit 0
fi
exit 0
STUB
chmod +x "$WORK/bin/docker" 2>/dev/null || true

# --- Repo GIẢ: deploy.sh thật + đúng những tệp nó đòi, không hơn -------------------------------
FAKE="$WORK/repo"
mkdir -p "$FAKE/scripts" "$FAKE/server/db/migrations"
cp "$DEPLOY_SH" "$FAKE/scripts/deploy.sh"
: > "$FAKE/Dockerfile"
: > "$FAKE/docker-compose.yml"
: > "$FAKE/server/db/migrations/001_init.sql"
printf 'SUBDOMAIN=ruby\nDOMAIN_NAME=truongducdat.com\nTRAEFIK_CERTRESOLVER=le\nSESSION_SECRET=abc\n' > "$FAKE/.env"

# --- Chạy một ca ------------------------------------------------------------------------------
# ⚠️ Mọi thời gian chờ bị ép về 1 ⇒ ca chạy trong ~1 giây. `SKIP_BUILD=1` để không đụng image.
run_case() {
  LAST_OUT="$WORK/out.$(printf '%s' "$1" | tr -c 'a-zA-Z0-9' '_').txt"
  (
    cd "$FAKE" || exit 99
    PATH="$WORK/bin:$PATH" \
      STUB_CONFIG="$2" \
      READY_ATTEMPTS=1 READY_INTERVAL=1 POLL_ATTEMPTS=1 POLL_INTERVAL=1 SKIP_BUILD=1 \
      bash scripts/deploy.sh
  ) > "$LAST_OUT" 2>&1
  LAST_EXIT=$?
}

FAILED=0
PASSED=0

# ⚠️ `grep -F` (chuỗi cố định) chứ KHÔNG `grep -E`: nội dung cần tìm chứa `(`, `.`, `[` … —
#    dùng regex ở đây là tự tạo ra một lớp lỗi mới y hệt loại đang đi bắt.
expect_has() {
  if grep -qF -- "$1" "$LAST_OUT"; then
    printf '    ✓ có: %s\n' "$1"; PASSED=$((PASSED + 1))
  else
    printf '    ✗ THIẾU: %s\n' "$1"; FAILED=$((FAILED + 1))
  fi
}
expect_hasnt() {
  if grep -qF -- "$1" "$LAST_OUT"; then
    printf '    ✗ KHÔNG ĐƯỢC CÓ: %s\n' "$1"; FAILED=$((FAILED + 1))
  else
    printf '    ✓ không có: %s\n' "$1"; PASSED=$((PASSED + 1))
  fi
}
expect_exit_nonzero() {
  if [ "$LAST_EXIT" -ne 0 ]; then
    printf '    ✓ mã thoát = %s (khác 0)\n' "$LAST_EXIT"; PASSED=$((PASSED + 1))
  else
    printf '    ✗ mã thoát = 0 — ĐÁNG LẼ PHẢI ĐỎ\n'; FAILED=$((FAILED + 1))
  fi
}

# =============================================================================
# CA A — dạng MAP, KHÔNG nháy: đây là dạng `docker compose config` THẬT in ra
# =============================================================================
# Đây chính là ca tái hiện lỗi của người dùng: bản cũ thoát im lặng ngay tại đây.
cat > "$WORK/cfg-map.yml" <<'YML'
services:
  rubylingo:
    labels:
      traefik.enable: "true"
      traefik.http.routers.rubylingo.rule: Host(`ruby.truongducdat.com`)
      traefik.http.routers.rubylingo.tls.certresolver: le
YML
printf '\nCA A — map form (k: v), giá trị KHÔNG nháy\n'
run_case "A" "$WORK/cfg-map.yml"
expect_has    "cấu hình hợp lệ, URL công khai sẽ kiểm: https://ruby.truongducdat.com"
expect_has    "certresolver: le ("
expect_hasnt   "BƯỚC 1 THẤT BẠI"

# =============================================================================
# CA B — dạng MAP, giá trị CÓ nháy (YAML hay in vậy) ⇒ phải cắt nháy
# =============================================================================
cat > "$WORK/cfg-map-quoted.yml" <<'YML'
services:
  rubylingo:
    labels:
      traefik.http.routers.rubylingo.rule: Host(`ruby.truongducdat.com`)
      traefik.http.routers.rubylingo.tls.certresolver: "le"
YML
printf '\nCA B — map form, giá trị có nháy ⇒ nháy phải bị cắt\n'
run_case "B" "$WORK/cfg-map-quoted.yml"
expect_has    "certresolver: le ("
expect_hasnt   "certresolver: \"le\""
expect_hasnt   "BƯỚC 1 THẤT BẠI"

# =============================================================================
# CA C — dạng DANH SÁCH (`- "k=v"`): compose đời cũ / người dùng tự viết tay
# =============================================================================
cat > "$WORK/cfg-list.yml" <<'YML'
services:
  rubylingo:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.rubylingo.rule=Host(`ruby.truongducdat.com`)"
      - "traefik.http.routers.rubylingo.tls.certresolver=le"
YML
printf '\nCA C — list form (- "k=v")\n'
run_case "C" "$WORK/cfg-list.yml"
expect_has    "certresolver: le ("
expect_hasnt   "BƯỚC 1 THẤT BẠI"

# =============================================================================
# CA D — tên VÍ DỤ `mytlschallenge` ⇒ phải CẢNH BÁO (đây là bẫy HTTPS chết im lặng)
# =============================================================================
cat > "$WORK/cfg-example.yml" <<'YML'
services:
  rubylingo:
    labels:
      traefik.http.routers.rubylingo.rule: Host(`ruby.truongducdat.com`)
      traefik.http.routers.rubylingo.tls.certresolver: mytlschallenge
YML
printf '\nCA D — certresolver = tên ví dụ ⇒ phải warn\n'
run_case "D" "$WORK/cfg-example.yml"
expect_has "đây là tên VÍ DỤ trong tài liệu Traefik"

# =============================================================================
# CA E — THIẾU hẳn nhãn certresolver ⇒ phải ĐỎ và NÓI RÕ LÝ DO (chốt then chốt!)
# =============================================================================
# ⚠️⚠️ ĐÂY LÀ CA QUAN TRỌNG NHẤT. Bản cũ: grep không khớp ⇒ thoát IM LẶNG (mã 1 nhưng KHÔNG một
#     dòng thông báo) ⇒ `expect_has "BƯỚC 1 THẤT BẠI"` thất bại ⇒ test đỏ. Đúng như mong muốn.
cat > "$WORK/cfg-nocert.yml" <<'YML'
services:
  rubylingo:
    labels:
      traefik.http.routers.rubylingo.rule: Host(`ruby.truongducdat.com`)
YML
printf '\nCA E — thiếu nhãn certresolver ⇒ đỏ, và PHẢI NÓI RÕ\n'
run_case "E" "$WORK/cfg-nocert.yml"
expect_exit_nonzero
expect_has "BƯỚC 1 THẤT BẠI"
expect_has "tls.certresolver"

# =============================================================================
# CA F — không có `Host(...)` nào ⇒ phải ĐỎ và NÓI RÕ (cùng họ bẫy: gán thất bại im lặng)
# =============================================================================
cat > "$WORK/cfg-nohost.yml" <<'YML'
services:
  rubylingo:
    labels:
      traefik.enable: "true"
      traefik.http.routers.rubylingo.tls.certresolver: le
YML
printf '\nCA F — không có Host(...) ⇒ đỏ, và PHẢI NÓI RÕ\n'
run_case "F" "$WORK/cfg-nohost.yml"
expect_exit_nonzero
expect_has "BƯỚC 1 THẤT BẠI"

# =============================================================================
printf '\n─────────────────────────────────────────────\n'
if [ "$FAILED" -eq 0 ]; then
  printf '\033[32m✅ BƯỚC 1 OK — %s khẳng định xanh (6 ca).\033[0m\n' "$PASSED"
  exit 0
fi
printf '\033[31m✗ %s khẳng định ĐỎ (trong %s).\033[0m\n' "$FAILED" "$((FAILED + PASSED))"
printf '   Xem đầu ra thật của ca hỏng:\n'
for f in "$WORK"/out.*.txt; do
  printf '\n── %s ──\n' "$(basename "$f")"
  sed 's/^/    /' "$f"
done
exit 1
