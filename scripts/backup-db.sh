#!/usr/bin/env bash
# =============================================================================
# RubyLingo — backup DB SQLite (T078). Chạy được CẢ khi gọi tay VÀ từ cron.
# =============================================================================
#
# ⭐ VÌ SAO KHÔNG `cp data/rubylingo.db backup.db`:
#   App đang chạy (và dùng chế độ WAL) ⇒ dữ liệu mới nhất có thể còn nằm trong `-wal`, CHƯA ghi
#   vào `.db`. `cp` tệp `.db` khi đó cho ra **bản sao THIẾU dữ liệu** — và nó KHÔNG báo lỗi gì.
#   Bạn chỉ phát hiện khi cần phục hồi, lúc đó đã quá muộn. Bản sao hỏng mà im lặng đúng là lớp
#   lỗi tệ nhất.
#
# ⭐ VÌ SAO DÙNG `db.backup()` CỦA `better-sqlite3` (chứ KHÔNG phải CLI `sqlite3`):
#   Image runtime là `node:20-bookworm-slim` + `npm ci --omit=dev` ⇒ **KHÔNG có CLI `sqlite3`**
#   (lệnh `sqlite3 … ".backup …"` sẽ chết với `sqlite3: not found` — cùng họ với `curl` ở
#   `deploy.sh`). Nhưng app ĐÃ có sẵn `better-sqlite3`, và nó phơi ra CHÍNH **SQLite Online Backup
#   API** — đúng cơ chế mà `.backup` của CLI dùng. Vậy ta không cần cài gì thêm, và vẫn an toàn
#   với DB đang mở.
#
# -----------------------------------------------------------------------------
# BỐN RÀNG BUỘC ĐƯỢC THI HÀNH TRONG CHÍNH SCRIPT (không chỉ ghi trong tài liệu)
# -----------------------------------------------------------------------------
#   1. **Bản sao ra NGOÀI volume** — mặc định `<repo>/backups/`, và script **TỪ CHỐI** chạy nếu
#      `BACKUP_DIR` nằm trong `<repo>/data` (volume của app). Để tài liệu nhắc thì sẽ có ngày bị
#      cấu hình sai; để script CHẶN thì không.
#   2. **Dùng Online Backup API**, không `cp` (xem trên).
#   3. **Kiểm bản sao NGAY** — `PRAGMA integrity_check` + `PRAGMA foreign_key_check` trên chính
#      tệp vừa tạo, TRƯỚC khi coi là thành công; hỏng ⇒ **thoát khác 0, ồn ào**.
#   4. **Giữ theo số ngày** (`RETENTION_DAYS`, mặc định 7) — xoá bản cũ hơn, in ra đã giữ gì.
#
# -----------------------------------------------------------------------------
# DÙNG
# -----------------------------------------------------------------------------
#   ./scripts/backup-db.sh                        # backup + kiểm + dọn bản cũ
#   RETENTION_DAYS=14 ./scripts/backup-db.sh      # giữ 14 ngày
#   BACKUP_DIR=~/rubylingo-backups ./scripts/backup-db.sh
#   DOCKER_BIN=/usr/bin/docker ./scripts/backup-db.sh   # cho cron (PATH tối giản)
#
# ⚠️⚠️ ĐÃ KIỂM Ở MÁY DEV vs CHỈ CHẠY ĐƯỢC TRÊN VPS (máy dev không có Docker):
#     • ĐÃ KIỂM ở máy dev: `bash -n` (cú pháp); **luật "bản sao phải ngoài volume"** (chạy với
#       `BACKUP_DIR` trỏ vào `./data` ⇒ phải bị TỪ CHỐI); logic giữ bản theo ngày (dựng tệp giả
#       rồi cho `find -mtime` xử lý); guard thiếu `docker`.
#     • CHỈ chạy được trên VPS: `docker compose exec/cp`, `db.backup()` thật, `integrity_check`.
#     Lần chạy thật ĐẦU TIÊN phải trên VPS, và **phải thử luôn một lần phục hồi** vào DB tạm —
#     một bản backup chưa từng được mở lại thì chưa được gọi là backup (xem `deploy/README.md`).
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SERVICE="${SERVICE:-rubylingo}"
DOCKER_BIN="${DOCKER_BIN:-docker}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"

# Tệp bản sao dựng TRONG container rồi `docker compose cp` ra ngoài — nhờ vậy KHÔNG cần mount
# thêm gì cho `./backups` (compose hiện chỉ mount `./data`).
CONTAINER_TMP="${CONTAINER_TMP:-/tmp/rubylingo-backup.db}"

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
ok()   { printf '\033[32m  ✓ %s\033[0m\n' "$1"; }
info() { printf '  %s\n' "$1"; }
warn() { printf '\033[33m  ⚠ %s\033[0m\n' "$1"; }

fail() {
  printf '\n\033[31m  ✗ %s\033[0m\n' "$1"
  printf '\033[31m    → Xem "QUY TRÌNH PHỤC HỒI" trong deploy/README.md.\033[0m\n\n'
  exit 1
}

