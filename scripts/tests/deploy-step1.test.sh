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
# Giả lập MỘT container Traefik khai resolver bằng CỜ DÒNG LỆNH — chỉ bật khi STUB_TRAEFIK_RESOLVER
# có giá trị. Đây là kênh DUY NHẤT để `deploy.sh` "đối chiếu được với Traefik" trong môi trường
# test, nhờ đó kiểm được cả nhánh KHỚP (xanh) lẫn nhánh KHÔNG KHỚP (đỏ) — thay vì chỉ kiểm được
# nhánh "không dò ra gì".
if [ -n "${STUB_TRAEFIK_RESOLVER:-}" ]; then
  if [ "${1:-}" = "ps" ]; then
    for a in "$@"; do
      if [ "$a" = "--format" ]; then printf 'traefik\ttraefik:v3.1\n'; exit 0; fi
    done
    exit 0
  fi
  if [ "${1:-}" = "inspect" ]; then
    for a in "$@"; do
      if [ "$a" = "{{json .Config.Cmd}}" ]; then
        printf '["--certificatesresolvers.%s.acme.email=me@x.com"]\n' "$STUB_TRAEFIK_RESOLVER"
        exit 0
      fi
    done
    exit 0
  fi
fi
exit 0
STUB
chmod +x "$WORK/bin/docker" 2>/dev/null || true

# --- Repo GIẢ: deploy.sh thật + đúng những tệp nó đòi, không hơn -------------------------------
FAKE="$WORK/repo"
mkdir -p "$FAKE/scripts" "$FAKE/server/db/migrations"
cp "$DEPLOY_SH" "$FAKE/scripts/deploy.sh"
# ⚠️⚠️ `deploy.sh` BƯỚC 1 GỌI `scripts/find-certresolver.sh` để ĐỐI CHIẾU tên resolver với Traefik.
#    Thiếu nó, `deploy.sh` rơi vào nhánh "chưa kiểm chứng được" ⇒ ca G/H không bao giờ chạm tới nhánh
#    KHỚP/KHÔNG KHỚP, và test sẽ XANH mà chẳng kiểm được gì.
#    ⇒ Repo giả PHẢI có đủ hai script như repo thật, và THIẾU thì phải ĐỎ ngay chứ không bỏ qua.
RESOLVER_SH="$(dirname "$DEPLOY_SH")/find-certresolver.sh"
[ -f "$RESOLVER_SH" ] || RESOLVER_SH="$REPO_ROOT/scripts/find-certresolver.sh"
if [ -f "$RESOLVER_SH" ]; then
  cp "$RESOLVER_SH" "$FAKE/scripts/find-certresolver.sh"
else
  printf 'LỖI: không tìm thấy find-certresolver.sh (đã thử %s và %s/scripts/).\n' \
    "$(dirname "$DEPLOY_SH")/find-certresolver.sh" "$REPO_ROOT" >&2
  printf '      Không có nó thì các ca G/H không kiểm được gì — dừng thay vì báo xanh giả.\n' >&2
  exit 2
fi
: > "$FAKE/Dockerfile"
: > "$FAKE/docker-compose.yml"
: > "$FAKE/server/db/migrations/001_init.sql"
printf 'SUBDOMAIN=ruby\nDOMAIN_NAME=truongducdat.com\nTRAEFIK_CERTRESOLVER=le\nSESSION_SECRET=abc\n' > "$FAKE/.env"

