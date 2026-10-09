#!/usr/bin/env bash
# =============================================================================
# RubyLingo — CẬP NHẬT TỪ GITHUB trên VPS (Nhóm 12). Thay cho luồng đóng gói .tar.gz.
# =============================================================================
#
# ⭐ VÌ SAO CÓ TỆP NÀY (chứ không chỉ gõ `git pull && ./scripts/deploy.sh`):
#   Sửa một lỗi rồi đồng bộ qua GitHub nghĩa là VPS chạy `git pull` trên mã ĐANG PHỤC VỤ NGƯỜI
#   DÙNG THẬT. Một `git pull` trên server có ba đường hỏng IM LẶNG; mỗi đường dưới đây bị một
#   bước trong script chặn lại:
#     • L1 — RÒ RỈ DỮ LIỆU TRẺ EM: nếu `data/` (DB SQLite) hoặc `.env` (SESSION_SECRET) lỡ bị
#            GIT THEO DÕI thì `git pull` sẽ ghi đè lên dữ liệu đang sống, hoặc mang nó lên GitHub.
#            BƯỚC 2 chặn TRƯỚC khi pull — khi đã tới đây thì mọi bước sau đều có thể làm nặng thêm.
#     • L2 — PULL ĐÈ MẤT THAY ĐỔI SỬA-TAY-TRÊN-VPS: ai đó sửa trực tiếp trên server ⇒ `git pull`
#            xung đột. BƯỚC 4 chặn khi cây có thay đổi với tệp ĐƯỢC THEO DÕI.
#     • L3 — MERGE COMMIT TRÊN SERVER: `git pull` mặc định có thể tạo merge commit; trên server
#            deploy đó là lịch sử không ai muốn và lần sau càng dễ xung đột. BƯỚC 5 dùng `--ff-only`
#            để hoặc là TIẾN THẲNG, hoặc là DỪNG và nhường cho người xử lý.
#
# ⚠️ SCRIPT NÀY KHÔNG KIỂM LẠI APP. Toàn bộ việc kiểm chứng (compose config, số migration,
#    DB trên host, /api/health, URL công khai) nằm ở `./scripts/deploy.sh` — NGUỒN DUY NHẤT.
#    BƯỚC 7 gọi nó. Cố tình KHÔNG chép logic đó vào đây: hai bản sao thì bản này sẽ lệch, và lệch
#    theo hướng tệ nhất — "tưởng là đã kiểm".
#
# ⚠️ KHÁC `pack-for-vps.sh`: tệp đó mô tả luồng CŨ (repo trên VPS KHÔNG dùng git). Từ nay VPS
#    `git clone` MỘT LẦN, các lần sau chỉ chạy CHÍNH script này.
#
# -----------------------------------------------------------------------------
# DÙNG (chạy từ gốc repo, trên VPS)
# -----------------------------------------------------------------------------
#   ./scripts/update.sh                 # fetch → xem thay đổi → ff-only pull → deploy (có kiểm)
#   FORCE=1 ./scripts/update.sh         # build lại DÙ không có commit mới
#   SKIP_BUILD=1 ./scripts/update.sh    # chuyển tiếp xuống deploy.sh (dùng image đang có)
#
#   ⚠️ Biến môi trường (SKIP_BUILD, POLL_ATTEMPTS, POLL_INTERVAL, READY_ATTEMPTS…) KHÔNG cần
#      script này chuyển tiếp: tiến trình con thừa hưởng nguyên môi trường của cha, nên
#      `exec ./scripts/deploy.sh` ở BƯỚC 7 là đã "truyền tiếp" đúng nghĩa.
# =============================================================================

set -euo pipefail

# Đứng ở gốc repo DÙ được gọi từ đâu — cùng cách `deploy.sh` làm, để đường dẫn tương đối (./.env,
# ./data, ./scripts/deploy.sh) luôn trỏ đúng.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

FORCE="${FORCE:-0}"

# --- Tiện ích in ấn (GIỐNG deploy.sh, để log đọc quen mắt) -------------------
step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
ok()   { printf '\033[32m  ✓ %s\033[0m\n' "$1"; }
warn() { printf '\033[33m  ⚠ %s\033[0m\n' "$1"; }

# `fail` in BƯỚC ĐANG ĐỎ + cách xử lý rồi THOÁT KHÁC 0 — không bao giờ "báo thành công" tiếp.
# Dùng CÙNG chữ ký `fail <bước> <thông báo>` như deploy.sh.
fail() {
  printf '\n\033[31m  ✗ BƯỚC %s THẤT BẠI: %s\033[0m\n\n' "$1" "$2"
  exit 1
}

