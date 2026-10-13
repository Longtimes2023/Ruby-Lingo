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
#   ⭐ ./scripts/update-keep-local.sh   # TÊN NGẮN của lệnh dưới — lệnh dùng HẰNG NGÀY trên VPS
#   KEEP_LOCAL=1 ./scripts/update.sh    # GIỮ NGUYÊN các tệp ĐANG SỬA TAY trên VPS qua lần cập nhật
#                                       # (tự sao lưu trước, tự đặt lại sau — KHÔNG hỏi gì). Xem BƯỚC 4.
#
#   ⚠️ Biến môi trường (SKIP_BUILD, POLL_ATTEMPTS, POLL_INTERVAL, READY_ATTEMPTS…) KHÔNG cần
#      script này chuyển tiếp: tiến trình con thừa hưởng nguyên môi trường của cha, nên
#      `exec ./scripts/deploy.sh` ở BƯỚC 7 là đã "truyền tiếp" đúng nghĩa.
# =============================================================================

set -euo pipefail

# Đứng ở gốc repo DÙ được gọi từ đâu — cùng cách `deploy.sh` làm, để đường dẫn tương đối (./.env,
# ./data, ./scripts/deploy.sh) luôn trỏ đúng.
# ⚠️ `RUBYLINGO_REPO_ROOT` do BƯỚC 0 (ngay dưới) đặt: khi chạy từ bản sao tạm thì không thể suy
#    ra gốc repo từ đường dẫn của chính script nữa ⇒ phải nhận qua môi trường.
REPO_ROOT="${RUBYLINGO_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$REPO_ROOT"

# =============================================================================
# BƯỚC 0 — CHẠY TỪ BẢN SAO TẠM (chống "script tự ghi đè chính mình giữa chừng")
# =============================================================================
# ⚠️⚠️ VÌ SAO CẦN: BƯỚC 5 chạy `git pull`, mà commit mới RẤT THƯỜNG sửa chính `scripts/update.sh`
#   (mỗi lần luồng deploy được cải tiến là một lần). Bash đọc tệp script theo TỪNG KHỐI, nó KHÔNG
#   nạp cả tệp vào bộ nhớ; nhiều đường ghi của git mở tệp bằng `O_TRUNC` (CẮT NGẮN đúng cái inode
#   đang được đọc) ⇒ phần còn lại của script có thể được đọc từ một tệp ĐÃ KHÁC: cú pháp rác, hoặc
#   tệ hơn là chạy nhầm lệnh.
#   ⇒ Cách chữa rẻ nhất và triệt để: tự chép ra thư mục tạm rồi chạy TIẾP TỪ BẢN SAO. Từ đó, việc
#     git ghi đè tệp trong repo là VÔ HẠI với tiến trình đang chạy.
#   ⚠️ Cờ `RUBYLINGO_UPDATE_SELFCOPY=1` để bản sao KHÔNG tự chép tiếp (nếu không sẽ thành vòng lặp
#      vô hạn: mỗi bản sao lại chép ra bản sao mới).
if [ "${RUBYLINGO_UPDATE_SELFCOPY:-0}" != "1" ]; then
  SELF_PATH="${BASH_SOURCE[0]}"
  SELF_DIR="$(cd "$(dirname "${SELF_PATH}")" && pwd)"
  if ! SELF_TMP="$(mktemp 2>/dev/null)" || [ -z "${SELF_TMP}" ]; then
    printf '\n\033[31m  ✗ BƯỚC 0 THẤT BẠI: không tạo được tệp tạm ("mktemp"). Script cần nó để chạy từ bản sao, nhờ đó việc kéo mã mới không thể làm hỏng chính script đang chạy. Kiểm xem /tmp (hoặc $TMPDIR) có ghi được không.\033[0m\n\n'
    exit 1
  fi
  if ! cp "${SELF_DIR}/$(basename "${SELF_PATH}")" "${SELF_TMP}"; then
    printf '\n\033[31m  ✗ BƯỚC 0 THẤT BẠI: không chép được bản sao script ra " %s ".\033[0m\n\n' "${SELF_TMP}"
    exit 1
  fi
  # ⚠️ `-f`: trên VPS, `/tmp` có thể bị chính sách dọn dẹp hoặc `noexec`; nhưng ta chạy bằng
  #    `bash <tệp>` chứ không exec tệp, nên `noexec` KHÔNG cản trở. Chỉ cần tệp đọc được.
  # ⚠️ `trap` này KHÔNG dọn được ở đường thành công (BƯỚC 7 `exec ./scripts/deploy.sh` THAY THẾ
  #    tiến trình ⇒ trap EXIT không chạy). Nó vẫn có ích: mọi đường THẤT BẠI (đều `exit`) được dọn.
  #    ⇒ Ở đường thành công, MỘT bản sao nhỏ nằm lại trong /tmp. Đó là đánh đổi CÓ Ý: xoá tệp ngay
  #      trước `exec` là tự tay tạo lại đúng cái nguy hiểm mà BƯỚC 0 sinh ra để chặn (bash có thể
  #      còn đang đọc chính tệp đó). `/tmp` được hệ điều hành dọn định kỳ.
  trap 'rm -f "${SELF_TMP}"' EXIT
  export RUBYLINGO_UPDATE_SELFCOPY=1
  export RUBYLINGO_REPO_ROOT="${REPO_ROOT}"
  printf '  · chạy từ BẢN SAO TẠM (%s) — để việc kéo mã mới không thể sửa chính script đang chạy\n' "${SELF_TMP}"
  exec bash "${SELF_TMP}" "$@"
