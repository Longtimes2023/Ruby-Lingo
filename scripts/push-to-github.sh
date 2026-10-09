#!/usr/bin/env bash
# =============================================================================
# RubyLingo — ĐẨY MÃ NGUỒN LÊN GITHUB (chạy trên MÁY DEV, không phải trên VPS)
# =============================================================================
#
# ⭐ VÌ SAO CÓ TỆP NÀY (chứ không chỉ gõ `git remote add` + `git push`):
#   `git push` là lệnh DUY NHẤT trong luồng deploy có thể đẩy dữ liệu TRẺ EM ra khỏi máy bạn,
#   và nó KHÔNG có bước hoàn tác rẻ tiền — xoá commit trên GitHub không xoá được bản sao mà
#   GitHub/người khác đã fetch. Ba đường hỏng dưới đây đều "im lặng": lệnh vẫn chạy, terminal
#   vẫn in chữ xanh, và bạn chỉ biết khi đã quá muộn.
#     • P1 — RÒ RỈ DỮ LIỆU: `data/` (DB SQLite chứa biệt danh + tiến độ của trẻ thật), `.env`
#            (SESSION_SECRET), `backups/` (bản sao DB) lọt lên GitHub. `.gitignore` đã chặn,
#            nhưng `git add -f` / một lần sửa `.gitignore` là đủ để vô hiệu hoá nó. BƯỚC 3 hỏi
#            thẳng GIT (nguồn chân lý) thay vì tin vào tệp cấu hình.
#     • P2 — ĐẨY VÀO REPO KHÔNG RỖNG: GitHub tạo repo kèm README ⇒ `git push` bị từ chối
#            (non-fast-forward) và người mới thường "sửa" bằng `--force`, tức là xoá mất commit
#            của chính mình. BƯỚC 6 phân biệt BA tình huống TRƯỚC khi push: remote chưa có nhánh
#            (push đầu) · remote là TỔ TIÊN của HEAD (fast-forward — trường hợp bình thường của
#            mọi lần cập nhật sau) · lịch sử không liên quan (mới là ca cần xử lý).
#            ⚠️ Bản đầu của BƯỚC 6 từ chối MỌI remote không rỗng ⇒ tự chặn chính mình ngay ở
#               lần push thứ hai. Đã sửa; đây là lý do phải kiểm bằng quan hệ tổ tiên, không
#               phải bằng "remote có rỗng hay không".
#     • P3 — PUSH "THÀNH CÔNG" NHƯNG KHÔNG CÓ GÌ LÊN: push vào sai remote/nhánh, hoặc bị chặn
#            giữa đường. BƯỚC 8 ĐỌC LẠI remote và so hash — chỉ khi hash khớp mới in "xong".
#
# ⚠️ SCRIPT NÀY KHÔNG CHẠY CI, KHÔNG BUILD. Nó chỉ nói về git. Việc kiểm chứng mã nằm ở
#    `npm run ci` (máy dev) và `./scripts/deploy.sh` (trên VPS) — mỗi việc một nguồn duy nhất.
#
# -----------------------------------------------------------------------------
# DÙNG (chạy từ gốc repo, trên MÁY DEV)
# -----------------------------------------------------------------------------
#   ./scripts/push-to-github.sh git@github.com:<user>/rubylingo.git
#   ./scripts/push-to-github.sh https://github.com/<user>/rubylingo.git
#   ./scripts/push-to-github.sh            # đã có remote origin ⇒ chỉ đẩy lên
#
#   # Tạo repo TRỐNG rồi đẩy luôn (cần PAT có scope `repo`/`Administration`):
#   GITHUB_TOKEN=ghp_xxx ./scripts/push-to-github.sh --create rubylingo
#
#   DRY_RUN=1 ./scripts/push-to-github.sh <url>   # kiểm tra hết, KHÔNG đẩy thật
#
# ⚠️ Hãy tạo repo ở trạng thái **TRỐNG** (không README, không .gitignore, không license).
#    Repo rỗng thì `git push -u origin main` là toàn bộ việc cần làm — không xung đột nào.
# =============================================================================

set -euo pipefail

# Đứng ở gốc repo DÙ được gọi từ đâu — cùng cách `deploy.sh`/`update.sh` làm.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DRY_RUN="${DRY_RUN:-0}"