# --- Tên tệp bản sao: ISO UTC, sắp theo tên = sắp theo thời gian ---------------------------
# ⚠️ Dùng UTC (`date -u`) để tên tệp không nhảy khi VPS đổi múi giờ/DST; nhưng giá trị ngày giờ
#    địa phương vẫn được in ra cho người đọc.
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST_FILE="${BACKUP_DIR}/rubylingo-${STAMP}.db"

# --- Tiền kiểm --------------------------------------------------------------------------
step "Tiền kiểm"
[ -f docker-compose.yml ] || fail "thiếu docker-compose.yml — chạy script từ gốc repo rubylingo/"

# ⚠️⚠️ RÀNG BUỘC 1 ĐƯỢC THI HÀNH Ở ĐÂY, VÀ CỐ Ý ĐẶT **TRƯỚC** BƯỚC KIỂM DOCKER:
#    bản sao KHÔNG được nằm trong volume của app. Mất/thay container hay volume ⇒ bản sao cũng mất
#    theo ⇒ backup vô nghĩa. Đặt trước bước kiểm docker để luật CẤU HÌNH được kiểm ngay và không
#    phụ thuộc môi trường (nhờ vậy nó kiểm được cả ở máy dev — xem khối "ĐÃ KIỂM Ở MÁY DEV" ở đầu).
case "${BACKUP_DIR%/}/" in
  "${REPO_ROOT}/data/"*)
    fail "BACKUP_DIR nằm TRONG volume của app (${BACKUP_DIR}) — bản sao phải ra NGOÀI (vd ./backups)"
    ;;
esac
mkdir -p "$BACKUP_DIR"
[ -w "$BACKUP_DIR" ] || fail "thư mục backup không ghi được: ${BACKUP_DIR}"
ok "thư mục backup (ngoài volume): ${BACKUP_DIR}"

command -v "$DOCKER_BIN" >/dev/null 2>&1 \
  || fail "không tìm thấy '${DOCKER_BIN}' (cron chỉ có PATH tối giản — xem deploy/backup-cron.example)"
ok "docker: $($DOCKER_BIN --version 2>/dev/null | head -n1)"

# --- Khoá chống chạy chồng (cron gọi đè lên lần trước) -------------------------------------
# ⚠️ `mkdir` là thao tác NGUYÊN TỬ trên mọi hệ tệp ⇒ dùng làm khoá, KHÔNG cần `flock`
#    (giữ script không phụ thuộc thêm gói, và chạy được cả khi gọi tay).
LOCK_DIR="${BACKUP_DIR}/.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  fail "một lần backup KHÁC đang chạy (khoá: ${LOCK_DIR}). Nếu chắc chắn không phải, xoá thư mục khoá rồi chạy lại."
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

# --- Kiểm app đang chạy (backup từ container ĐANG CHẠY mới đúng dữ liệu đang phục vụ) ------
step "Backup (Online Backup API trong container)"
if ! "$DOCKER_BIN" compose exec -T "$SERVICE" true >/dev/null 2>&1; then
  fail "service '${SERVICE}' KHÔNG chạy ⇒ không backup được (bật bằng: $DOCKER_BIN compose up -d)"
fi

# ⚠️ JS VIẾT TRONG NHÁY ĐƠN CỦA SHELL ⇒ bên trong KHÔNG được có dấu nháy đơn.
# ⚠️ Dùng `import()` động thay `require`: `node -e` có thể được coi là ESM (package.json có
#    `"type": "module"`) ⇒ `require` sẽ không tồn tại. `import()` chạy đúng ở CẢ HAI chế độ.
# ⚠️ Mở NGUỒN ở chế độ `readonly`: một bản backup KHÔNG BAO GIỜ được ghi vào DB đang chạy.
#    (Đọc DB ở WAL vẫn cần quyền ghi lên tệp `-shm`; trong container ta chạy bằng root nên có.)
BACKUP_JS='
(async () => {
  const mod = await import("better-sqlite3");
  const Database = mod.default;
  const src = process.env.DB_PATH;
  const dest = process.env.BACKUP_DEST;
  if (!src || !dest) { console.error("thiếu DB_PATH / BACKUP_DEST"); process.exit(2); }

  const db = new Database(src, { readonly: true });
  await db.backup(dest);
  db.close();

  const copy = new Database(dest, { readonly: true });
  const integrity = copy.pragma("integrity_check");
  const fk = copy.pragma("foreign_key_check");
  // ⚠️ Dùng THAM SỐ (`?`) chứ không viết chuỗi literal trong SQL: JS này nằm trong nháy đơn của
  //    shell nên KHÔNG thể chứa nháy đơn — mà SQL cần nháy đơn cho literal. Bind tham số vừa
  //    tránh vấn đề đó, vừa đúng thói quen chống SQL-injection.
  const tables = copy.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = ?").get("table");
  copy.close();

  const okIntegrity = Array.isArray(integrity) && integrity.length === 1 && integrity[0].integrity_check === "ok";
  if (!okIntegrity) { console.error("integrity_check KHÔNG ok: " + JSON.stringify(integrity)); process.exit(3); }
  if (Array.isArray(fk) && fk.length > 0) { console.error("foreign_key_check có vi phạm: " + JSON.stringify(fk)); process.exit(4); }
  console.log("BACKUP_OK tables=" + tables.n);
})().catch((e) => { console.error("backup lỗi: " + String(e)); process.exit(5); });
'

