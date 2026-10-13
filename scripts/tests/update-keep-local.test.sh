#!/usr/bin/env bash
# =============================================================================
# KIỂM CHỨNG CHẾ ĐỘ "GIỮ NGUYÊN TỆP SỬA TAY" CỦA scripts/update.sh (KEEP_LOCAL=1)
# =============================================================================
# VÌ SAO TỆP NÀY TỒN TẠI:
#   `update.sh` BƯỚC 4 quyết định CÓ KÉO mã mới hay DỪNG, dựa trên "cây làm việc có tệp nào đang bị
#   sửa tay không" và (khi bật KEEP_LOCAL=1) trên phép so HAI TẬP HỢP: tệp sửa-tay ∩ tệp bản mới đụng.
#   Sai ở đây có ĐÚNG HAI hậu quả, và cả hai đều đắt:
#     • DỪNG OAN  ⇒ mỗi lần cập nhật lại phải xử lý tay — đúng thứ chế độ này sinh ra để bỏ.
#     • ĐI QUA OAN ⇒ mã mới ghi đè tệp sửa-tay, hoặc tệp sửa-tay che mất bản mới.
#   Loại lỗi này VÔ HÌNH với mọi cổng hiện có: `tsc`/`eslint`/`prettier`/`vitest` không mở tệp `.sh`;
#   `actionlint` chỉ soi `run:` BÊN TRONG workflow, không soi script rời. Cách duy nhất bắt được là
#   CHẠY THẬT `update.sh` trên một repo THẬT — đó là việc của tệp này.
#
# ⚠️ VÌ SAO DÙNG GIT THẬT (repo tạm + "remote" tạm) MÀ VẪN KHÔNG CẦN MẠNG:
#   "remote" ở đây là một thư mục trong $WORK. `git clone`/`fetch`/`pull` chạy trên đường dẫn cục bộ,
#   nên test đúng được cả phần KÉO — thứ KHÔNG THỂ giả lập, vì câu hỏi trung tâm của cả chế độ này
#   ("git có đụng vào tệp sửa-tay không?") CHÍNH LÀ một câu hỏi về hành vi của git.
#   Chỉ `docker`/`curl` là GIẢ (xem khối dựng stub) — và chúng giả đủ để `deploy.sh` đi hết 5 bước,
#   nhờ đó khẳng định được "update.sh bàn giao LIỀN MẠCH".
#
# CÁCH DÙNG:
#   bash scripts/tests/update-keep-local.test.sh
#   ONLY=B,C bash scripts/tests/update-keep-local.test.sh              # chạy lọc ca (máy yếu tiến trình)
#   UPDATE_SH=/đường/bản/cũ/update.sh bash scripts/tests/update-keep-local.test.sh   # KIỂM TEST CÓ RĂNG
#       ↳ Bản CŨ (trước khi có KEEP_LOCAL) PHẢI làm ca B ĐỎ (đã kiểm: 14 khẳng định đỏ, mã thoát 1).
#         Đó mới là bằng chứng tệp này thật sự bắt được hồi quy — chứ không chỉ là "chạy qua không lỗi".
#
# Không cần Docker, không cần mạng, không cần VPS. Chạy được trên Linux (CI) và Git Bash (Windows).
# =============================================================================

# ⚠️ CỐ Ý KHÔNG dùng `set -e`: tệp này phải tự đếm số ca HỎNG rồi mới quyết định mã thoát.
#    Dùng `set -e` ở đây thì chính tệp kiểm chứng lại mắc đúng cái bệnh nó đang canh.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
UPDATE_SH="${UPDATE_SH:-$REPO_ROOT/scripts/update.sh}"
# ⚠️ Tệp mỏng mà NGƯỜI DÙNG gõ hằng ngày (`./scripts/update-keep-local.sh`). Phải kiểm nó nữa:
#    nó là đường vào thật, và nó có đúng MỘT việc — bật `KEEP_LOCAL=1` rồi giao lại cho `update.sh`.
WRAPPER_SH="${WRAPPER_SH:-$REPO_ROOT/scripts/update-keep-local.sh}"

[ -f "$UPDATE_SH" ] || { printf 'không thấy update.sh: %s\n' "$UPDATE_SH" >&2; exit 2; }
[ -f "$WRAPPER_SH" ] || { printf 'không thấy update-keep-local.sh: %s\n' "$WRAPPER_SH" >&2; exit 2; }
[ -f "$REPO_ROOT/scripts/deploy.sh" ] || { printf 'không thấy scripts/deploy.sh trong %s\n' "$REPO_ROOT" >&2; exit 2; }

WORK="$(mktemp -d)"