# --- Tiện ích in ấn (GIỐNG deploy.sh/update.sh, để log đọc quen mắt) ----------
step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
ok()   { printf '\033[32m  ✓ %s\033[0m\n' "$1"; }
warn() { printf '\033[33m  ⚠ %s\033[0m\n' "$1"; }
info() { printf '    %s\n' "$1"; }

# `fail` in BƯỚC ĐANG ĐỎ + cách xử lý rồi THOÁT KHÁC 0 — không bao giờ "báo thành công" tiếp.
fail() {
  printf '\n\033[31m  ✗ BƯỚC %s THẤT BẠI: %s\033[0m\n\n' "$1" "$2"
  exit 1
}

# --- BƯỚC 0 — Đọc tham số ----------------------------------------------------
step "BƯỚC 0 — Đọc tham số"

URL=""
CREATE_NAME=""

case "${1:-}" in
  --create)
    CREATE_NAME="${2:-}"
    [ -n "$CREATE_NAME" ] || fail 0 "--create cần tên repo. Ví dụ: --create rubylingo"
    ;;
  "")
    ;;
  *)
    URL="$1"
    ;;
esac

if [ -n "$CREATE_NAME" ]; then
  [ -n "${GITHUB_TOKEN:-}" ] || fail 0 "--create cần biến môi trường GITHUB_TOKEN (PAT có scope tạo repo)."
  command -v curl >/dev/null 2>&1 || fail 0 "--create cần lệnh \`curl\`, máy này không có."
  ok "Sẽ tạo repo GitHub tên: $CREATE_NAME"
else
  ok "Tham số: ${URL:-(không có — dùng remote origin đang có)}"
fi

[ "$DRY_RUN" = "1" ] && warn "DRY_RUN=1 — sẽ kiểm tra toàn bộ nhưng KHÔNG đẩy thật."

# --- BƯỚC 1 — Đang ở trong một repo git có commit chưa? ----------------------
step "BƯỚC 1 — Kiểm tra repo cục bộ"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || fail 1 "Không phải repo git. Chạy từ gốc repo RubyLingo."

git rev-parse --verify HEAD >/dev/null 2>&1 \
  || fail 1 "Repo chưa có commit nào. Không có gì để đẩy."

BRANCH="$(git symbolic-ref --quiet --short HEAD)" \
  || fail 1 "Đang ở trạng thái detached HEAD. Chạy: git switch main"
ok "Nhánh hiện tại: $BRANCH"

if [ "$BRANCH" != "main" ]; then
  warn "Nhánh KHÔNG phải 'main' — vẫn đẩy được, nhưng VPS clone mặc định lấy 'main'."
fi

COMMIT_COUNT="$(git rev-list --count HEAD)"
LOCAL_HEAD="$(git rev-parse HEAD)"
ok "HEAD: ${LOCAL_HEAD:0:12} · $COMMIT_COUNT commit"
info "$(git log -1 --pretty='tác giả: %an <%ae> · %ad' --date=short)"

# --- BƯỚC 2 — Cây làm việc: cái gì ĐÃ commit mới lên được --------------------
step "BƯỚC 2 — Cây làm việc"

DIRTY="$(git status --porcelain --untracked-files=normal || true)"
if [ -z "$DIRTY" ]; then
  ok "Cây SẠCH — GitHub sẽ nhận ĐÚNG $COMMIT_COUNT commit ở trên, không hơn."
else
  warn "Cây có thay đổi CHƯA commit — chúng KHÔNG được đẩy lên:"
  printf '%s\n' "$DIRTY" | sed 's/^/      /' | head -20
  N_DIRTY="$(printf '%s\n' "$DIRTY" | wc -l | tr -d ' ')"
  [ "$N_DIRTY" -gt 20 ] && info "… và $((N_DIRTY - 20)) tệp nữa."
  info "Muốn đẩy cả những tệp này: git add -A && git commit -m '...' rồi chạy lại."
fi