if ! BACKUP_OUT="$("$DOCKER_BIN" compose exec -T -e BACKUP_DEST="$CONTAINER_TMP" "$SERVICE" node -e "$BACKUP_JS" 2>&1)"; then
  warn "log từ container:"
  printf '%s\n' "$BACKUP_OUT" | sed 's/^/    /'
  fail "backup/kiểm tra TRONG container thất bại (bản sao KHÔNG được coi là thành công)"
fi
printf '%s\n' "$BACKUP_OUT" | sed 's/^/    /'
ok "bản sao trong container đã qua integrity_check + foreign_key_check"

# --- Ràng buộc 1 (tiếp): kéo bản sao RA NGOÀI container/volume ----------------------------
step "Đưa bản sao ra ngoài (host)"
"$DOCKER_BIN" compose cp "${SERVICE}:${CONTAINER_TMP}" "$DEST_FILE" >/dev/null

# ⚠️ Kiểm tệp TRÊN HOST: `docker compose cp` truyền qua tar stream ⇒ rủi ro thật là bị CỤT.
#    Không chạy lại integrity_check ở host vì VPS có thể KHÔNG có `sqlite3` lẫn `node`; thay vào
#    đó so KÍCH THƯỚC với tệp gốc TRONG container (bắt được cụt thiếu byte).
# ⚠️ Phải đo kích thước TRONG container tại `${CONTAINER_TMP}` — KHÔNG phải `$DEST_FILE` (đường
#    dẫn của HOST, không tồn tại trong container).
# ⚠️⚠️ KHÔNG được để phép kiểm này "tự bỏ qua khi không đo được": bản cũ dùng `|| true` rồi ở dưới
#    chỉ so KHI `IN_SIZE` khác rỗng ⇒ nếu `stat` thất bại thì phép so tệp-bị-cụt BỊ BỎ QUA mà script
#    vẫn in "khớp kích thước" và báo THÀNH CÔNG — tức mất đúng cái kiểm, lại còn nói dối là đã kiểm.
#    ⇒ Đo được mới được coi là thành công.
IN_SIZE="$("$DOCKER_BIN" compose exec -T "$SERVICE" stat -c%s "$CONTAINER_TMP" 2>/dev/null || true)"
[ -n "$IN_SIZE" ] \
  || fail "không đo được kích thước bản sao TRONG container (${CONTAINER_TMP}) ⇒ không kiểm được tệp bị cụt khi truyền"
"$DOCKER_BIN" compose exec -T "$SERVICE" rm -f "$CONTAINER_TMP" >/dev/null 2>&1 || true

HOST_SIZE="$(stat -c%s "$DEST_FILE" 2>/dev/null || true)"
[ -n "$HOST_SIZE" ] && [ "$HOST_SIZE" -gt 0 ] || fail "tệp backup trên host rỗng/không đọc được: ${DEST_FILE}"
if [ -n "$IN_SIZE" ] && [ "$HOST_SIZE" -ne "$IN_SIZE" ]; then
  fail "kích thước LỆCH: host=${HOST_SIZE} byte vs container=${IN_SIZE} byte ⇒ bản sao bị cụt khi truyền"
fi
ok "đã ghi: ${DEST_FILE} ($((HOST_SIZE / 1024)) KB, khớp kích thước trong container)"

# --- Ràng buộc 4: giữ theo số ngày --------------------------------------------------------
step "Dọn bản cũ (giữ ${RETENTION_DAYS} ngày)"
# ⚠️ Đường dẫn TUYỆT ĐỐI + `-maxdepth 1` + `-name '*.db'`: chạy đúng dù gọi từ cron với `cwd`
#    tuỳ ý, và KHÔNG (a) xoá nhầm thư mục con, (b) đụng vào `-wal/-shm`, (c) đụng thư mục khoá.
DELETED="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.db' -mtime "+${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')"
KEPT="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.db' | wc -l | tr -d ' ')"
info "đã xoá ${DELETED} bản cũ hơn ${RETENTION_DAYS} ngày"
info "đang giữ ${KEPT} bản"
find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.db' -printf '    %f  (%s bytes)\n' 2>/dev/null \
  | sort \
  | tail -n 5

printf '\n\033[32m✅ BACKUP THÀNH CÔNG — %s\033[0m\n' "$DEST_FILE"
printf '   ⚠️ Bản sao CHƯA được coi là "tốt" cho tới khi bạn THỬ PHỤC HỒI một lần.\n'
printf '      Quy trình từng bước: deploy/README.md → "QUY TRÌNH PHỤC HỒI".\n\n'