fi

FORCE="${FORCE:-0}"

# ⭐ `KEEP_LOCAL=1` — dành cho VPS có vài tệp ĐƯỢC SỬA TAY CỐ Ý (ví dụ tham số riêng của máy chủ
#    trong `docker-compose.yml`). Bật thì BƯỚC 4 KHÔNG dừng nữa, mà sao lưu bản vá rồi ĐỐI CHIẾU
#    để CHỨNG MINH các tệp sửa-tay vẫn nguyên qua lần kéo mã mới. Lệnh gõ hằng ngày là
#    `./scripts/update-keep-local.sh` (tệp mỏng chỉ `exec` script này với biến này).
#    Toàn bộ lập luận an toàn — và vì sao KHÔNG cần "reset rồi dán lại" — nằm ở BƯỚC 4.
KEEP_LOCAL="${KEEP_LOCAL:-0}"

# ⚠️ `sha256sum` là thứ CHỐT KIỂM CHỨNG của chế độ KEEP_LOCAL dựa vào (BƯỚC 4/5). Thiếu nó thì
#    phép kiểm trở thành RỖNG mà vẫn báo xanh — đúng loại "xanh giả" tệ nhất. Bắt SỚM, rõ ràng.
#    ⚠️ HỎI ĐÚNG LÚC: chỉ đòi khi thật sự dùng tới, để luồng thường ngày không bị chặn oan.
#    ⚠️ VÌ SAO `sha256sum` chứ không `git hash-object`: cần băm NỘI DUNG TRÊN ĐĨA, kể cả khi tệp
#       KHÔNG được theo dõi hoặc đang thay đổi. `sha256sum` là lệnh chuẩn (coreutils) trên mọi bản
#       Linux — kể cả `debian:bookworm-slim` mà image runtime dùng — nên không thêm phụ thuộc mới.
#    (⚠️ KHÔNG dùng hàm `fail` ở đây — nó được định nghĩa ngay dưới; in thẳng cho chắc.)
if [ "${KEEP_LOCAL}" = "1" ] && ! command -v sha256sum >/dev/null 2>&1; then
  printf '\n\033[31m  ✗ BƯỚC 1 THẤT BẠI: KEEP_LOCAL=1 cần lệnh "sha256sum" (để chứng minh bản sửa-tay còn nguyên sau khi kéo) nhưng máy này không có.\033[0m\n\n'
  exit 1