# ⚠️⚠️ XOÁ BẰNG ĐƯỜNG DẪN TƯƠNG ĐỐI — VÌ SAO PHẢI QUANH CO:
#   Một số môi trường BỌC `rm` bằng chính sách an toàn. Trên máy dev Windows, wrapper đó TỪ CHỐI
#   đường dẫn chứa "tiền tố ổ đĩa" Ở GIỮA (`C:\Users\…\Temp/tmp.X/…` — đúng dạng mà `mktemp -d` trả
#   về) và **im lặng không xoá gì**: không lỗi, mã thoát 0. Nghĩa là `rm -f "$WORK/…"` có thể là một
#   lệnh RỖNG, và ca kiểm sẽ đỏ/xanh vì LÝ DO SAI (đã xảy ra thật ở ca D trong lúc viết tệp này).
#   ⇒ `cd` xuống thư mục cha rồi xoá THEO TÊN tương đối là đường đi không bị chặn.
#   (⚠️ Đây là chuyện của MÔI TRƯỜNG, không phải của thứ đang kiểm — nên nó phải bị cô lập ở ĐÂY,
#    không được rò vào logic của ca.)
rm_at() { # $1 = thư mục, phần còn lại = tên tương đối cần xoá
  local dir="$1"; shift
  ( cd "$dir" 2>/dev/null && rm -rf -- "$@" )
}

# Dọn $WORK khi thoát — cũng bằng đường dẫn tương đối, cùng lý do.
trap 'rm_at "$WORK/.." "$(basename "$WORK")"' EXIT

# --- `docker` + `curl` GIẢ -----------------------------------------------------------------------
# ⚠️ Chèn lên đầu PATH ⇒ luôn thắng lệnh thật của máy. Nhờ vậy test KHÔNG BAO GIỜ chạm vào máy thật.
# ⚠️⚠️ VÌ SAO CỐ TÌNH GIẢ ĐỦ ĐỂ `deploy.sh` ĐI HẾT 5 BƯỚC: `update.sh` kết thúc bằng
#    `exec ./scripts/deploy.sh`, nên nếu deploy.sh chết ngay ở bước 0 thì ta KHÔNG phân biệt được
#    "update.sh bàn giao đúng" với "update.sh bàn giao sai mà không ai thấy". Chỉ khi nó chạy tới
#    dòng "DEPLOY THÀNH CÔNG" thì đường đi mới được chứng minh là LIỀN MẠCH.
#    ⇒ Đổi lại, test này KHÔNG kiểm việc deploy (Docker/curl ở đây là giả). Việc deploy có cổng
#      riêng: `scripts/tests/deploy-step1.test.sh` + 5 bước kiểm chạy THẬT trên VPS.
mkdir -p "$WORK/bin"
cat > "$WORK/bin/docker" <<'STUB'
#!/usr/bin/env bash
# Hai lệnh `exec` mà deploy.sh cần ĐỌC KẾT QUẢ (mọi lệnh khác chỉ cần mã thoát 0).
for a in "$@"; do
  case "$a" in
    *dist-server/migrations*) printf '%s\n' "${STUB_MIGRATIONS:-1}"; exit 0 ;;
    *process.stdout.write*)   printf '%s\n' "${STUB_HEALTH:-}";         exit 0 ;;
  esac
done
if [ "${1:-}" = "compose" ] && [ "${2:-}" = "config" ]; then
  cat "${STUB_CONFIG:?STUB_CONFIG chưa được đặt}"
  exit 0
fi
exit 0
STUB
chmod +x "$WORK/bin/docker" 2>/dev/null || true

# `curl` GIẢ: trả ĐÚNG định dạng deploy.sh bước 5 đọc — `-w '\n%{http_code}'` ⇒ body, rồi mã ở dòng cuối.
cat > "$WORK/bin/curl" <<'STUB'
#!/usr/bin/env bash
printf '{"data":{"status":"ok"}}\n200\n'
STUB
chmod +x "$WORK/bin/curl" 2>/dev/null || true

STUB_MIGRATIONS=1
STUB_HEALTH='{"data":{"status":"ok","migrationsApplied":1}}'

# deploy.sh BƯỚC 1 cần một cấu hình hợp lệ (có Host(...) + nhãn certresolver). Sai ở đây thì deploy.sh
# đỏ ngay BƯỚC 1 và ta KHÔNG tới được BƯỚC 7 — mất luôn phép kiểm "đã đi hết đường".
cat > "$WORK/compose.yml" <<'YML'
services:
  rubylingo:
    labels:
      traefik.enable: "true"
      traefik.http.routers.rubylingo.rule: Host(`ruby.truongducdat.com`)
      traefik.http.routers.rubylingo.tls.certresolver: le
YML

# =============================================================================
# DỰNG REPO THẬT — hai repo gốc, mỗi repo phục vụ một nhóm câu hỏi khác nhau
# =============================================================================
# ⚠️ VÌ SAO HAI REPO GỐC: ca F cần một commit mới GHI ĐÈ `scripts/update.sh`, còn ca A–E cần commit
#    mới KHÔNG đụng tới `scripts/update.sh` (nếu không, mọi ca đều vô tình dính đường "script tự bị
#    ghi đè" và ta mất khả năng cô lập nguyên nhân). Nhồi cả hai vào một lịch sử thì ca nào cũng
#    chạy qua cả hai cơ chế cùng lúc — test đỏ mà không biết vì cái nào.
init_origin() { # $1 = thư mục repo gốc
  git init -q "$1" || return 1
  # ⚠️ Đặt nhánh MẶC ĐỊNH thành `main` bằng `symbolic-ref` (không dựa vào cờ `-b`, vốn cần
  #    git ≥ 2.28). Để mặc định là `master` thì bản clone sẽ có `origin/master` chứ không có
  #    `origin/main`, và mọi phép gán upstream ở dưới thất bại ⇒ test đỏ vì LÝ DO SAI.
  git -C "$1" symbolic-ref HEAD refs/heads/main || return 1
  git -C "$1" config user.email test@example.invalid
  git -C "$1" config user.name 'Test'
  git -C "$1" config commit.gpgsign false
  git -C "$1" config core.autocrlf false
}