# --- BƯỚC 3 — CHỐT HAI CHIỀU: không rò rỉ dữ liệu, VÀ không nuốt mã nguồn ---------
# Chiều 1: `.gitignore` chỉ là *ý định*; thứ quyết định là git có theo dõi tệp hay không. Một
#          lần `git add -f data/` là đủ để dữ liệu trẻ em lên GitHub mà cây vẫn "sạch" ở BƯỚC 2.
# Chiều 2 (⚠️ đã xảy ra thật 2026-10-09): một mẫu KHÔNG có `/` đầu khớp ở MỌI ĐỘ SÂU. `.gitignore`
#          ghi `data/` với ý "chặn thư mục DB ở gốc" đã nuốt luôn `src/data/` — 17 tệp, gồm cả
#          TOÀN BỘ nội dung từ vựng `src/data/levels/starters/**`. `git ls-files src/data/` trả về
#          0 tệp mà KHÔNG có cảnh báo nào, vì tệp bị ignore thì git im lặng. Bản clone sạch thiếu
#          tệp ⇒ `npm run typecheck` đỏ khó hiểu, `docker build` đỏ theo — còn máy dev thì xanh.
#          ⇒ Phép kiểm dưới đây là chiều NGƯỢC LẠI của BƯỚC 3 chiều 1, và không thể thiếu.
step "BƯỚC 3 — Chốt hai chiều: rò rỉ dữ liệu & nuốt mã nguồn"

FORBIDDEN=(.env data backups _verify dist dist-server node_modules asset-src/words/source)
LEAK=0
for p in "${FORBIDDEN[@]}"; do
  if git ls-files --error-unmatch -- "$p" >/dev/null 2>&1 \
     || [ -n "$(git ls-files -- "$p" 2>/dev/null)" ]; then
    printf '\033[31m      ✗ %s ĐANG ĐƯỢC GIT THEO DÕI\033[0m\n' "$p"
    LEAK=1
  fi
done

if [ "$LEAK" -eq 1 ]; then
  fail 3 "Có tệp CẤM đang được git theo dõi — ĐẨY LÊN GITHUB LÀ KHÔNG THỂ HOÀN TÁC. \
Bỏ theo dõi (KHÔNG xoá tệp trên đĩa): git rm -r --cached <đường-dẫn> && git commit -m 'chore: bỏ theo dõi dữ liệu cục bộ'"
fi
ok "Chiều 1: 8/8 đường dẫn cấm đều KHÔNG bị git theo dõi."

NUOT="$(git status --ignored --porcelain 2>/dev/null | grep '^!!' | awk '{print $2}' \
        | grep -E '^(src|shared|server|public|scripts|tests|deploy)/' || true)"
if [ -n "$NUOT" ]; then
  printf '\033[31m      ✗ .gitignore đang NUỐT các thư mục MÃ NGUỒN sau:\033[0m\n'
  printf '%s\n' "$NUOT" | sed 's/^/        /' | head -20
  fail 3 "Bản clone sạch (CI, VPS) sẽ THIẾU những tệp này ⇒ typecheck/build đỏ khó hiểu. \
Nguyên nhân gần như luôn là một mẫu trong .gitignore THIẾU dấu '/' đầu dòng — mẫu không có '/' \
khớp ở MỌI độ sâu (vd 'data/' nuốt luôn 'src/data/'). Sửa: thêm '/' đầu dòng cho mẫu đó, \
kiểm bằng: git check-ignore -v <đường-dẫn>"
fi
ok "Chiều 2: không thư mục mã nguồn nào bị .gitignore nuốt."

# --- BƯỚC 4 — Tạo repo GitHub (chỉ khi --create) ----------------------------
if [ -n "$CREATE_NAME" ]; then
  step "BƯỚC 4 — Tạo repo TRỐNG trên GitHub"

  API="https://api.github.com/user/repos"
  BODY="{\"name\":\"${CREATE_NAME}\",\"private\":true,\"has_issues\":true,\"has_wiki\":false,\"auto_init\":false}"
  info "POST $API  (private=true, auto_init=false ⇒ repo TRỐNG, không README)"

  if [ "$DRY_RUN" = "1" ]; then
    warn "DRY_RUN — bỏ qua việc tạo repo."
  else
    RESP="$(curl -sS -X POST "$API" \
      -H "Authorization: Bearer ${GITHUB_TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      -d "$BODY" -w '\n%{http_code}')" || fail 4 "Không gọi được api.github.com (mạng?)."

    CODE="$(printf '%s' "$RESP" | tail -n1)"
    JSON="$(printf '%s' "$RESP" | sed '$d')"

    case "$CODE" in
      201) ok "Đã tạo repo private: $(printf '%s' "$JSON" | sed -n 's/.*"clone_url": *"\([^"]*\)".*/\1/p')" ;;
      422) warn "Repo tên '$CREATE_NAME' đã tồn tại — dùng luôn repo đó." ;;
      401|403) fail 4 "PAT bị từ chối (HTTP $CODE). Kiểm scope: cần quyền tạo repo (Administration: Read and write)." ;;
      *) fail 4 "GitHub trả HTTP $CODE: $(printf '%s' "$JSON" | head -c 300)" ;;
    esac
  fi