fi

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
# BƯỚC 4/7 — CÂY LÀM VIỆC: tệp nào bị SỬA TAY, và có AN TOÀN để kéo mã mới không?
# =============================================================================
# ⚠️ Thay đổi với tệp được theo dõi nghĩa là ai đó đã SỬA TAY trên VPS (hoặc một tiến trình ghi
#    vào tệp nằm trong repo). `git pull` lúc đó sẽ XUNG ĐỘT, hoặc tệ hơn là tạo merge commit (L3).
#
# HAI CHẾ ĐỘ — mặc định KHÔNG đổi hành vi cũ:
#   • MẶC ĐỊNH      — DỪNG lại và để con người quyết định.
#   • KEEP_LOCAL=1  — GIỮ NGUYÊN các tệp sửa-tay qua lần cập nhật, không hỏi gì. Dùng khi VPS có
#                     vài tệp sửa tay CỐ Ý (vd tham số riêng của máy chủ) và người vận hành không
#                     muốn gõ lại thao tác đó mỗi lần cập nhật. Lệnh gõ hằng ngày:
#                     `./scripts/update-keep-local.sh`
#
# ⭐⭐ VÌ SAO KEEP_LOCAL=1 AN TOÀN — VÀ VÌ SAO NÓ **KHÔNG** CẦN "RESET RỒI DÁN LẠI":
#   `git pull --ff-only` KHÔNG đụng tới tệp có sửa-tay MIỄN LÀ bản mới không sửa đúng tệp đó.
#   Chính git tự soát việc này và **TỪ CHỐI** kéo nếu có tệp vừa sửa-tay vừa bị bản mới đụng tới
#   ("Your local changes to the following files would be overwritten by merge"). Nghĩa là: khi
#   hai tập hợp RỜI NHAU thì "kéo mã mới" và "giữ bản sửa-tay" KHÔNG giành nhau — nên KHÔNG có
#   cửa sổ nào để mất dữ liệu (một cách làm khác — sao chép ra rồi dán lại — lại TẠO RA đúng
#   cửa sổ đó, nên nó bị loại).
#   ⇒ Việc của script chỉ còn ba việc: (a) tự DÒ hai tập hợp, (b) DỪNG nếu chúng GIAO NHAU (lúc
#     đó giữ-cả-hai là bất khả), (c) sau khi kéo thì ĐỐI CHIẾU VẾT BĂM để CHỨNG MINH bản sửa-tay
#     vẫn nguyên — chứ không "tin là git đã làm đúng" (xem BƯỚC 5).
#   ⚠️ KHÔNG PHẢI SUY LUẬN SUÔNG: hành vi trên đã được ĐO bằng git thật — ca B (hai tập hợp rời
#      nhau ⇒ kéo được, tệp sửa-tay nguyên vẹn) và ca C (giao nhau ⇒ git TỪ CHỐI, không đụng gì)
#      trong `scripts/tests/update-keep-local.test.sh`. Cổng kiểm đó chạy trên CI.
#
# ⚠️ Tệp KHÔNG được theo dõi (`.env`, `data/`, log…) thì KHÔNG tính: đó là dữ liệu vận hành bình
#    thường trên VPS và không liên quan tới `git pull`. Nên phép kiểm chỉ soi tệp ĐƯỢC theo dõi.
step "BƯỚC 4/7 — cây làm việc: tệp sửa tay & vùng giao với bản mới"

KEPT=()         # tệp sửa-tay sẽ được GIỮ NGUYÊN (chỉ khác rỗng khi KEEP_LOCAL=1)
KEPT_HASHES=()  # vết băm sha256 tương ứng — để BƯỚC 5 đối chiếu
PATCH_PATH=""   # bản vá sao lưu (đường lui nếu có gì đó hỏng)

# ⚠️ `-z` (NUL) chứ không phải xuống dòng: đường dẫn có dấu cách vẫn nguyên vẹn. `mapfile -d ''`
#    đọc đúng định dạng đó vào MẢNG.
# ⚠️ `< <(…)` (process substitution) chứ KHÔNG dùng ống `|`: ống đẩy vòng lặp sang TIẾN TRÌNH CON
#    ⇒ biến/mảng tạo trong đó BIẾN MẤT khi ống đóng, và mã thoát của git không còn đi tới `set -e`.
mapfile -d '' DIRTY < <(git diff --name-only -z HEAD)

if [ "${#DIRTY[@]}" -eq 0 ]; then
  ok "cây sạch với MỌI tệp được theo dõi (tệp không theo dõi như .env/data/ không tính)"