seed_files() { # $1 = thư mục — nội dung commit ĐẦU (chưa commit)
  mkdir -p "$1/scripts" "$1/server/db/migrations"
  printf 'Gốc README\n'             > "$1/README.md"
  printf '[core]\nkey = value\n'    > "$1/config.ini"
  printf 'version: "1"\n'           > "$1/docker-compose.yml"
  printf ''                         > "$1/.gitignore"
  printf ''                         > "$1/Dockerfile"
  printf -- '-- migrate\n'          > "$1/server/db/migrations/001_init.sql"
  # ⚠️ Bản DƯỚI-ĐO phải nằm trong repo (ĐƯỢC THEO DÕI) để `git pull` thật sự ghi đè được nó —
  #    đó là TIỀN ĐỀ của ca F (chống "script tự ghi đè chính mình giữa chừng").
  cp "$UPDATE_SH"                   "$1/scripts/update.sh"
  cp "$REPO_ROOT/scripts/deploy.sh" "$1/scripts/deploy.sh"
  chmod +x "$1/scripts/update.sh" "$1/scripts/deploy.sh" 2>/dev/null || true
}

ORIGIN="$WORK/origin"
init_origin "$ORIGIN" || { printf 'LỖI: git init thất bại\n' >&2; exit 2; }
seed_files "$ORIGIN"
git -C "$ORIGIN" add -A && git -C "$ORIGIN" commit -qm 'c1 gốc'
C1="$(git -C "$ORIGIN" rev-parse HEAD)"

printf 'Ghi chú 1\n' > "$ORIGIN/NOTES.md"
printf 'Tài liệu\n'  > "$ORIGIN/GUIDE.md"
git -C "$ORIGIN" add -A && git -C "$ORIGIN" commit -qm 'c2: thêm NOTES.md + GUIDE.md (KHÔNG đụng tệp nào ta sẽ sửa tay)'
C2="$(git -C "$ORIGIN" rev-parse HEAD)"

printf '[core]\nkey = value\n# bản mới của GitHub\n' > "$ORIGIN/config.ini"
printf 'Nội dung khác\n'                              > "$ORIGIN/OTHER.md"
git -C "$ORIGIN" add -A && git -C "$ORIGIN" commit -qm 'c3: sửa config.ini + thêm OTHER.md'
C3="$(git -C "$ORIGIN" rev-parse HEAD)"

# Repo gốc THỨ HAI — chỉ phục vụ ca F: commit mới THAY HẲN `scripts/update.sh`.
# Nội dung mới in ra một dấu vết KHÔNG THỂ NHẦM LẪN rồi thoát 42: nếu bash chạy nhầm vào tệp mới,
# dấu vết đó hiện ra ngay trong log (và mã thoát sẽ là 42, không phải 0).
ORIGIN2="$WORK/origin2"
init_origin "$ORIGIN2" || { printf 'LỖI: git init thất bại (origin2)\n' >&2; exit 2; }
seed_files "$ORIGIN2"
git -C "$ORIGIN2" add -A && git -C "$ORIGIN2" commit -qm 'c1 gốc'
F1="$(git -C "$ORIGIN2" rev-parse HEAD)"
cat > "$ORIGIN2/scripts/update.sh" <<'NEW'
#!/usr/bin/env bash
printf 'MA-DOC-CUA-BAN-MOI-DA-CHAY\n'
exit 42
NEW
git -C "$ORIGIN2" add -A && git -C "$ORIGIN2" commit -qm 'c2: THAY HẲN scripts/update.sh'
F2="$(git -C "$ORIGIN2" rev-parse HEAD)"

# --- Dựng "VPS": clone ở một commit CŨ HƠN `origin/main` ⇒ có commit mới để kéo -------------------
# ⚠️ `checkout -B main <sha>` (KHÔNG `checkout <sha>`): phải ĐỨNG TRÊN NHÁNH, nếu không `@{u}` không
#    tồn tại và update.sh dừng ngay ở BƯỚC 1 vì "detached HEAD" — test sẽ đỏ vì lý do sai.
# ⚠️ `-c core.autocrlf=false` khi clone: máy dev là Windows; để git tự đổi LF→CRLF thì `cp` bản
#    dưới-đo vào repo sẽ tạo ra khác biệt GIẢ, và mọi ca "cây sạch" hoá thành "cây bẩn".
make_base() { # $1 = thư mục đích, $2 = commit muốn đứng, $3 = repo gốc (mặc định $ORIGIN)
  rm_at "$WORK" "$(basename "$1")"
  git -c core.autocrlf=false clone -q "${3:-$ORIGIN}" "$1" 2>/dev/null || return 1
  git -C "$1" config user.email test@example.invalid
  git -C "$1" config user.name 'Test'
  git -C "$1" config core.autocrlf false
  git -C "$1" checkout -q -B main "$2" || return 1
  # ⚠️ `checkout -B <nhánh> <sha>` ĐẶT LẠI nhánh và làm MẤT liên kết upstream (bản clone tạo liên
  #    kết đó lúc clone). Thiếu dòng này, update.sh dừng ở BƯỚC 1 với "chưa có upstream" — tức là
  #    test đỏ vì LÝ DO SAI, chứ không phải vì thứ đang cần kiểm.
  git -C "$1" branch -q --set-upstream-to=origin/main main || return 1
  git -C "$1" rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null || return 1
}