else
  step "BƯỚC 4 — Bỏ qua tạo repo (không dùng --create)"
  ok "Giả định repo GitHub ĐÃ tồn tại."
fi

# --- BƯỚC 5 — Gắn remote `origin` -------------------------------------------
step "BƯỚC 5 — Gắn remote origin"

if [ -n "$URL" ]; then
  if git remote get-url origin >/dev/null 2>&1; then
    OLD="$(git remote get-url origin)"
    if [ "$OLD" = "$URL" ]; then
      ok "origin đã trỏ đúng: $OLD"
    else
      warn "origin đang là: $OLD"
      info "Cập nhật thành: $URL"
      [ "$DRY_RUN" = "1" ] || git remote set-url origin "$URL"
      ok "Đã cập nhật origin."
    fi
  else
    [ "$DRY_RUN" = "1" ] || git remote add origin "$URL"
    ok "Đã thêm origin = $URL"
  fi
else
  git remote get-url origin >/dev/null 2>&1 \
    || fail 5 "Chưa có remote origin. Truyền URL: ./scripts/push-to-github.sh <url-repo>"
  URL="$(git remote get-url origin)"
  ok "Dùng origin đang có: $URL"
fi

# --- BƯỚC 6 — Remote có tới được không, và có RỖNG không? -------------------
step "BƯỚC 6 — Kiểm tra remote TRƯỚC khi push"

if ! REMOTE_HEADS="$(git ls-remote --heads origin 2>&1)"; then
  fail 6 "Không đọc được remote. Ba nguyên nhân thường gặp:
      1. Repo CHƯA được tạo trên GitHub  → tạo repo TRỐNG rồi chạy lại.
      2. URL sai (thiếu .git, sai tên user/repo).
      3. Chưa có quyền/xác thực → máy dev cần đăng nhập GitHub (Git Credential Manager
         sẽ hiện cửa sổ đăng nhập ở lần push đầu), hoặc dùng deploy key.
      Chi tiết git trả về: ${REMOTE_HEADS}"
fi

# Nhánh ta sắp đẩy có đang tồn tại trên remote không, và nếu có thì push này là loại gì?
REMOTE_HASH="$(printf '%s\n' "$REMOTE_HEADS" | awk -v b="refs/heads/$BRANCH" '$2 == b { print $1 }')"

if [ -z "$REMOTE_HASH" ]; then
  ok "Remote chưa có nhánh '$BRANCH' — đây là push ĐẦU TIÊN, không thể xung đột."