else
  printf '\n  ── các tệp ĐƯỢC THEO DÕI đang thay đổi (%s tệp) ──\n' "${#DIRTY[@]}"
  # ⚠️ `--untracked-files=no`: danh sách in ra phải KHỚP ĐÚNG tập hợp mà script đang xử lý. In cả
  #    tệp KHÔNG theo dõi (`.env`, `data/`, …) sẽ khiến log trông như ta sắp đụng vào chúng — trong
  #    khi chúng không hề liên quan tới `git pull` (xem chú thích cuối khối này).
  git status --short --untracked-files=no | sed 's/^/      /'

  if [ "${KEEP_LOCAL}" != "1" ]; then
    fail "4" "cây có thay đổi với tệp ĐƯỢC THEO DÕI ⇒ 'git pull' có thể XUNG ĐỘT. Xem danh sách ở trên. Xử lý: 'git stash' (giữ tạm để xử lý sau), hoặc 'git checkout -- <tệp>' (BỎ thay đổi trên VPS — chỉ khi chắc chắn sửa-tay đó là sai), rồi chạy lại. Script CỐ Ý không tự trộn. ⇒ HOẶC, nếu những tệp sửa-tay đó là CỐ Ý và bạn muốn GIỮ NGUYÊN chúng qua lần cập nhật: chạy ./scripts/update-keep-local.sh"
  fi

  # -----------------------------------------------------------------------------------------
  # TỪ ĐÂY LÀ NHÁNH KEEP_LOCAL=1
  # -----------------------------------------------------------------------------------------

  # (0) Trần số tệp sửa-tay. Trần tồn tại để một SỰ CỐ (vd một công cụ định dạng ghi lại cả cây)
  #     không bị "giữ nguyên" một cách im lặng — lúc đó ta muốn DỪNG, không muốn kéo tiếp.
  KEEP_LOCAL_MAX="${KEEP_LOCAL_MAX:-10}"
  if [ "${#DIRTY[@]}" -gt "${KEEP_LOCAL_MAX}" ]; then
    fail "4" "có ${#DIRTY[@]} tệp sửa-tay, VƯỢT TRẦN ${KEEP_LOCAL_MAX} của chế độ giữ-nguyên. Trần này có chủ ý: nhiều tệp bất thường thường là dấu hiệu SỰ CỐ chứ không phải sửa-tay có chủ đích. Nếu thật sự là CỐ Ý: KEEP_LOCAL_MAX=<số lớn hơn> ./scripts/update-keep-local.sh"
  fi

  # (1) VÙNG GIAO — tệp vừa sửa tay, vừa bị bản mới đụng tới ⇒ hai ý định giành nhau ⇒ DỪNG.
  mapfile -d '' INCOMING_FILES < <(git diff --name-only -z 'HEAD..@{u}')
  OVERLAP=()
  # ⚠️ Kiểm rỗng TRƯỚC khi mở rộng mảng: trên bash < 4.4, `"${arr[@]}"` với mảng RỖNG + `set -u`
  #    là lỗi "unbound variable" — tức là script chết ở đúng dòng vô hại nhất.
  if [ "${#INCOMING_FILES[@]}" -gt 0 ]; then
    for f in "${DIRTY[@]}"; do
      for g in "${INCOMING_FILES[@]}"; do
        if [ "$f" = "$g" ]; then
          OVERLAP+=("$f")
          break
        fi
      done
    done
  fi
  if [ "${#OVERLAP[@]}" -gt 0 ]; then
    printf '\n  ── VÙNG GIAO: vừa sửa tay trên VPS, vừa bị bản mới sửa (%s tệp) ──\n' "${#OVERLAP[@]}"
    printf '      %s\n' "${OVERLAP[@]}"
    fail "4" "bản mới CŨNG sửa đúng những tệp này ⇒ KHÔNG thể giữ cả hai bản. Đây là việc của CON NGƯỜI, script không tự chọn thay bạn. Chọn một: (1) THEO BẢN MỚI — 'git checkout -- <tệp>' rồi chạy lại; (2) GIỮ BẢN SỬA-TAY — chép nó ra ngoài, chạy lại, rồi tự dán lại sau. (Các tệp sửa-tay còn lại, KHÔNG nằm trong vùng giao, vẫn giữ nguyên được.)"
  fi

  # (2) SAO LƯU bản vá + vết băm — nguyên tắc: không bao giờ kéo mã mới mà không có đường lui.
  PATCH_DIR="backups/keep-local"
  mkdir -p "$PATCH_DIR"
  PATCH_PATH="${PATCH_DIR}/keep-local-$(date -u +%Y%m%dT%H%M%SZ).patch"
  if ! git diff --binary HEAD > "$PATCH_PATH"; then
    fail "4" "không ghi được bản vá sao lưu vào '${PATCH_PATH}' ⇒ DỪNG, không kéo mã mới."
  fi
  if [ ! -s "$PATCH_PATH" ]; then
    fail "4" "bản vá sao lưu '${PATCH_PATH}' RỖNG dù cây đang có thay đổi ⇒ có gì đó không nhất quán. DỪNG thay vì kéo mã mới trên một trạng thái ta không hiểu."
  fi
  ok "đã sao lưu bản sửa-tay: ${PATCH_PATH} ($(wc -c < "$PATCH_PATH" | tr -d ' ') byte)"

  # (3) VẾT BĂM chụp NGAY BÂY GIỜ, để BƯỚC 5 chứng minh chúng còn nguyên SAU khi kéo.
  #     Tệp bị XOÁ tay thì không có gì để băm ⇒ neo bằng dấu '-' và kiểm "vẫn phải KHÔNG tồn tại".
  # ⚠️ `|| true` + kiểm rỗng ở NGAY DƯỚI là để tránh bẫy "thoát IM LẶNG": phép GÁN có lệnh thay
  #    thế thất bại ⇒ `set -e` giết script ngay tại dòng đó mà không in gì (đã trả giá 2026-10-09).
  for f in "${DIRTY[@]}"; do
    KEPT+=("$f")
    if [ ! -f "$f" ]; then
      KEPT_HASHES+=("-")
      continue
    fi
    h="$(sha256sum -- "$f" 2>/dev/null | cut -d' ' -f1 || true)"
    if [ -z "$h" ]; then
      fail "4" "không tính được vết băm (sha256sum) của '${f}'. Không có vết băm thì BƯỚC 5 không chứng minh được gì ⇒ DỪNG thay vì kéo mã mới với một phép kiểm rỗng. Kiểm xem tệp có đọc được không và máy có lệnh 'sha256sum' không."
    fi
    KEPT_HASHES+=("$h")
  done

  ok "${#KEPT[@]} tệp sửa-tay sẽ được GIỮ NGUYÊN (vùng giao RỖNG ⇒ git cho kéo mã mới mà KHÔNG đụng vào chúng)"
