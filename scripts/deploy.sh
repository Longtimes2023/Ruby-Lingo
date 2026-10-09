#!/usr/bin/env bash
# =============================================================================
# RubyLingo — deploy lên VPS (Docker Compose + Traefik) VÀ KIỂM CHO TỚI KHI THẬT SỰ CHẠY.
# =============================================================================
#
# ⭐⭐ VÌ SAO CẦN SCRIPT NÀY, KHÔNG CHỈ `docker compose up -d`:
#
#   Lần deploy đầu của Nhóm 12 đã lộ ra một nhóm lỗi cùng họ: **hỏng HOÀN TOÀN IM LẶNG**.
#   Container vẫn "khoẻ", `/api/health` vẫn 200, log không có ERROR — nhưng người dùng nhận 404,
#   403 hoặc 502. Vài ví dụ ĐÃ XẢY RA (xem `ARCHITECTURE.md`, mục Nhóm 12):
#     • S1 — `DB_PATH` giải theo `process.cwd()` ⇒ sai WORKDIR là DB ghi ra NGOÀI volume (mất khi
#            thay container) mà app vẫn chạy bình thường.
#     • S3 — `/api/health` trả `migrationsApplied: 0` cho DB CHƯA migrate (`countAppliedMigrations`
#            NUỐT lỗi rồi trả 0) ⇒ health "ok" trên schema RỖNG.
#     • B  — Traefik KHÔNG đọc healthcheck của Docker ⇒ nếu app crash-loop (`process.exit(1)` +
#            `restart: unless-stopped`) thì người dùng thấy **502 vĩnh viễn**.
#     • A  — thiếu `SUBDOMAIN`/`DOMAIN_NAME`: compose chỉ WARN rồi thay CHUỖI RỖNG ⇒ `Host(.)`
#            ⇒ 404, và `PUBLIC_ORIGIN=https://.` ⇒ mọi request GHI 403.
#   Vì vậy: deploy KHÔNG được kết thúc bằng "đã chạy `up -d`". Nó phải KẾT THÚC BẰNG BẰNG CHỨNG.
#
# -----------------------------------------------------------------------------
# NĂM BƯỚC KIỂM — DỪNG NGAY Ở BƯỚC CHƯA XANH
# -----------------------------------------------------------------------------
#   1. `docker compose config` — LỘ biến rỗng/thay thế sai (bắt A nếu ai gỡ `${VAR:?}`).
#   2. SỐ LƯỢNG migration TRONG IMAGE == số tệp nguồn (bắt S3/C).
#   3. `./data/rubylingo.db` CÓ THẬT TRÊN HOST (bắt S1 — chứng minh DB nằm ở volume).
#   4. Đọc `/api/health` TRONG container và SO `migrationsApplied` == số tệp (bắt S3).
#   5. POLL URL CÔNG KHAI tới khi HTTP 200, thử N lần (bắt B — biến crash-loop thành lỗi RÕ).
#
# ⚠️⚠️ ĐÃ KIỂM Ở MÁY DEV vs CHỈ CHẠY ĐƯỢC TRÊN VPS (máy dev KHÔNG có Docker):
#     • ĐÃ KIỂM ở máy dev: cú pháp (`bash -n`), logic đếm tệp migration, logic đọc `.env`,
#       các nhánh `fail()` không phụ thuộc Docker.
#     • CHỈ chạy được trên VPS: mọi lệnh `docker ...`, `curl` ra Internet, và 5 bước kiểm thật.
#       Lần chạy THẬT ĐẦU TIÊN phải là trên VPS, và phải đọc kỹ log của từng bước.
#
# -----------------------------------------------------------------------------
# DÙNG
# -----------------------------------------------------------------------------
#   ./scripts/deploy.sh                 # build + up + 5 bước kiểm (mặc định 12 lần thử, cách 5s)
#   POLL_ATTEMPTS=24 POLL_INTERVAL=5 ./scripts/deploy.sh
#   READY_ATTEMPTS=20 READY_INTERVAL=3 ./scripts/deploy.sh   # chờ app sẵn sàng (đầu bước 2)
#   SKIP_BUILD=1 ./scripts/deploy.sh    # dùng image đang có (không build lại)
#
# -----------------------------------------------------------------------------
# KHI SMOKE TEST ĐỎ — QUY TRÌNH PHỤC HỒI (đọc theo đúng SỐ BƯỚC bị đỏ)
# -----------------------------------------------------------------------------
#   • Bước 0 (tiền kiểm, trước bước 1): script chưa đọc được `.sql` nguồn, hoặc thiếu
#     `docker-compose.yml`/`docker`. Đây là lỗi MÔI TRƯỜNG chạy script, không phải lỗi app.
#   • Bước 1 đỏ (config): `.env` thiếu biến. Chạy `docker compose config` để xem lỗi cụ thể;
#     điền `SUBDOMAIN`/`DOMAIN_NAME`/`SESSION_SECRET` rồi chạy lại. ĐỪNG gỡ `${VAR:?}` trong
#     `docker-compose.yml` — chính nó là thứ biến lỗi im lặng thành lỗi ở đây.
#   • Bước 2 đỏ (số migration): image thiếu `.sql`. Kiểm Dockerfile còn dòng
#     `COPY --from=build /app/server/db/migrations ./dist-server/migrations` không.
#     Đây là lỗi NẶNG: app có thể chạy trên schema thiếu bảng.
#   • CỔNG CHỜ SẴN SÀNG đỏ (trong bước 2, thông báo "app KHÔNG sẵn sàng sau N lần thử"): đây là
#     bệnh KHÁC với "số migration" ở trên — app không KHỞI ĐỘNG được. 50 dòng log cuối đã in ngay
#     phía trên thông báo; nguyên nhân hay gặp: `runMigrations()` ném ⇒ `process.exit(1)` ⇒
#     crash-loop (`restart: unless-stopped`). ĐỪNG đi sửa số migration khi thấy mục này.
#   • Bước 3 đỏ (DB trên host): S1 đã tái phát. Kiểm `DB_PATH` trong compose còn TUYỆT ĐỐI
#     (`/app/data/rubylingo.db`) và `volumes` còn `./data:/app/data`.
#   • Bước 4 đỏ (migrationsApplied): `docker compose logs --tail=200 rubylingo`; nếu thấy
#     "Không thể chuẩn bị cơ sở dữ liệu" thì migration đã ném lúc khởi động.
#   • Bước 5 đỏ (URL công khai) — KIỂM THEO ĐÚNG THỨ TỰ NÀY:
#       1) CHỨNG CHỈ TRƯỚC TIÊN. `curl -vI https://<host>/` xem lỗi TLS, hoặc mở bằng trình duyệt.
#          Lỗi chứng chỉ ⇒ `TRAEFIK_CERTRESOLVER` trong `.env` SAI TÊN. Đây là nguyên nhân ĐẦU TIÊN
#          cần loại trừ vì nó KHÔNG để lại dấu vết nào trong log app — và vì thông báo đỏ ở dưới
#          ("Traefik không tới được app") sẽ khiến bạn đi kiểm cổng/mạng, tức SAI CHỖ.
#          Bước 1 đã in tên resolver ra; đối chiếu với `--certificatesresolvers.<TÊN>` của Traefik.
#       2) `docker compose ps` (container có chạy?), `docker compose logs --tail=200 rubylingo`.
#       3) Kiểm Traefik: `traefik.docker.network` phải là mạng CHUNG, và nhãn
#          `…services.rubylingo.loadbalancer.server.port=3000` phải còn (thiếu ⇒ 502).
#     ⚠️ ĐỪNG "sửa" bằng cách thêm `ports:` vào compose — cổng 3000 KHÔNG được lộ ra Internet.
#
#   Dừng khẩn: `docker compose down` (DỮ LIỆU VẪN AN TOÀN ở `./data/` trên host — miễn bước 3 xanh).
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