else
  info "Remote '$BRANCH' đang ở: ${REMOTE_HASH:0:12}"

  # Cần có commit đó trong máy mới so được quan hệ tổ tiên. Lần push thứ hai trở đi thì thường
  # đã có; nếu chưa (máy mới clone, hoặc vừa fetch xong ở nơi khác) thì fetch đúng nhánh đó.
  if ! git cat-file -e "${REMOTE_HASH}^{commit}" 2>/dev/null; then
    info "Chưa có commit đó ở máy — fetch nhánh '$BRANCH' để so được quan hệ."
    git fetch --quiet origin "$BRANCH" || fail 6 "Không fetch được nhánh '$BRANCH' từ origin."
  fi

  if git merge-base --is-ancestor "$REMOTE_HASH" "$LOCAL_HEAD" 2>/dev/null; then
    # ⭐ ĐÂY LÀ TRƯỜNG HỢP BÌNH THƯỜNG của mọi lần push thứ hai trở đi. Bản đầu của script này
    #    từ chối MỌI remote không rỗng — tức là tự chặn chính mình ở lần cập nhật đầu tiên.
    AHEAD="$(git rev-list --count "$REMOTE_HASH..$LOCAL_HEAD")"
    ok "FAST-FORWARD: remote là TỔ TIÊN của HEAD cục bộ ⇒ push chỉ TIẾN THẲNG."
    info "Sẽ đẩy thêm $AHEAD commit, không ghi đè lịch sử của ai."
  elif git merge-base --is-ancestor "$LOCAL_HEAD" "$REMOTE_HASH" 2>/dev/null; then
    fail 6 "Remote ĐI TRƯỚC cục bộ (remote ${REMOTE_HASH:0:12} chứa HEAD ${LOCAL_HEAD:0:12}). \
Đẩy lên sẽ bị từ chối. Trước hết: git pull --ff-only origin $BRANCH"
  else
    warn "Remote KHÔNG rỗng và lịch sử KHÔNG LIÊN QUAN — đã có nhánh:"
    printf '%s\n' "$REMOTE_HEADS" | sed 's/^/      /'
    fail 6 "Push sẽ bị TỪ CHỐI (non-fast-forward). \
ĐỪNG dùng --force (sẽ xoá commit của chính bạn). Cách sạch nhất: xoá repo trên GitHub, \
tạo lại ở trạng thái TRỐNG (không README/.gitignore/license), rồi chạy lại script này."
  fi
fi

# --- BƯỚC 7 — Đẩy -----------------------------------------------------------
step "BƯỚC 7 — Đẩy lên GitHub"

if [ "$DRY_RUN" = "1" ]; then
  warn "DRY_RUN — KHÔNG đẩy. Lệnh thật sẽ là: git push -u origin $BRANCH"
else
  info "git push -u origin $BRANCH  (lần đầu có thể hiện cửa sổ đăng nhập GitHub)"
  git push -u origin "$BRANCH" || fail 7 "Push thất bại — xem thông báo của git ở trên."
  ok "Đã đẩy."
fi

# --- BƯỚC 8 — KIỂM CHỨNG: đọc lại remote và so hash -------------------------
# "Push xong" chỉ là git nói; bằng chứng là hash trên remote TRÙNG hash cục bộ.
step "BƯỚC 8 — Kiểm chứng bằng hash (không tin lời git)"

if [ "$DRY_RUN" = "1" ]; then
  warn "DRY_RUN — bỏ qua kiểm chứng."
  printf '\n\033[1m▶ Kết thúc (DRY_RUN). Chưa có gì được đẩy lên GitHub.\033[0m\n\n'
  exit 0
fi

REMOTE_LINE="$(git ls-remote --heads origin "$BRANCH" 2>/dev/null || true)"
REMOTE_HASH="$(printf '%s' "$REMOTE_LINE" | awk '{print $1}')"

[ -n "$REMOTE_HASH" ] \
  || fail 8 "Không thấy nhánh '$BRANCH' trên remote sau khi push. Kiểm bằng: git ls-remote --heads origin"

if [ "$REMOTE_HASH" = "$LOCAL_HEAD" ]; then
  ok "Hash TRÙNG KHỚP: ${LOCAL_HEAD:0:12}"
else
  fail 8 "Hash LỆCH — remote ${REMOTE_HASH:0:12} ≠ cục bộ ${LOCAL_HEAD:0:12}. Có thể đã đẩy nhầm nhánh."
fi

# --- BƯỚC 9 — Bước tiếp theo -------------------------------------------------
step "BƯỚC 9 — Việc tiếp theo"

printf '    1) Trên VPS (MỘT LẦN):\n'
printf '         sudo git clone %s /srv/rubylingo\n' "$URL"
printf '         cd /srv/rubylingo && cp .env.example .env && nano .env\n'
printf '         sudo ./scripts/deploy.sh\n'
printf '    2) Mỗi lần cập nhật sau:  sửa ở máy dev → push → trên VPS chạy\n'
printf '         ./scripts/update.sh\n'
printf '    3) Cho VPS quyền đọc repo private (deploy key hoặc PAT): xem deploy/README.md §5.\n'

printf '\n\033[32m\033[1m▶ XONG — mã nguồn đã ở GitHub, đã kiểm chứng bằng hash.\033[0m\n\n'