fi

# =============================================================================
# BƯỚC 5/7 — PULL chỉ TIẾN THẲNG (`--ff-only`)
# =============================================================================
# ⚠️⚠️ KHÔNG BAO GIỜ để server tạo merge commit. `--ff-only` bảo git: "hoặc HEAD tiến thẳng tới bản
#    mới, hoặc DỪNG". Nếu nó thất bại thì lịch sử nhánh đã PHÂN KỲ (ai đó push lên nhánh đã rebase,
#    hoặc VPS có commit riêng) — đó là việc của CON NGƯỜI, không phải thứ script nên tự quyết.
step "BƯỚC 5/7 — git pull --ff-only, rồi ĐỐI CHIẾU bản sửa-tay"
if ! git pull --ff-only; then
  if [ -n "${PATCH_PATH}" ]; then
    printf '\n  \033[33m⚠ Bản sửa-tay của bạn ĐÃ sao lưu ở: %s\033[0m\n' "${PATCH_PATH}"
    printf '    (kéo mã mới thất bại KHÔNG làm mất bản sửa-tay — chúng vẫn còn nguyên tại chỗ.)\n'
  fi
  fail "5" "'git pull --ff-only' thất bại ⇒ lịch sử nhánh đã PHÂN KỲ (không thể tiến thẳng). Script CỐ Ý không tự merge/rebase trên server. Kiểm 'git log --oneline --graph --decorate -20' rồi xử lý TAY — ví dụ, NẾU chắc chắn không mất việc gì: 'git fetch && git reset --hard ${UPSTREAM}'."
fi
ok "đã kéo về an toàn, KHÔNG tạo merge commit"