# --- Bộ lọc ca --------------------------------------------------------------------------------
# ⚠️ VÌ SAO CẦN: mỗi ca chạy `deploy.sh` THẬT, mà `deploy.sh` lại gọi `find-certresolver.sh` — tổng
#    cộng ~45 tiến trình con mỗi ca. Trên máy bị GIỚI HẠN SỐ TIẾN TRÌNH (sandbox của môi trường
#    phát triển: bị SIGTERM ở khoảng 150 tiến trình), chạy đủ 8 ca trong một lượt là không thể.
#    `ONLY=A,B` chạy đúng các ca đó. **CI chạy KHÔNG đặt `ONLY`** ⇒ luôn đủ 8 ca.
#    ⚠️ Ca bị bỏ qua thì KHÔNG tính vào PASSED/FAILED — nếu tính là "xanh" thì bộ lọc sẽ trở thành
#       cách báo xanh giả, đúng thứ tệp này sinh ra để chống.
ONLY="${ONLY:-}"
SKIPPING=0
case_selected() {
  [ -z "$ONLY" ] && return 0
  case ",$ONLY," in *",$1,"*) return 0 ;; esac
  return 1
}
title() { case_selected "$1" && printf '\nCA %s — %s\n' "$1" "$2"; return 0; }

# --- Chạy một ca ------------------------------------------------------------------------------
# ⚠️ Mọi thời gian chờ bị ép về 1 ⇒ ca chạy trong ~1 giây. `SKIP_BUILD=1` để không đụng image.
run_case() {
  if ! case_selected "$1"; then
    SKIPPING=1; LAST_OUT=/dev/null; LAST_EXIT=0; return 0
  fi
  SKIPPING=0
  LAST_OUT="$WORK/out.$(printf '%s' "$1" | tr -c 'a-zA-Z0-9' '_').txt"
  (
    cd "$FAKE" || exit 99
    PATH="$WORK/bin:$PATH" \
      STUB_CONFIG="$2" \
      STUB_TRAEFIK_RESOLVER="${STUB_TRAEFIK_RESOLVER:-}" \
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
  [ "$SKIPPING" -eq 1 ] && return 0
  if grep -qF -- "$1" "$LAST_OUT"; then
    printf '    ✓ có: %s\n' "$1"; PASSED=$((PASSED + 1))
  else
    printf '    ✗ THIẾU: %s\n' "$1"; FAILED=$((FAILED + 1))
  fi
}
expect_hasnt() {
  [ "$SKIPPING" -eq 1 ] && return 0
  if grep -qF -- "$1" "$LAST_OUT"; then
    printf '    ✗ KHÔNG ĐƯỢC CÓ: %s\n' "$1"; FAILED=$((FAILED + 1))
  else
    printf '    ✓ không có: %s\n' "$1"; PASSED=$((PASSED + 1))
  fi
}
expect_exit_nonzero() {
  [ "$SKIPPING" -eq 1 ] && return 0
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
title A "map form (k: v), giá trị KHÔNG nháy"
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
title B "map form, giá trị có nháy ⇒ nháy phải bị cắt"
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
title C "list form (- \"k=v\")"
run_case "C" "$WORK/cfg-list.yml"
expect_has    "certresolver: le ("
expect_hasnt   "BƯỚC 1 THẤT BẠI"

# =============================================================================
# CA D — `mytlschallenge` KHÔNG được coi là "tên ví dụ ⇒ chắc chắn sai"
# =============================================================================
# ⚠️⚠️ CA NÀY RA ĐỜI TỪ MỘT SỰ CỐ THẬT (2026-10-09): bản trước in
#     "đây là tên VÍ DỤ trong tài liệu Traefik, KHÔNG phải tên của bạn" cho MỌI giá trị
#     `mytlschallenge`. Nhưng người dùng thật có Traefik dùng ĐÚNG tên đó — nó là tên trong rất
#     nhiều hướng dẫn dựng Traefik. Câu khẳng định đó suýt khiến anh ấy đi SỬA MỘT GIÁ TRỊ ĐANG
#     ĐÚNG, tức là tự tay làm hỏng HTTPS. Ca này canh nó không tái diễn.
cat > "$WORK/cfg-example.yml" <<'YML'
services:
  rubylingo:
    labels:
      traefik.http.routers.rubylingo.rule: Host(`ruby.truongducdat.com`)
      traefik.http.routers.rubylingo.tls.certresolver: mytlschallenge
YML
title D "mytlschallenge — KHÔNG được coi là tên sai"
run_case "D" "$WORK/cfg-example.yml"
expect_has    "certresolver: mytlschallenge ("
expect_hasnt   "KHÔNG phải tên của bạn"
expect_hasnt   "BƯỚC 1 THẤT BẠI"

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
title E "thiếu nhãn certresolver ⇒ đỏ, và PHẢI NÓI RÕ"
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
title F "không có Host(...) ⇒ đỏ, và PHẢI NÓI RÕ"
run_case "F" "$WORK/cfg-nohost.yml"
expect_exit_nonzero
expect_has "BƯỚC 1 THẤT BẠI"

# =============================================================================
# CA G — Traefik khai MỘT TÊN KHÁC ⇒ phải ĐỎ (đây là bằng chứng DƯƠNG TÍNH của lỗi "HTTPS chết")
# =============================================================================
# ⚠️⚠️ CA NÀY LÀ LÝ DO CHÍNH KHIẾN `deploy.sh` PHẢI ĐỔI TỪ "CẢNH BÁO CHUNG CHUNG" SANG "ĐỐI CHIẾU":
#    `docker-compose.yml` gửi `le`, cấu hình Traefik khai `khac`. Trước đây script chỉ in ra tên rồi
#    đi tiếp (hoặc tệ hơn: khẳng định một giá trị ĐÚNG là "tên ví dụ") ⇒ deploy xanh, site chết HTTPS.
cat > "$WORK/cfg-le.yml" <<'YML'
services:
  rubylingo:
    labels:
      traefik.http.routers.rubylingo.rule: Host(`ruby.truongducdat.com`)
      traefik.http.routers.rubylingo.tls.certresolver: le
YML
title G "Traefik khai tên KHÁC ⇒ phải ĐỎ"
STUB_TRAEFIK_RESOLVER=khac
run_case "G" "$WORK/cfg-le.yml"
expect_exit_nonzero
expect_has "BƯỚC 1 THẤT BẠI"
expect_has "KHÔNG KHỚP"
expect_has "khac"
unset STUB_TRAEFIK_RESOLVER

# =============================================================================
# CA H — Traefik khai ĐÚNG tên ⇒ phải XANH và nói rõ là ĐÃ ĐỐI CHIẾU
# =============================================================================
# ⚠️ Cặp G+H mới là thứ chứng minh phép kiểm CÓ HAI CHIỀU. Một phép kiểm chỉ có nhánh "đỏ" thì
#    không phân biệt được "kiểm đúng" với "luôn đỏ".
title H "Traefik khai ĐÚNG tên ⇒ xanh + nói rõ ĐÃ ĐỐI CHIẾU"
STUB_TRAEFIK_RESOLVER=le
run_case "H" "$WORK/cfg-le.yml"
expect_has "certresolver: le — ĐÃ ĐỐI CHIẾU"
expect_hasnt "BƯỚC 1 THẤT BẠI"
unset STUB_TRAEFIK_RESOLVER

# =============================================================================
printf '\n─────────────────────────────────────────────\n'
if [ "$FAILED" -eq 0 ]; then
  if [ -n "$ONLY" ]; then
    printf '\033[32m✅ BƯỚC 1 OK — %s khẳng định xanh (chỉ chạy ca: %s).\033[0m\n' "$PASSED" "$ONLY"
    printf '\033[33m   ⚠️ Đây là lượt chạy CÓ LỌC — KHÔNG phải bằng chứng cho cả 8 ca.\033[0m\n'
  else
    printf '\033[32m✅ BƯỚC 1 OK — %s khẳng định xanh (đủ 8 ca).\033[0m\n' "$PASSED"
  fi
  exit 0
fi
printf '\033[31m✗ %s khẳng định ĐỎ (trong %s).\033[0m\n' "$FAILED" "$((FAILED + PASSED))"
printf '   Xem đầu ra thật của ca hỏng:\n'
for f in "$WORK"/out.*.txt; do
  printf '\n── %s ──\n' "$(basename "$f")"
  sed 's/^/    /' "$f"
done
exit 1