MIGRATIONS_DIR="server/db/migrations"
SERVICE="rubylingo"
POLL_ATTEMPTS="${POLL_ATTEMPTS:-12}"
POLL_INTERVAL="${POLL_INTERVAL:-5}"
# Chờ app SẴN SÀNG sau `up -d` (bước 2) — xem khối chống RACE ở dưới.
READY_ATTEMPTS="${READY_ATTEMPTS:-12}"
READY_INTERVAL="${READY_INTERVAL:-5}"

# --- Tiện ích in ấn ---------------------------------------------------------
step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
ok()   { printf '\033[32m  ✓ %s\033[0m\n' "$1"; }
warn() { printf '\033[33m  ⚠ %s\033[0m\n' "$1"; }

# `fail` in BƯỚC ĐANG ĐỎ + gợi ý phục hồi rồi THOÁT KHÁC 0. Không bao giờ "báo thành công" tiếp.
fail() {
  printf '\n\033[31m  ✗ BƯỚC %s THẤT BẠI: %s\033[0m\n' "$1" "$2"
  printf '\033[31m    → Đọc khối "KHI SMOKE TEST ĐỎ" ở đầu scripts/deploy.sh (mục tương ứng bước %s).\033[0m\n\n' "$1"
  exit 1
}

# Đọc một biến từ `.env` mà KHÔNG thực thi tệp (không `source`) — `.env` là dữ liệu, không phải mã.
# ⚠️ HIỆN KHÔNG CÒN NƠI GỌI (X1 đã chuyển sang suy từ `docker compose config` — xem bước 1).
#    GIỮ LẠI có chủ ý: đọc một giá trị trong `.env` mà KHÔNG qua compose vẫn là việc hợp lệ
#    (ví dụ kiểm một biến chỉ dùng lúc vận hành), và `env_val` xử đúng cả dòng comment lẫn
#    giá trị có/không dấu ngoặc. Nếu 3 tháng nữa vẫn không ai gọi thì xoá hẳn.
env_val() {
  local key="$1"
  [ -f .env ] || return 0
  sed -n "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*//p" .env \
    | tail -n 1 \
    | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

# Trích giá trị của MỘT nhãn Traefik trong `$COMPOSE_CONFIG` (đọc từ stdin, in ra stdout).
# Không thấy nhãn ⇒ in ra CHUỖI RỖNG (KHÔNG thoát, KHÔNG mã lỗi) để nơi gọi tự quyết định.
#
# ⚠️⚠️ VÌ SAO KHÔNG VIẾT THẲNG `VAR="$(… | grep -oE 'tls\.certresolver=…' | head -n1 | cut -d= -f2)"`
#    (bẫy này ĐÃ TRẢ GIÁ thật, 2026-10-09 — người dùng chạy deploy trên VPS và script "dừng giữa
#    chừng, không báo gì" ngay sau dòng `✓ cấu hình hợp lệ, URL công khai sẽ kiểm: …`):
#    1) `docker compose config` **CHUẨN HOÁ `labels`**: dạng danh sách trong `docker-compose.yml`
#       (`- "k=v"`) được in ra thành dạng MAP (`k: v`). Đầu ra THẬT dùng dấu `:`, KHÔNG phải `=`.
#       Bám vào `=` ⇒ grep KHÔNG khớp — dù nhãn CÓ trong tệp và CÓ trong đầu ra.
#    2) grep không khớp ⇒ CẢ pipeline trả 1. Dưới `set -o pipefail` + `set -e`, một phép GÁN
#       `VAR="$(pipeline)"` bị coi là lệnh thất bại ⇒ **script thoát NGAY TẠI DÒNG ĐÓ, IM LẶNG**,
#       và dòng `[ -n "$VAR" ] || fail …` ngay dưới trở thành **MÃ CHẾT**. Người dùng chỉ thấy
#       script dừng giữa chừng — đúng cái bẫy mà khối comment ở BƯỚC 1 (dòng ~144) đã cảnh báo.
#    3) `head -n1` có thể làm nhánh trước chết vì SIGPIPE (141) ⇒ pipefail lại lan tiếp ra ngoài.
#    ⇒ Ba chốt: nhận CẢ `:` lẫn `=`, cắt nháy bao ngoài, và `|| true` NGAY TRONG lệnh thay thế.
label_val() {
  printf '%s\n' "$COMPOSE_CONFIG" \
    | grep -oE "$1[[:space:]]*[:=][[:space:]]*[^[:space:]]+" \
    | head -n1 \
    | sed -E "s/^$1[[:space:]]*[:=][[:space:]]*//; s/^\"//; s/\"\$//; s/^'//; s/'\$//" \
    || true
}

command -v docker >/dev/null 2>&1 || fail "0" "không tìm thấy lệnh 'docker' (script này phải chạy TRÊN VPS)"

for f in Dockerfile docker-compose.yml; do
  [ -f "$f" ] || fail "0" "thiếu $f — hãy chạy script từ gốc repo rubylingo/"
done

# =============================================================================
# Số migration KỲ VỌNG — ĐẾM TỪ ĐĨA, KHÔNG hardcode.
# =============================================================================
# ⚠️ Hardcode "10" sẽ làm script đỏ oan ngay khi thêm migration 011, và đó là cách chắc chắn
#    nhất để người ta "sửa" bằng cách nới con số rồi bỏ luôn bước kiểm.
EXPECTED_MIGRATIONS="$(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' -type f | wc -l | tr -d ' ')"
[ "$EXPECTED_MIGRATIONS" -gt 0 ] \
  || fail "0" "không tìm thấy tệp .sql nào trong $MIGRATIONS_DIR (đếm được 0)"
step "Số migration nguồn (${MIGRATIONS_DIR}): ${EXPECTED_MIGRATIONS}"
ok "đếm từ đĩa, không hardcode"

# =============================================================================
# BƯỚC 1 — `docker compose config`: LỘ biến rỗng / thay thế sai
# =============================================================================
step "BƯỚC 1/5 — docker compose config (bắt biến rỗng)"
if ! COMPOSE_CONFIG="$(docker compose config 2>&1)"; then
  printf '%s\n' "$COMPOSE_CONFIG" | tail -n 20
  fail "1" "'docker compose config' thất bại (thường là thiếu biến trong .env)"
fi

# ⚠️ Đây là phần "LỘ": `${VAR:?}` trong compose khiến biến THIẾU làm `config` đỏ. Nhưng nếu ai đó
#    gỡ `:?` đi thì compose chỉ WARN rồi thay CHUỖI RỖNG — và `config` vẫn XANH. Nên phải soi
#    trực tiếp giá trị ĐÃ THAY THẾ: `Host(.)` và `PUBLIC_ORIGIN: https://.` là hai dấu hiệu đó.
# ⚠️ Dùng `if … then fail … fi` chứ KHÔNG dùng `grep … && fail …`: dưới `set -e`, một AND-list
#    có vế trái thất bại là **cái bẫy kinh điển** — hành vi khác nhau giữa các shell, và nếu nó
#    làm script thoát thì script thoát vì "grep không khớp" (tức là cấu hình ĐÚNG) — đảo ngược
#    hoàn toàn ý nghĩa của bước kiểm.
if printf '%s\n' "$COMPOSE_CONFIG" | grep -q 'Host(\.)'; then
  fail "1" "nhãn Traefik thành 'Host(.)' ⇒ SUBDOMAIN/DOMAIN_NAME RỖNG (Traefik sẽ trả 404)"
fi
if printf '%s\n' "$COMPOSE_CONFIG" | grep -qE 'PUBLIC_ORIGIN:[[:space:]]*https://\.[[:space:]]*$'; then
  fail "1" "PUBLIC_ORIGIN thành 'https://.' ⇒ MỌI request GHI sẽ 403"
fi
if printf '%s\n' "$COMPOSE_CONFIG" | grep -qE 'SESSION_SECRET:[[:space:]]*$'; then
  fail "1" "SESSION_SECRET RỖNG ⇒ phiên có thể bị giả mạo"
fi

# ⚠️⚠️ X1 — SUY URL TỪ CHÍNH `docker compose config`, KHÔNG tự parse `.env` (QA tìm ra):
#    compose nội suy `${SUBDOMAIN}` từ `.env` **+ biến môi trường của shell**. Nếu ai đó `export
#    SUBDOMAIN=…` ở shell (không để trong `.env`) thì compose deploy ĐÚNG mà `env_val` trả RỖNG
#    ⇒ script `fail "1"` ĐỎ OAN; hoặc nếu hai nguồn lệch nhau thì bước 5 sẽ POLL SAI URL.
#    Lấy từ `config` là lấy đúng giá trị mà compose THẬT SỰ dùng — một nguồn, không thể lệch.
# ⚠️ `|| true` ở cuối là BẮT BUỘC, không phải cho đẹp: không khớp `Host(...)` ⇒ grep trả 1 ⇒
#    `pipefail` + `set -e` giết script NGAY TẠI DÒNG NÀY và `fail` ở dòng dưới thành mã chết.
#    (Cùng họ bẫy với `label_val` ở trên — xem khối giải thích dài tại đó.)
PUBLIC_HOST="$(printf '%s\n' "$COMPOSE_CONFIG" | grep -oE 'Host\([^)]+\)' | head -n1 | sed -E 's/^Host\(//; s/\)$//' | tr -d '\140' || true)"
if [ -z "$PUBLIC_HOST" ] || [ "$PUBLIC_HOST" = "." ]; then
  fail "1" "không suy được 'Host(...)' từ 'docker compose config' (xem lại nhãn Traefik)"
fi
PUBLIC_URL="https://${PUBLIC_HOST}"
ok "cấu hình hợp lệ, URL công khai sẽ kiểm: ${PUBLIC_URL}"

# ⚠️⚠️ `certresolver` — BIẾN DUY NHẤT CỦA TỆP NÀY PHỤ THUỘC TRAEFIK CỦA NGƯỜI DÙNG.
#    Vì sao phải IN RA chứ không im lặng đi tiếp: một tên resolver SAI vẫn tạo ra router HỢP LỆ
#    (compose xanh, container chạy, health xanh). Traefik chỉ LẶNG LẼ không xin được chứng chỉ ⇒
#    HTTPS chết, mà router HTTP lại đá sang HTTPS ⇒ site coi như chết. Khi đó bước 5 đỏ với thông
#    báo "Traefik không tới được app" — CHỈ SAI CHỖ CẦN SỬA (người trực sẽ đi kiểm cổng 3000, mạng,
#    nhãn loadbalancer). In tên ra đây để nó ĐỐI CHIẾU ĐƯỢC với Traefik của mình ngay từ bước 1.
CERTRESOLVER="$(label_val 'tls\.certresolver')"
[ -n "$CERTRESOLVER" ] \
  || fail "1" "không đọc được 'tls.certresolver' từ 'docker compose config' — thiếu nhãn đó thì Traefik KHÔNG xin được chứng chỉ (HTTPS chết dù mọi thứ khác đều xanh). Xem dòng THẬT bằng tay: docker compose config | grep -i certresolver"
if [ "$CERTRESOLVER" = "mytlschallenge" ]; then
  warn "certresolver = '${CERTRESOLVER}' — đây là tên VÍ DỤ trong tài liệu Traefik, KHÔNG phải tên của bạn."
  printf '     Hãy CHẮC CHẮN nó khớp --certificatesresolvers.<TÊN> của Traefik trên VPS, nếu không\n'
  printf '     HTTPS sẽ KHÔNG có chứng chỉ (và vì router HTTP đá sang HTTPS nên site coi như chết).\n'
  # Dòng dưới dùng NHÁY KÉP cho chuỗi vì bản thân nó CHỨA nháy đơn — dễ đọc hơn nhiều so với
  # lối thoát '"'"' (đã kiểm: hai dạng in ra GIỐNG HỆT nhau từng ký tự). `\\\\n` để printf in ra
  # đúng hai ký tự `\` + `n` như người dùng cần gõ.
  printf "     Kiểm:  docker inspect traefik --format '{{json .Config.Cmd}}' | tr ',' '\\\\n' | grep -i certresolvers\n"
  printf '     Chi tiết: deploy/README.md §1.\n'
else
  ok "certresolver: ${CERTRESOLVER} (phải khớp Traefik của bạn — xem deploy/README.md §1)"
fi

# =============================================================================
# BUILD + UP
# =============================================================================
step "Build & khởi động"
if [ "${SKIP_BUILD:-0}" = "1" ]; then
  warn "SKIP_BUILD=1 ⇒ dùng image đang có"
  docker compose up -d
else
  docker compose up -d --build
fi
ok "đã gọi 'up -d' — BÂY GIỜ mới là phần kiểm chứng"

# =============================================================================
# BƯỚC 2 — CHỜ SẴN SÀNG, rồi mới khẳng định (chống RACE giữa `up -d` và app)
# =============================================================================
step "BƯỚC 2/5 — chờ app sẵn sàng, rồi kiểm số migration trong image"
#
# ⚠️⚠️ RACE — LỖI IM LẶNG CỦA CHÍNH SCRIPT NÀY (QA tìm ra):
#   `docker compose up -d` trả về NGAY khi container được TẠO, KHÔNG phải khi app sẵn sàng.
#   Sau đó app còn phải: nạp image → `runMigrations()` (áp ~10 migration) → mở cổng 3000.
#   Nếu ta khẳng định ngay ở bước 3 ("DB có trên host chưa?") hay bước 4 ("health trả lời chưa?")
#   thì deploy sẽ **ĐỎ OAN** — và deploy đỏ oan là loại cảnh báo dạy người ta bỏ qua cảnh báo thật.
#   Tệ hơn: nó biến "chờ thêm vài giây" thành "hỏng", nên lần sau người ta sẽ bỏ qua lỗi thật.
#   ⇒ CHỜ có giới hạn tới khi container TRẢ LỜI ĐƯỢC, rồi mới khẳng định.
#
# ⚠️ Vì sao chờ bằng health chứ không `sleep 10`: thời gian khởi động khác nhau theo máy và theo
#    số migration; một con số cố định hoặc quá ngắn (đỏ oan) hoặc quá dài (deploy chậm vô ích).
#    Poll có giới hạn cho kết quả ĐÚNG ở cả hai phía, và trần thời gian vẫn rõ ràng.
ready=0
attempt=1
while [ "$attempt" -le "$READY_ATTEMPTS" ]; do
  if docker compose exec -T "$SERVICE" node -e \
    "fetch('http://127.0.0.1:3000/api/health').then(()=>process.exit(0)).catch(()=>process.exit(1))" \
    >/dev/null 2>&1; then
    ready=1
    ok "app đã trả lời sau lần thử ${attempt}/${READY_ATTEMPTS}"
    break
  fi
  printf '  … chưa sẵn sàng (%s/%s)\n' "$attempt" "$READY_ATTEMPTS"
  if [ "$attempt" -lt "$READY_ATTEMPTS" ]; then
    sleep "$READY_INTERVAL"
  fi
  attempt=$((attempt + 1))
done
if [ "$ready" -ne 1 ]; then
  # In log app NGAY tại đây: nguyên nhân hay gặp nhất là `runMigrations()` ném ⇒ `process.exit(1)`
  # ⇒ `restart: unless-stopped` restart vô hạn (đúng lỗi B). Không in log thì người trực phải tự đi tìm.
  printf '\n  ── 50 dòng log cuối của %s ──\n' "$SERVICE"
  docker compose logs --tail=50 "$SERVICE" 2>&1 | sed 's/^/    /' || true
  fail "2" "app KHÔNG sẵn sàng sau ${READY_ATTEMPTS} lần thử (cách ${READY_INTERVAL}s) — xem log ở trên (migration ném? cổng 3000? crash-loop?)"
fi

# Số migration TRONG image == nguồn.
# `exec` chạy TRONG container đang chạy (không phải image trần) ⇒ kiểm đúng thứ app sẽ đọc.
IN_IMAGE="$(docker compose exec -T "$SERVICE" sh -c 'ls -1 dist-server/migrations/*.sql | wc -l' 2>/dev/null | tr -d '[:space:]' || true)"
[ -n "$IN_IMAGE" ] || fail "2" "không đọc được dist-server/migrations TRONG container (thư mục thiếu?)"
[ "$IN_IMAGE" -eq "$EXPECTED_MIGRATIONS" ] \
  || fail "2" "image có ${IN_IMAGE} tệp migration, nguồn có ${EXPECTED_MIGRATIONS} ⇒ app sẽ chạy trên schema THIẾU BẢNG"
ok "image có đủ ${IN_IMAGE}/${EXPECTED_MIGRATIONS} tệp migration"

# =============================================================================
# BƯỚC 3 — DB CÓ THẬT TRÊN HOST (chứng minh S1)
# =============================================================================
step "BƯỚC 3/5 — DB nằm ở VOLUME trên host"
# ⚠️ Đây là bằng chứng DUY NHẤT cho S1: nếu `DB_PATH`/`WORKDIR`/`volumes` lệch nhau, SQLite sẽ
#    ghi vào đường dẫn khác TRONG container, app vẫn chạy, và dữ liệu mất khi thay container.
if ! test -f ./data/rubylingo.db; then
  fail "3" "KHÔNG thấy ./data/rubylingo.db trên host ⇒ DB đang nằm NGOÀI volume (lỗi S1) hoặc app chưa migrate"
fi
ok "thấy ./data/rubylingo.db trên host ($(du -h ./data/rubylingo.db | cut -f1))"

# =============================================================================
# BƯỚC 4 — /api/health: ĐỌC và SO migrationsApplied
# =============================================================================
step "BƯỚC 4/5 — /api/health: migrationsApplied == số tệp migration"
# ⚠️ Gọi TRONG container vì service chỉ `expose` cổng 3000 (KHÔNG publish ra host — cố ý).
#    Dùng `node -e fetch` thay `curl`: image runtime là `bookworm-slim`, KHÔNG có curl/wget.
HEALTH_JSON="$(docker compose exec -T "$SERVICE" node -e \
  "fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(t=>process.stdout.write(t)).catch(e=>{process.stderr.write(String(e));process.exit(1)})" \
  2>/dev/null || true)"
[ -n "$HEALTH_JSON" ] || fail "4" "/api/health không trả lời trong container (app chưa nghe cổng 3000?)"
# ⚠️ `|| true` + nhận cả khoảng trắng quanh dấu `:` (JSON.stringify không thêm, nhưng đừng bám vào
#    chi tiết đó): không khớp ⇒ gán thất bại ⇒ `pipefail` + `set -e` giết script, và `fail` dưới
#    thành mã chết. `tr -dc '0-9'` gom đúng con số bất kể dấu cách/quan hệ.
APPLIED="$(printf '%s' "$HEALTH_JSON" | grep -oE '"migrationsApplied"[[:space:]]*:[[:space:]]*[0-9]+' | head -n1 | tr -dc '0-9' || true)"
[ -n "$APPLIED" ] || fail "4" "phản hồi /api/health không có 'migrationsApplied' — phản hồi: ${HEALTH_JSON}"
# ⚠️⚠️ PHÉP SO NÀY LÀ CẢ LÝ DO BƯỚC NÀY TỒN TẠI: `countAppliedMigrations()` NUỐT lỗi rồi trả 0,
#      nên một DB chưa migrate vẫn trả `status: "ok"`. Chỉ ĐỌC VÀ SO mới phát hiện được.
[ "$APPLIED" -eq "$EXPECTED_MIGRATIONS" ] \
  || fail "4" "migrationsApplied=${APPLIED} nhưng nguồn có ${EXPECTED_MIGRATIONS} ⇒ DB CHƯA migrate đủ (health vẫn 'ok'!)"
ok "migrationsApplied=${APPLIED} khớp nguồn"

# =============================================================================
# BƯỚC 5 — POLL URL CÔNG KHAI tới 200 (chứng minh Traefik + TLS thật sự tới được)
# =============================================================================
step "BƯỚC 5/5 — ${PUBLIC_URL}/api/health (thử tối đa ${POLL_ATTEMPTS} lần, cách ${POLL_INTERVAL}s)"
command -v curl >/dev/null 2>&1 || fail "5" "không có 'curl' trên host (cần để kiểm URL công khai)"
attempt=1
while [ "$attempt" -le "$POLL_ATTEMPTS" ]; do
  # ⚠️ X3 — KHÔNG nhận "bất kỳ 200": đọc luôn BODY và đòi `"status":"ok"`. Chỉ kiểm mã HTTP thì
  #    một trang khác trả 200 trên cùng Host vẫn lọt. Hình dạng THẬT của `/api/health`
  #    (`server/routes/health.ts`): `{ data: { status: "ok", version, uptimeSeconds, migrationsApplied } }`.
  resp="$(curl -s -w '\n%{http_code}' --max-time 10 "${PUBLIC_URL}/api/health" || true)"
  code="$(printf '%s' "$resp" | tail -n1)"
  body="$(printf '%s' "$resp" | sed '$d')"
  if [ "$code" = "200" ] && printf '%s' "$body" | grep -q '"status":"ok"'; then
    ok "lần thử ${attempt}/${POLL_ATTEMPTS}: HTTP 200 + body status=ok — Traefik + TLS + app đều thông"
    break
  fi
  printf '  … lần %s/%s: HTTP %s\n' "$attempt" "$POLL_ATTEMPTS" "${code:-<không kết nối>}"
  # Chỉ chờ khi CÒN lần thử — chờ sau lần cuối chỉ làm deploy chậm thêm mà vô nghĩa.
  if [ "$attempt" -lt "$POLL_ATTEMPTS" ]; then
    sleep "$POLL_INTERVAL"
  fi
  attempt=$((attempt + 1))
done
# ⚠️ Đây là chốt chặn cho lỗi B: Traefik KHÔNG đọc healthcheck Docker. Nếu app crash-loop thì
#    người dùng thấy 502 VĨNH VIỄN mà không ai biết. Poll ở đây biến nó thành deploy ĐỎ.
[ "$attempt" -le "$POLL_ATTEMPTS" ] \
  || fail "5" "URL công khai KHÔNG trả 200 + body status=ok sau ${POLL_ATTEMPTS} lần thử ⇒ Traefik không tới được app, hoặc app crash-loop, hoặc trả 200 từ nguồn KHÁC (không phải /api/health)"

# =============================================================================
printf '\n\033[32m✅ DEPLOY THÀNH CÔNG — 5/5 bước xanh.\033[0m\n'
printf '   URL: %s\n' "$PUBLIC_URL"
printf '   Bước tiếp: mở URL bằng TRÌNH DUYỆT THẬT để kiểm PWA/Speech (chỉ chạy trên HTTPS).\n'
printf '   Ghi chú: script KHÔNG kiểm đăng nhập/tạo bé/ghi dữ liệu — hãy tự chạy một lượt thật.\n\n'