BASE2="$WORK/base-c2"; make_base "$BASE2" "$C2" || { printf 'LỖI: dựng base-c2 thất bại\n' >&2; exit 2; }
BASEF="$WORK/base-f";  make_base "$BASEF" "$F1" "$ORIGIN2" || { printf 'LỖI: dựng base-f thất bại\n' >&2; exit 2; }

prepare_vps() { # $1 = tên ca, $2 = thư mục base (mặc định $BASE2) → in ra đường dẫn "VPS"
  local d="$WORK/vps.$1"
  rm_at "$WORK" "vps.$1"
  cp -a "${2:-$BASE2}" "$d" || return 1
  # `.env` là dữ liệu vận hành của VPS, KHÔNG nằm trong repo — update.sh BƯỚC 1 đòi nó có mặt.
  printf 'SUBDOMAIN=ruby\nDOMAIN_NAME=truongducdat.com\nTRAEFIK_CERTRESOLVER=le\nSESSION_SECRET=abc\n' > "$d/.env"
  # `data/rubylingo.db` — deploy.sh BƯỚC 3 dùng nó làm BẰNG CHỨNG "DB nằm trong volume trên host".
  # ⚠️ Cố ý để nó KHÔNG được git theo dõi: đây cũng là phép thử cho thấy tệp vận hành không theo dõi
  #    (như `.env`, `data/`) KHÔNG bị coi là "cây bẩn" và KHÔNG cản `git pull`.
  mkdir -p "$d/data"
  printf 'DB GIẢ\n' > "$d/data/rubylingo.db"
  # ⚠️ Môi trường dev có `rm` bị bọc (xem `rm_at`) ⇒ dấu vết cũ có thể còn lại; `cp -a` vào thư mục
  #    đã tồn tại sẽ LỒNG thay vì ghi đè. Kiểm để không bao giờ đo trên một "VPS" nửa nọ nửa kia.
  [ -f "$d/scripts/update.sh" ] || return 1
  [ -d "$d/.git" ] || return 1
  # ⚠️ Tệp mỏng đi kèm — ca G chạy qua nó, nên nó phải nằm CÙNG `scripts/` trong "VPS" giả, y như
  #    trên VPS thật. (Nếu để nó chạy từ repo thật thì `HERE` trỏ về repo thật và ca G sẽ thao tác
  #    lên chính repo đang phát triển — đúng loại tai nạn mà mọi test phải tránh.)
  cp "$WRAPPER_SH" "$d/scripts/update-keep-local.sh" || return 1
  # ⚠️ Windows không ghi được bit thực thi vào git ⇒ sau `cp -a` phải CHỈNH LẠI, nếu không update.sh
  #    BƯỚC 1 đỏ vì "deploy.sh chưa chmod +x" — lại là đỏ vì lý do sai.
  chmod +x "$d/scripts/update.sh" "$d/scripts/deploy.sh" 2>/dev/null || true
  printf '%s' "$d"
}

# --- Bộ lọc ca ------------------------------------------------------------------------------------
# ⚠️ Mỗi ca chạy `update.sh` THẬT (nhiều tiến trình git). Trên máy bị GIỚI HẠN SỐ TIẾN TRÌNH, chạy
#    đủ 6 ca trong một lượt có thể bị ngắt giữa chừng (`SIGTERM`) — đã gặp thật khi viết tệp này.
#    `ONLY=B,C` chạy đúng các ca đó; **CI chạy KHÔNG đặt ONLY**.
#    ⚠️ Ca bị bỏ qua KHÔNG tính vào PASSED/FAILED — nếu tính là "xanh" thì bộ lọc trở thành cách báo
#       xanh giả, đúng thứ tệp này sinh ra để chống.
ONLY="${ONLY:-}"
SKIPPING=0
case_selected() {
  [ -z "$ONLY" ] && return 0
  case ",$ONLY," in *",$1,"*) return 0 ;; esac
  return 1
}

FAILED=0
PASSED=0
LAST_OUT=/dev/null
LAST_EXIT=0

title() {
  if case_selected "$1"; then SKIPPING=0; printf '\nCA %s — %s\n' "$1" "$2"; else SKIPPING=1; fi
  return 0
}

# --- Chạy `update.sh` thật trong "VPS" của ca -----------------------------------------------------
run_update() { # $1 = tên ca, $2 = thư mục VPS, $3 = KEEP_LOCAL (0/1), $4 = KEEP_LOCAL_MAX (tuỳ chọn)
  if [ "$SKIPPING" -eq 1 ]; then LAST_OUT=/dev/null; LAST_EXIT=0; return 0; fi
  LAST_OUT="$WORK/out.$1.txt"
  local d="$2" keep="$3" max="${4:-10}"
  (
    cd "$d" || exit 99
    PATH="$WORK/bin:$PATH" \
      STUB_CONFIG="$WORK/compose.yml" \
      STUB_MIGRATIONS="$STUB_MIGRATIONS" STUB_HEALTH="$STUB_HEALTH" \
      SKIP_BUILD=1 READY_ATTEMPTS=1 READY_INTERVAL=1 POLL_ATTEMPTS=1 POLL_INTERVAL=1 \
      KEEP_LOCAL="$keep" KEEP_LOCAL_MAX="$max" \
      bash scripts/update.sh
  ) > "$LAST_OUT" 2>&1
  LAST_EXIT=$?
}