# =============================================================================
# BƯỚC 1/7 — TIỀN KIỂM: môi trường có đủ thứ để làm việc không?
# =============================================================================
step "BƯỚC 1/7 — tiền kiểm (git work tree, remote, upstream, .env, docker compose)"

if ! command -v git >/dev/null 2>&1; then
  fail "1" "không tìm thấy lệnh 'git'. Script này chạy TRÊN VPS, nơi repo đã được 'git clone' từ GitHub."
fi

# ⚠️ Bắt ĐÚNG lỗi "không phải git repo" Ở ĐÂY. Nếu để lọt xuống, lệnh git kế tiếp sẽ nổ ra
#    "fatal: not a git repository (or any of the parent directories)" — thô và khó hiểu với người
#    chạy. Thông báo dưới đây nói RÕ phải làm gì. (Đây cũng là đường mà người dùng thật sẽ đâm vào
#    khi chạy script ở sai chỗ.)
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "1" "'${REPO_ROOT}' KHÔNG phải git work tree. Trên VPS, repo phải được tạo bằng 'git clone <url>' (KHÔNG giải nén .tar.gz). Nếu bạn đang ở máy khác: hãy 'cd' vào gốc repo rubylingo rồi chạy lại."
fi
ok "trong git work tree: $(git rev-parse --show-toplevel)"

# ⚠️ Remote là thứ `git fetch`/`git pull` cần. Kiểm trước để báo rõ, thay vì để git tự nổ.
if [ -z "$(git remote)" ]; then
  fail "1" "repo chưa có remote nào. Thêm bằng: git remote add origin <url-repo-github> — VPS phải 'git clone' từ GitHub, không nhận .tar.gz."
fi
ok "có remote: $(git remote | tr '\n' ' ')"

# ⚠️ DETACHED HEAD: `@{u}` KHÔNG tồn tại khi HEAD rời khỏi nhánh ⇒ mọi truy vấn upstream bên dưới
#    lỗi. Phát hiện SỚM và nói rõ cách thoát, thay vì để lộ "ambiguous argument '@{u}'".
if ! git symbolic-ref -q HEAD >/dev/null; then
  fail "1" "đang ở trạng thái DETACHED HEAD (không đứng trên nhánh nào). Chạy 'git checkout main' (hoặc nhánh bạn muốn deploy) rồi chạy lại."
fi
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
ok "đang ở nhánh: ${BRANCH}"

# ⚠️ UPSTREAM là thứ cú pháp `@{u}` cần. `git clone` đặt sẵn, nhưng 'git init' + 'git remote add'
#    thì KHÔNG ⇒ phải bắt và HƯỚNG DẪN, tuyệt đối không để lộ lỗi bash/git thô.
if ! UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)"; then
  fail "1" "nhánh '${BRANCH}' CHƯA có upstream nên không biết pull từ đâu. Gán bằng: git branch --set-upstream-to=origin/${BRANCH} — rồi chạy lại."
fi
ok "theo dõi nhánh từ xa: ${UPSTREAM}"

# ⚠️ `.env` là của VPS, KHÔNG nằm trong repo. Thiếu ⇒ deploy chắc chắn đỏ ở bước 'compose config'
#    của deploy.sh. Bắt Ở ĐÂY để báo bằng tiếng Việt rõ ràng kèm đúng một lệnh để sửa.
if [ ! -f .env ]; then
  fail "1" "thiếu .env (VPS giữ .env riêng, KHÔNG lấy từ repo). Tạo bằng: cp .env.example .env — rồi điền SUBDOMAIN / DOMAIN_NAME / SESSION_SECRET / PUBLIC_ORIGIN (xem deploy/README.md)."
fi
ok "thấy .env"

if ! command -v docker >/dev/null 2>&1; then
  fail "1" "không tìm thấy lệnh 'docker'. Script này chạy TRÊN VPS đã cài Docker."
fi
if ! docker compose version >/dev/null 2>&1; then
  fail "1" "không gọi được 'docker compose' (Docker Compose v2 chưa cài?). deploy.sh cần nó để build và up."
fi
ok "có docker + docker compose"

if [ ! -x ./scripts/deploy.sh ]; then
  fail "1" "không thấy ./scripts/deploy.sh (hoặc chưa 'chmod +x'). BƯỚC 7 cần nó để kiểm chứng deploy."
fi
ok "có ./scripts/deploy.sh (dùng lại toàn bộ 5 bước kiểm, KHÔNG chép lại)"