# ⚠️⚠️ CHỐT KIỂM CHỨNG CỦA CHẾ ĐỘ GIỮ-NGUYÊN — VÌ SAO PHẢI CÓ, DÙ LẬP LUẬN Ở BƯỚC 4 ĐÃ ĐỦ:
#   Lập luận "git không đụng vào tệp sửa-tay khi hai tập hợp rời nhau" là lập luận về HÀNH VI CỦA
#   GIT — một thứ có thể đổi theo phiên bản, theo cấu hình, hoặc đơn giản là ta hiểu sai. Một lời
#   khẳng định về SỰ AN TOÀN thì phải ĐO ĐƯỢC, không được suy ra. Đây chính là phép đo đó: so vết
#   băm TỪNG tệp sửa-tay trước/sau khi kéo. Lệch một tệp cũng đủ để DỪNG và chỉ người dùng đường lui.
if [ "${#KEPT[@]}" -gt 0 ]; then
  MISM=()
  for i in "${!KEPT[@]}"; do
    f="${KEPT[$i]}"
    want="${KEPT_HASHES[$i]}"
    if [ "${want}" = "-" ]; then
      if [ -e "$f" ]; then MISM+=("$f — tệp này đang BỊ XOÁ TAY, sau khi kéo nó đã QUAY LẠI"); fi
      continue
    fi
    if [ ! -f "$f" ]; then
      MISM+=("$f — đáng lẽ còn nguyên, nay ĐÃ MẤT")
      continue
    fi
    got="$(sha256sum -- "$f" 2>/dev/null | cut -d' ' -f1 || true)"
    if [ "${got}" != "${want}" ]; then MISM+=("$f — NỘI DUNG ĐÃ ĐỔI"); fi
  done

  if [ "${#MISM[@]}" -gt 0 ]; then
    printf '\n  ── bản sửa-tay KHÔNG còn nguyên sau khi kéo mã mới ──\n'
    printf '      %s\n' "${MISM[@]}"
    fail "5" "mã mới ĐÃ kéo về, nhưng bản sửa-tay trên VPS không còn nguyên. ĐƯỜNG LUI: bản vá đã sao lưu ở '${PATCH_PATH}'. Khôi phục bằng: git apply '${PATCH_PATH}'  (nếu bị từ chối, thử: git apply --3way '${PATCH_PATH}'). Đây là lỗi của SCRIPT, không phải của bạn — xin hãy báo lại kèm thông báo này."
  fi
  ok "${#KEPT[@]} tệp sửa-tay GIỮ NGUYÊN (đã đối chiếu vết băm sha256 trước/sau khi kéo)"
fi

# =============================================================================
# BƯỚC 6/7 — IN BẢN SẮP ĐƯỢC BUILD (để biết mình đang build lại cái gì)
# =============================================================================
step "BƯỚC 6/7 — bản sẽ được build"
git log -1 --stat --oneline | sed 's/^/  /'
ok "HEAD hiện tại: $(git rev-parse --short HEAD)"

# Nhắc lại những tệp KHÔNG được bản mới cập nhật, để log nói rõ "vì sao chúng còn khác bản mới".
# ⚠️ Không in lại danh sách đã in ở BƯỚC 4 khi rỗng — log sạch cho luồng thường ngày.
if [ "${#KEPT[@]}" -gt 0 ]; then
  printf '  ℹ %s tệp vẫn giữ bản sửa-tay (KHÔNG lấy bản mới) — sẽ luôn hiện là "thay đổi" trong git status:\n' "${#KEPT[@]}"
  printf '      %s\n' "${KEPT[@]}"
  printf '      (bản vá sao lưu: %s)\n' "${PATCH_PATH}"
fi

# =============================================================================
# BƯỚC 7/7 — GỌI deploy.sh (nguồn DUY NHẤT của logic kiểm chứng)
# =============================================================================
# ⚠️ KHÔNG chép lại 5 bước kiểm của deploy.sh vào đây — hai bản sao thì bản này chắc chắn lệch.
# ⚠️ Biến môi trường (SKIP_BUILD, POLL_ATTEMPTS, READY_ATTEMPTS…) tự truyền sang: tiến trình con
#    thừa hưởng môi trường của cha, nên KHÔNG cần export lại. `exec` thay thế tiến trình này bằng
#    deploy.sh ⇒ mã thoát của update.sh chính là mã thoát của deploy.sh (đúng như mong muốn).
step "BƯỚC 7/7 — bàn giao cho ./scripts/deploy.sh"
exec ./scripts/deploy.sh