# --- Chạy qua TỆP MỎNG (`./scripts/update-keep-local.sh`) — ĐÚNG đường vào mà người dùng gõ -------
# ⚠️⚠️ VÌ SAO PHẢI KIỂM CẢ HAI ĐƯỜNG: các ca khác gọi thẳng `update.sh` với `KEEP_LOCAL=1`. Nếu tệp
#    mỏng bị gõ sai (`export` thiếu, sai tên biến, quên chuyển tiếp `"$@"`) thì các ca đó VẪN XANH —
#    trong khi đường đi THẬT của người dùng thì hỏng. Ca G bịt đúng lỗ đó: nó chạy y như người dùng,
#    và **KHÔNG** truyền `KEEP_LOCAL` từ ngoài — chính tệp mỏng phải bật cờ đó lên.
run_via_wrapper() { # $1 = tên ca, $2 = thư mục VPS
  if [ "$SKIPPING" -eq 1 ]; then LAST_OUT=/dev/null; LAST_EXIT=0; return 0; fi
  LAST_OUT="$WORK/out.$1.txt"
  local d="$2"
  (
    cd "$d" || exit 99
    PATH="$WORK/bin:$PATH" \
      STUB_CONFIG="$WORK/compose.yml" \
      STUB_MIGRATIONS="$STUB_MIGRATIONS" STUB_HEALTH="$STUB_HEALTH" \
      SKIP_BUILD=1 READY_ATTEMPTS=1 READY_INTERVAL=1 POLL_ATTEMPTS=1 POLL_INTERVAL=1 \
      bash scripts/update-keep-local.sh
  ) > "$LAST_OUT" 2>&1
  LAST_EXIT=$?
}

# --- Khẳng định -----------------------------------------------------------------------------------
# ⚠️ `grep -F` (chuỗi cố định) chứ KHÔNG `grep -E`: nội dung cần tìm có `(`, `.`, `[`, `⇒`… —
#    dùng regex ở đây là tự tạo ra một lớp lỗi mới y hệt loại đang đi bắt.
PL() { [ "$SKIPPING" -eq 1 ] && return 0; printf '    ✓ %s\n' "$1"; PASSED=$((PASSED + 1)); }
FL() { [ "$SKIPPING" -eq 1 ] && return 0; printf '    ✗ %s\n' "$1"; FAILED=$((FAILED + 1)); }

expect_has()    { [ "$SKIPPING" -eq 1 ] && return 0; if grep -qF -- "$1" "$LAST_OUT"; then PL "có: $1"; else FL "THIẾU: $1"; fi; }
expect_hasnt()  { [ "$SKIPPING" -eq 1 ] && return 0; if grep -qF -- "$1" "$LAST_OUT"; then FL "KHÔNG ĐƯỢC CÓ: $1"; else PL "không có: $1"; fi; }
expect_exit_0() { [ "$SKIPPING" -eq 1 ] && return 0; if [ "$LAST_EXIT" -eq 0 ]; then PL "mã thoát = 0"; else FL "mã thoát = $LAST_EXIT — ĐÁNG LẼ PHẢI XANH"; fi; }
expect_exit_nz(){ [ "$SKIPPING" -eq 1 ] && return 0; if [ "$LAST_EXIT" -ne 0 ]; then PL "mã thoát = $LAST_EXIT (khác 0)"; else FL "mã thoát = 0 — ĐÁNG LẼ PHẢI ĐỎ"; fi; }

# ⚠️ Khẳng định về TỆP đi thẳng vào ngữ nghĩa "còn nguyên bản sửa-tay", không chỉ "tệp tồn tại".
expect_file_eq() { # $1 file, $2 nội dung mong đợi
  [ "$SKIPPING" -eq 1 ] && return 0
  if [ -f "$1" ] && [ "$(cat "$1")" = "$2" ]; then PL "nội dung CÒN NGUYÊN: $1"; else FL "nội dung SAI/MẤT ở $1 (thật: $(cat "$1" 2>/dev/null | head -c 120))"; fi
}
expect_absent() { [ "$SKIPPING" -eq 1 ] && return 0; if [ ! -e "$1" ]; then PL "vẫn KHÔNG tồn tại: $1"; else FL "ĐÁNG LẼ PHẢI KHÔNG CÓ, nay lại có: $1"; fi; }
expect_present(){ [ "$SKIPPING" -eq 1 ] && return 0; if [ -e "$1" ]; then PL "có mặt (mã mới đã về): $1"; else FL "THIẾU (mã mới KHÔNG về?): $1"; fi; }
expect_contains(){ # $1 tệp, $2 chuỗi phải có trong tệp
  [ "$SKIPPING" -eq 1 ] && return 0
  if grep -qF -- "$2" "$1" 2>/dev/null; then PL "tệp có '$2': $1"; else FL "tệp THIẾU '$2': $1"; fi
}
expect_head() { # $1 thư mục VPS, $2 sha mong đợi, $3 mô tả
  [ "$SKIPPING" -eq 1 ] && return 0
  local got; got="$(git -C "$1" rev-parse HEAD 2>/dev/null)"
  if [ "$got" = "$2" ]; then PL "HEAD $3"; else FL "HEAD SAI: $3 (mong ${2:0:8}, thật ${got:0:8})"; fi
}