# =============================================================================
# BƯỚC 2/7 — CHỐT AN TOÀN: `data/`, `backups/`, `.env` TUYỆT ĐỐI không được git theo dõi
# =============================================================================
# ⚠️⚠️ ĐÂY LÀ CHỐT QUAN TRỌNG NHẤT CỦA SCRIPT NÀY — VÀ NÓ PHẢI CHẠY **TRƯỚC** `git pull`.
#   `data/` chứa DB SQLite của TRẺ EM; `.env` chứa SESSION_SECRET. Nếu một trong số này lỡ ĐƯỢC
#   GIT THEO DÕI (tức là `.gitignore` không chặn được — luật đã bị sửa, hoặc tệp bị `git add -f`),
#   thì `git pull` sẽ GHI ĐÈ lên dữ liệu đang sống trên VPS, hoặc ĐẨY nó lên GitHub. Cả hai đều là
#   rò rỉ/hỏng dữ liệu trẻ em. Khi đã tới mức này thì KHÔNG được pull: bất kỳ bước nào tiếp theo
#   cũng có thể làm nặng thêm. Dừng, để con người quyết định.
#
# ⚠️ `git ls-files --error-unmatch <path>` thoát KHÁC 0 khi KHÔNG có tệp nào khớp ⇒ đọc là
#    "đường dẫn này CÓ đang bị theo dõi hay không". Nó tra INDEX (không phải đĩa) nên kiểm được cả
#    khi thư mục chưa tồn tại trên máy đang chạy.
is_tracked() { git ls-files --error-unmatch -- "$1" >/dev/null 2>&1; }

LEAKED=()
for p in .env data backups; do
  if is_tracked "$p"; then
    LEAKED+=("$p")
  fi
done

if [ "${#LEAKED[@]}" -gt 0 ]; then
  for p in "${LEAKED[@]}"; do
    printf '\n  \033[31m✗ đang bị git theo dõi:\033[0m %s\n' "$p"
    # In tối đa 10 tệp để log còn đọc được.
    git ls-files -- "$p" | sed -n '1,10p' | sed 's/^/      /'
  done
  fail "2" "DỪNG NGAY — dữ liệu trẻ em / bí mật đang bị git theo dõi (${LEAKED[*]}). KHÔNG được pull. Xử lý: 'git rm --cached -r data backups .env', rồi kiểm lại .gitignore phải có 'data/', 'backups/', '.env'. Nếu chúng đã nằm trong lịch sử commit thì phải xoá khỏi lịch sử (lọc repo) TRƯỚC KHI tiếp tục."
fi
ok ".env, data/, backups/ đều KHÔNG bị git theo dõi"

# =============================================================================
# BƯỚC 3/7 — FETCH rồi CHO XEM sẽ thay đổi những gì
# =============================================================================
# ⚠️ `git fetch` KHÔNG đụng vào cây làm việc: nó chỉ cập nhật con trỏ nhánh từ xa. Nên nó AN TOÀN
#    để chạy trước khi quyết định. `git pull` mới là thứ GHI — và để dành tới BƯỚC 5.
step "BƯỚC 3/7 — fetch và xem ${UPSTREAM} có gì mới"
if ! git fetch --quiet "${UPSTREAM%%/*}"; then
  fail "3" "git fetch thất bại (mạng? sai URL remote? VPS không có quyền truy cập?). Kiểm 'git remote -v' và kết nối tới GitHub rồi chạy lại."
fi

INCOMING="$(git rev-list --count 'HEAD..@{u}')"
if [ "${INCOMING}" -eq 0 ]; then
  if [ "${FORCE}" = "1" ]; then
    warn "không có commit mới, NHƯNG FORCE=1 ⇒ vẫn build lại (bỏ qua tối ưu)"
  else
    ok "đã là bản mới nhất — ${UPSTREAM} không có commit nào ta chưa có"
    printf '\n\033[32m  ✓ Không cần cập nhật ⇒ KHÔNG build lại (tránh phút chết vô ích của dịch vụ).\033[0m\n'
    printf '    Muốn build lại DÙ không có commit mới: FORCE=1 ./scripts/update.sh\n\n'
    exit 0
  fi
else
  printf '  → %s commit mới sẽ được kéo về:\n' "${INCOMING}"
  git log --oneline 'HEAD..@{u}' | sed 's/^/      /'
  ok "sẵn sàng kéo ${INCOMING} commit"
fi