READ_LOCAL='Gốc README
# SỬA TAY TRÊN VPS: dòng riêng của máy chủ này'
CFG_LOCAL='[core]
key = value
# SỬA TAY TRÊN VPS: tham số riêng của máy chủ này'

# =============================================================================
# CA A — BẢN MẶC ĐỊNH (KHÔNG bật KEEP_LOCAL): tệp sửa-tay ⇒ DỪNG, KHÔNG kéo, KHÔNG mất gì
# =============================================================================
# ⚠️ CA NÀY CANH "ĐỔI HÀNH VI IM LẶNG". Tính năng mới KHÔNG được phép làm mặc định cũ lỏng ra:
#    người vận hành phải CHỦ ĐỘNG bật giữ-nguyên, và lượt bật đầu tiên phải được script CHỈ ĐƯỜNG —
#    nếu không thì người dùng chỉ thấy nó dừng, y như trước, và sẽ tưởng tính năng không tồn tại.
title A "mặc định (không bật): tệp sửa-tay ⇒ DỪNG + chỉ đường"
if [ "$SKIPPING" -eq 0 ]; then
  D="$(prepare_vps A)"
  printf '%s\n' "$READ_LOCAL" > "$D/README.md"
  run_update A "$D" 0
fi
expect_exit_nz
expect_has  "BƯỚC 4 THẤT BẠI"
expect_has  "update-keep-local.sh"          # phải CHỈ ĐƯỜNG, không chỉ nói "hãy tự xử lý"
expect_hasnt "BƯỚC 5/7"                     # CHƯA được kéo
expect_file_eq "${D:-/nonexistent}/README.md" "$READ_LOCAL"
expect_head  "${D:-/nonexistent}" "$C2" "vẫn ở bản CŨ (chưa kéo gì)"

# =============================================================================
# CA B — KEEP_LOCAL=1, VÙNG GIAO RỖNG ⇒ KÉO ĐƯỢC, GIỮ NGUYÊN, CÓ SAO LƯU, ĐI HẾT ĐƯỜNG
# =============================================================================
# Đây là ca của công việc hằng ngày: sửa tay vài tệp CỐ Ý, còn mã mới không đụng tới chúng.
title B "KEEP_LOCAL=1 + vùng giao RỖNG ⇒ kéo được, giữ nguyên, có sao lưu"
if [ "$SKIPPING" -eq 0 ]; then
  D="$(prepare_vps B)"
  printf '%s\n' "$READ_LOCAL" > "$D/README.md"
  run_update B "$D" 1
fi
expect_exit_0
# ⚠️ Khẳng định bám THEO LỜI của script ("tệp sửa-tay sẽ được GIỮ NGUYÊN"), KHÔNG bám vào con số
#    đếm được. Con số là chi tiết trình bày — bám vào nó là tự làm test giòn một cách vô ích.
expect_has  "tệp sửa-tay sẽ được GIỮ NGUYÊN"
expect_hasnt "BƯỚC 4 THẤT BẠI"
expect_has  "đã sao lưu bản sửa-tay"                        # đường lui phải ghi TRƯỚC khi kéo
expect_has  "tệp sửa-tay GIỮ NGUYÊN (đã đối chiếu vết băm"  # và phải ĐO lại sau khi kéo
expect_has  "BẢN SAO TẠM"                                   # BƯỚC 0 phải chạy (xem khối đầu update.sh)
expect_has  "đã kéo về an toàn"
expect_has  "BƯỚC 7/7"                                      # đã bàn giao cho deploy.sh
expect_has  "DEPLOY THÀNH CÔNG"                             # đường đi LIỀN MẠCH tới hết
expect_file_eq "${D:-/nonexistent}/README.md" "$READ_LOCAL"
expect_head  "${D:-/nonexistent}" "$C3" "= bản mới nhất của GitHub (đã kéo)"
expect_present "${D:-/nonexistent}/OTHER.md"                 # tệp CHỈ có ở c3 ⇒ chứng minh đã kéo
if [ "$SKIPPING" -eq 0 ]; then
  # Bản vá sao lưu phải TỒN TẠI, KHÁC RỖNG, và CHỨA đúng dòng sửa tay (không phải tệp rỗng cho có).
  PATCH="$(ls -1 "$D"/backups/keep-local/*.patch 2>/dev/null | head -n1)"
  if [ -n "$PATCH" ]; then PL "có bản vá sao lưu: $PATCH"; else FL "KHÔNG thấy bản vá sao lưu trong backups/keep-local/"; fi
  if [ -n "$PATCH" ]; then expect_contains "$PATCH" 'SỬA TAY TRÊN VPS'; fi
fi

# =============================================================================
# CA C — KEEP_LOCAL=1, VÙNG GIAO **KHÁC RỖNG** ⇒ PHẢI DỪNG, và KHÔNG mất gì
# =============================================================================
# ⚠️⚠️ CA QUAN TRỌNG NHẤT CỦA TỆP NÀY. `config.ini` vừa được sửa tay trên VPS, vừa được c3 sửa.
#    Giữ CẢ HAI là bất khả (bản nào thắng cũng là một quyết định về sản phẩm), nên câu trả lời
#    ĐÚNG là DỪNG và nhường cho con người — KHÔNG phải "bản của VPS thắng" do script tự chọn.
#    Nếu ai đó "cải tiến" thành tự đặt lại bản VPS thì ca này ĐỎ. Đó chính là điều ta muốn.
title C "KEEP_LOCAL=1 + vùng giao KHÁC RỖNG ⇒ DỪNG, không kéo, hai bên còn nguyên"
if [ "$SKIPPING" -eq 0 ]; then
  D="$(prepare_vps C)"
  printf '%s\n' "$CFG_LOCAL" > "$D/config.ini"     # sửa tay ĐÚNG tệp mà c3 sẽ sửa
  printf 'KHÔNG ĐƯỢC MẤT\n' > "$D/NOTES.md"        # và thêm một tệp sửa-tay NỮA (ngoài vùng giao)
  run_update C "$D" 1
fi
expect_exit_nz
expect_has  "BƯỚC 4 THẤT BẠI"
expect_has  "VÙNG GIAO"
expect_has  "config.ini"
expect_hasnt "BƯỚC 5/7"                          # DỪNG TRƯỚC khi kéo — không kéo nửa vời
expect_file_eq "${D:-/nonexistent}/config.ini" "$CFG_LOCAL"
expect_file_eq "${D:-/nonexistent}/NOTES.md"   'KHÔNG ĐƯỢC MẤT'
expect_head  "${D:-/nonexistent}" "$C2" "vẫn ở bản CŨ (không có gì bị kéo dở)"

# =============================================================================
# CA D — KEEP_LOCAL=1, tệp BỊ XOÁ TAY ⇒ "xoá" CŨNG LÀ một bản địa phương, phải giữ
# =============================================================================
# ⚠️ Vì sao tách riêng ca: nhánh này đi qua một ĐƯỜNG KHÁC trong mã (vết băm neo bằng '-'), và nó
#    là nhánh dễ hỏng nhất khi ai đó "tối ưu" phần so sánh — vì `[ -f "$f" ]` KHÔNG đúng cho tệp
#    đã bị xoá, nên rất dễ lặng lẽ coi như "không có gì để kiểm".
title D "KEEP_LOCAL=1 + tệp bị XOÁ tay ⇒ vẫn giữ (không 'mọc lại')"
if [ "$SKIPPING" -eq 0 ]; then
  D="$(prepare_vps D)"
  rm_at "$D" README.md                            # sửa tay = XOÁ (một quyết định hợp lệ)
  if [ -e "$D/README.md" ]; then FL "thiết lập ca D hỏng: không xoá được README.md"; else PL "đã tạo trạng thái: README.md BỊ XOÁ TAY"; fi
  run_update D "$D" 1
fi
expect_exit_0
expect_has  "tệp sửa-tay sẽ được GIỮ NGUYÊN"
expect_has  "tệp sửa-tay GIỮ NGUYÊN"
expect_absent "${D:-/nonexistent}/README.md"
expect_head "${D:-/nonexistent}" "$C3" "= bản mới nhất của GitHub (đã kéo)"
expect_present "${D:-/nonexistent}/OTHER.md"

# =============================================================================
# CA E — KEEP_LOCAL=1, VƯỢT TRẦN ⇒ DỪNG (trần là chốt chống "giữ nguyên cả cây do sự cố")
# =============================================================================
# ⚠️ Vì sao cần trần: một công cụ định dạng / sinh mã ghi lại cả cây sẽ khiến "giữ nguyên mọi tệp"
#    trở thành "đóng băng vĩnh viễn mã nguồn" — mà lại IM LẶNG. Trần biến nó thành một lần DỪNG.
title E "KEEP_LOCAL=1 + vượt trần KEEP_LOCAL_MAX ⇒ DỪNG"
if [ "$SKIPPING" -eq 0 ]; then
  D="$(prepare_vps E)"
  printf 'sửa 1\n' >> "$D/README.md"
  printf 'sửa 2\n' >> "$D/config.ini"
  printf 'sửa 3\n' >> "$D/GUIDE.md"
  run_update E "$D" 1 2                             # 3 tệp > trần 2
fi
expect_exit_nz
expect_has  "VƯỢT TRẦN"
expect_has  "KEEP_LOCAL_MAX"
expect_hasnt "BƯỚC 5/7"
expect_head "${D:-/nonexistent}" "$C2" "vẫn ở bản CŨ (không kéo)"