# =============================================================================
# BƯỚC 4/7 — TỪ CHỐI nếu CÂY có thay đổi với tệp ĐƯỢC THEO DÕI
# =============================================================================
# ⚠️ Thay đổi với tệp được theo dõi nghĩa là ai đó đã SỬA TAY trên VPS (hoặc một tiến trình ghi
#    vào tệp nằm trong repo). `git pull` lúc đó sẽ XUNG ĐỘT, hoặc tệ hơn là tạo merge commit (L3).
#    Ta DỪNG để con người xử lý có chủ đích — script không tự "giải quyết" thay họ.
# ⚠️ Tệp KHÔNG được theo dõi (`.env`, `data/`, log…) thì KHÔNG tính: đó là dữ liệu vận hành bình
#    thường trên VPS và không liên quan tới `git pull`. Nên phép kiểm chỉ soi tệp ĐƯỢC theo dõi.
step "BƯỚC 4/7 — kiểm cây làm việc (chỉ tính tệp ĐƯỢC THEO DÕI)"
DIRTY=0
# `git diff --quiet` thoát 1 khi CÓ khác biệt. Đặt trong `if !` để `set -e` không kích hoạt nhầm.
if ! git diff --quiet; then DIRTY=1; fi           # thay đổi chưa stage (đĩa vs index)
if ! git diff --cached --quiet; then DIRTY=1; fi  # thay đổi đã stage  (index vs HEAD)
if [ "${DIRTY}" -ne 0 ]; then
  printf '\n  ── các tệp được theo dõi đang thay đổi ──\n'
  git status --short | sed 's/^/      /'
  fail "4" "cây có thay đổi với tệp ĐƯỢC THEO DÕI ⇒ 'git pull' có thể XUNG ĐỘT. Xem danh sách ở trên. Xử lý: 'git stash' (giữ tạm để xử lý sau), hoặc 'git checkout -- <tệp>' (BỎ thay đổi trên VPS — chỉ khi chắc chắn sửa-tay đó là sai), rồi chạy lại. Script CỐ Ý không tự trộn."
fi
ok "cây sạch với MỌI tệp được theo dõi (tệp không theo dõi như .env/data/ không tính)"

# =============================================================================
# BƯỚC 5/7 — PULL chỉ TIẾN THẲNG (`--ff-only`)
# =============================================================================
# ⚠️⚠️ KHÔNG BAO GIỜ để server tạo merge commit. `--ff-only` bảo git: "hoặc HEAD tiến thẳng tới bản
#    mới, hoặc DỪNG". Nếu nó thất bại thì lịch sử nhánh đã PHÂN KỲ (ai đó push lên nhánh đã rebase,
#    hoặc VPS có commit riêng) — đó là việc của CON NGƯỜI, không phải thứ script nên tự quyết.
step "BƯỚC 5/7 — git pull --ff-only"
if ! git pull --ff-only; then
  fail "5" "'git pull --ff-only' thất bại ⇒ lịch sử nhánh đã PHÂN KỲ (không thể tiến thẳng). Script CỐ Ý không tự merge/rebase trên server. Kiểm 'git log --oneline --graph --decorate -20' rồi xử lý TAY — ví dụ, NẾU chắc chắn không mất việc gì: 'git fetch && git reset --hard ${UPSTREAM}'."
fi
ok "đã kéo về an toàn, KHÔNG tạo merge commit"

# =============================================================================
# BƯỚC 6/7 — IN BẢN SẮP ĐƯỢC BUILD (để biết mình đang build lại cái gì)
# =============================================================================
step "BƯỚC 6/7 — bản sẽ được build"
git log -1 --stat --oneline | sed 's/^/  /'
ok "HEAD hiện tại: $(git rev-parse --short HEAD)"

# =============================================================================
# BƯỚC 7/7 — GỌI deploy.sh (nguồn DUY NHẤT của logic kiểm chứng)
# =============================================================================
# ⚠️ KHÔNG chép lại 5 bước kiểm của deploy.sh vào đây — hai bản sao thì bản này chắc chắn lệch.
# ⚠️ Biến môi trường (SKIP_BUILD, POLL_ATTEMPTS, READY_ATTEMPTS…) tự truyền sang: tiến trình con
#    thừa hưởng môi trường của cha, nên KHÔNG cần export lại. `exec` thay thế tiến trình này bằng
#    deploy.sh ⇒ mã thoát của update.sh chính là mã thoát của deploy.sh (đúng như mong muốn).
step "BƯỚC 7/7 — bàn giao cho ./scripts/deploy.sh"
exec ./scripts/deploy.sh