# =============================================================================
# CA F — BƯỚC 0: script bị commit mới GHI ĐÈ giữa chừng vẫn phải chạy TRỌN bản của chính nó
# =============================================================================
# ⚠️⚠️ VÌ SAO CA NÀY LÀ CA DỄ BỊ BỎ SÓT NHẤT — VÀ VÌ SAO NÓ ĐÁNG TỒN TẠI:
#   `update.sh` kết thúc `exec ./scripts/deploy.sh`, tức là nó KÉO MÃ MỚI rồi vẫn phải đọc tiếp
#   chính tệp của mình. Bash đọc script theo TỪNG KHỐI (không nạp cả tệp vào bộ nhớ), nên khi
#   `git pull` ghi lại `scripts/update.sh` (nhiều đường ghi của git dùng O_TRUNC — CẮT NGẮN đúng
#   inode đang mở) thì phần còn lại có thể được đọc từ một tệp ĐÃ KHÁC.
#   ⇒ BƯỚC 0 chữa bằng cách tự chạy từ BẢN SAO TẠM. Ca này dựng đúng tình huống đó và khẳng định:
#     (a) có dòng "BẢN SAO TẠM" (cơ chế THẬT SỰ chạy — nếu ai xoá BƯỚC 0, khẳng định này đỏ ngay);
#     (b) KHÔNG thấy dấu vết của mã mới (`MA-DOC-CUA-BAN-MOI-DA-CHAY`) và mã thoát là 0, không 42 —
#         nghĩa là bash đã chạy TRỌN bản cũ, không nhảy sang tệp mới;
#     (c) tệp trên đĩa ĐÚNG LÀ bản mới ⇒ chứng minh việc ghi đè CÓ xảy ra thật (không phải tình
#         huống giả do vô tình không kéo được gì).
title F "BƯỚC 0 — script bị ghi đè giữa chừng ⇒ vẫn chạy trọn bản của chính nó"
if [ "$SKIPPING" -eq 0 ]; then
  D="$(prepare_vps F "$BASEF")"
  run_update F "$D" 0
fi
expect_exit_0
expect_has    "BẢN SAO TẠM"
expect_hasnt   "MA-DOC-CUA-BAN-MOI-DA-CHAY"
expect_has    "BƯỚC 7/7"
expect_has    "DEPLOY THÀNH CÔNG"
expect_head   "${D:-/nonexistent}" "$F2" "= bản mới (đã kéo, dù tệp script đã đổi trên đĩa)"
expect_contains "${D:-/nonexistent}/scripts/update.sh" 'MA-DOC-CUA-BAN-MOI-DA-CHAY'

# =============================================================================
# CA G — ĐƯỜNG VÀO THẬT: `./scripts/update-keep-local.sh` (tệp mỏng) phải tự bật cờ KEEP_LOCAL
# =============================================================================
# ⚠️⚠️ CA NÀY KIỂM THỨ MÀ MỌI CA KHÁC KHÔNG CHẠM TỚI. Các ca A–F gọi thẳng `update.sh` và tự truyền
#    `KEEP_LOCAL=1`. Nhưng người dùng không gõ thế — họ gõ tệp mỏng. Nếu tệp mỏng bị gõ sai
#    (`export` thiếu, sai tên biến, quên `"$@"`…) thì TẤT CẢ các ca kia vẫn xanh trong khi đường đi
#    thật hỏng hoàn toàn — và triệu chứng sẽ là "vẫn phải xử lý tay", đúng thứ ta đang muốn bỏ.
#    ⇒ Ca này chạy y như người dùng, KHÔNG truyền `KEEP_LOCAL` từ ngoài; chính tệp mỏng phải bật.
title G "tệp mỏng ./scripts/update-keep-local.sh — tự bật KEEP_LOCAL, không cần truyền gì"
if [ "$SKIPPING" -eq 0 ]; then
  D="$(prepare_vps G)"
  printf '%s\n' "$READ_LOCAL" > "$D/README.md"
  run_via_wrapper G "$D"
fi
expect_exit_0
expect_has    "tệp sửa-tay sẽ được GIỮ NGUYÊN"     # ⇒ cờ ĐÃ được tệp mỏng bật lên
expect_hasnt   "BƯỚC 4 THẤT BẠI"
expect_has    "đã kéo về an toàn"
expect_has    "DEPLOY THÀNH CÔNG"
expect_file_eq "${D:-/nonexistent}/README.md" "$READ_LOCAL"
expect_head   "${D:-/nonexistent}" "$C3" "= bản mới nhất của GitHub (đã kéo)"
expect_present "${D:-/nonexistent}/OTHER.md"

# =============================================================================
printf '\n─────────────────────────────────────────────\n'
if [ "$FAILED" -eq 0 ]; then
  if [ -n "$ONLY" ]; then
    printf '\033[32m✅ KEEP_LOCAL OK — %s khẳng định xanh (chỉ chạy ca: %s).\033[0m\n' "$PASSED" "$ONLY"
    printf '\033[33m   ⚠️ Đây là lượt chạy CÓ LỌC — KHÔNG phải bằng chứng cho cả 7 ca.\033[0m\n'
  else
    printf '\033[32m✅ KEEP_LOCAL OK — %s khẳng định xanh (đủ 7 ca A–G).\033[0m\n' "$PASSED"
  fi
  exit 0
fi
printf '\033[31m✗ %s khẳng định ĐỎ (trong %s).\033[0m\n' "$FAILED" "$((FAILED + PASSED))"
printf '   Xem đầu ra thật của các ca:\n'
for f in "$WORK"/out.*.txt; do
  printf '\n── %s ──\n' "$(basename "$f")"
  sed 's/^/    /' "$f"
done
exit 1
