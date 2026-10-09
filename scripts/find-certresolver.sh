#!/usr/bin/env bash
# =============================================================================
# TÌM TÊN `certresolver` THẬT CỦA TRAEFIK — chạy TRÊN VPS. CHỈ ĐỌC, không sửa gì.
# =============================================================================
# VÌ SAO TỆP NÀY TỒN TẠI (2026-10-09):
#   Tài liệu cũ chỉ dẫn ĐÚNG MỘT cách tìm tên resolver:
#       docker inspect traefik --format '{{json .Config.Cmd}}' | tr ',' '\n' | grep -i certresolvers
#   Trên VPS thật của người dùng, lệnh đó **TRẢ VỀ RỖNG** — và anh ấy kết luận "chắc là
#   mytlschallenge". Đó là ĐOÁN, không phải KIỂM.
#
#   Lệnh cũ chỉ đúng khi Traefik cấu hình bằng CỜ DÒNG LỆNH:
#       command: ["--certificatesresolvers.<TÊN>.acme.email=…"]
#   Cấu hình TĨNH nằm trong `traefik.yml`/`traefik.toml` (rất phổ biến) thì `.Config.Cmd` KHÔNG
#   chứa chuỗi đó ⇒ lệnh im lặng không ra gì. Một hướng dẫn "không ra gì" mà không nói vì sao là
#   thứ đã trực tiếp gây ra sự cố này.
#
#   Mức độ nguy hiểm của việc đoán sai: tên resolver SAI vẫn tạo ra router HỢP LỆ — compose xanh,
#   container chạy, `/api/health` trả "ok" — Traefik chỉ LẶNG LẼ không xin được chứng chỉ ⇒ HTTPS
#   chết, và vì router HTTP đá sang HTTPS nên site coi như chết. `deploy.sh` bước 5 khi đó đỏ với
#   thông báo "Traefik không tới được app" ⇒ người trực đi kiểm cổng/mạng — CHỈ SAI CHỖ CẦN SỬA.
#
# ⚠️⚠️ NGUYÊN TẮC THIẾT KẾ — ĐỌC TRƯỚC KHI SỬA TỆP NÀY:
#   **IN NGUYÊN VĂN MỌI PHÉP DÒ**, kể cả khi phép dò không tìm thấy gì. Xấu nhất là ỒN, nhưng người
#   dùng LUÔN thấy được: đã hỏi cái gì, máy trả lời cái gì, và vì sao chưa kết luận được.
#   Tuyệt đối KHÔNG rút gọn thành "không tìm thấy" rồi im — đó chính là bệnh đang đi chữa.
#
# ⚠️ CỐ Ý KHÔNG dùng `set -e`: đây là công cụ DÒ, mỗi phép dò hỏng thì ghi nhận rồi đi tiếp.
#    Dừng ở phép dò đầu tiên là tự bịt mắt mình. Và mọi phép gán `X="$(… | grep …)"` đều có
#    `|| true` — thiếu nó thì `pipefail` giết script ngay tại dòng đó, IM LẶNG (đúng bẫy đã làm
#    `deploy.sh` chết ở bước 1 cùng ngày).
#
# CÁCH DÙNG:
#   ./scripts/find-certresolver.sh            # báo cáo đầy đủ — KHUYÊN DÙNG
#   ./scripts/find-certresolver.sh --quiet    # chỉ in tên CHẮC CHẮN, cho script khác gọi
#
# MÃ THOÁT (chỉ có ý nghĩa ở chế độ `--quiet`):
#   0 = tìm được ĐÚNG MỘT tên chắc chắn (đã in ra)   · 3 = không tìm được tên chắc chắn nào
#   4 = tìm được NHIỀU tên chắc chắn (nhập nhằng)     · 2 = thiếu `docker`
# =============================================================================

set -uo pipefail

QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
FOUND="$WORK/found.tsv"   # TÊN <TAB> NGUỒN <TAB> MỨC
: > "$FOUND"

# --- In ấn -------------------------------------------------------------------------------------
# ⚠️ Ở chế độ `--quiet`, MỌI hàm in đều thoát ngay ⇒ không thể lọt chữ nào ra stdout.
say()   { [ "$QUIET" -eq 1 ] && return 0; printf '%s\n' "$*"; }
head1() { [ "$QUIET" -eq 1 ] && return 0; printf '\n\033[1m── %s\033[0m\n' "$*"; }
# ⚠️ `raw` dùng VÒNG LẶP BASH chứ không `sed 's/^/    | /'`: tệp này gọi nó ~10 lần mỗi lượt, và
#    mỗi `sed` là một tiến trình con. Trên máy bị giới hạn số tiến trình, bản dùng `sed` bị
#    SIGTERM giữa chừng — bài học đã gặp với `xargs`. Vòng lặp bash không sinh tiến trình nào.
raw() {
  [ "$QUIET" -eq 1 ] && return 0
  local line
  while IFS= read -r line; do printf '    | %s\n' "$line"; done
}
# ⚠️ `printf '%s\n' "$*"` chứ KHÔNG `printf "$*"`: chuỗi có `%` (vd `%{json}`) sẽ làm printf hiểu
#    sai định dạng — lỗi đã từng gặp trong chính dự án này.
note()  { printf '%s\t%s\t%s\n' "$1" "$2" "$3" >> "$FOUND"; }

# Trích MỌI tên resolver có trong một khối văn bản — MỘT lần `awk` cho CẢ BỐN dạng thật của Traefik:
#   • cờ dòng lệnh  : `--certificatesresolvers.<TÊN>.acme.email=…`
#   • biến môi trường: `TRAEFIK_CERTIFICATESRESOLVERS_<TÊN>_ACME_EMAIL=…`
#   • TOML          : `[certificatesResolvers.<TÊN>.acme]`
#   • YAML dạng khối: dòng `certificatesResolvers:` rồi dòng thụt lề `<TÊN>:`
#
# ⚠️⚠️ HAI BẪY ĐÃ TRẢ GIÁ NGAY KHI VIẾT TỆP NÀY — đọc trước khi sửa:
#   1) KHÔNG lọc bằng `grep -i certresolv`. Trong `CERTIFICATESRESOLVERS` các ký tự là
#      `…T-E-S-R-E-S-O-L-V-E-R-S…` — **chuỗi `certresolv` KHÔNG hề xuất hiện** ⇒ bộ lọc trượt sạch
#      mà không báo gì. Đúng y cái bệnh mà tệp này sinh ra để chữa.
#   2) Dạng YAML khối KHÔNG có dấu `.`/`_` sau `certificatesResolvers` (chỉ có `:`) ⇒ mọi regex đòi
#      dấu phân cách đều trượt. Phải xử lý riêng bằng trạng thái "dòng trước là tiêu đề".
#   Và phải BỎ TIỀN TỐ `certificatesresolvers` (21 ký tự) — thiếu bước đó thì tên in ra là
#   `certificatesresolvers.mytlschallenge` thay vì `mytlschallenge`.
#
# ⚠️ Dùng `tolower()` CHỈ để TÌM, không để TRÍCH: tên biến môi trường là chữ HOA
#    (`…RESOLVERS_LEPROD_…`) nên trích từ bản đã hạ chữ thường sẽ trả về sai chữ.
scan_names() {
  awk '
    {
      line = $0
      low  = tolower(line)

      # --- Dạng YAML khối ---
      if (low ~ /^[[:space:]]*certificatesresolvers[[:space:]]*:[[:space:]]*$/) { yb = 1; next }
      if (yb == 1) {
        if (line ~ /^[[:space:]]+[A-Za-z0-9_-]+[[:space:]]*:/) {
          t = line
          sub(/^[[:space:]]+/, "", t)
          sub(/[[:space:]]*:.*/, "", t)
          if (t != "") print t
        }
        yb = 0
      }

      # --- Dạng phẳng (cờ / env / TOML / YAML một dòng) ---
      s = line
      while (1) {
        p = index(tolower(s), "certificatesresolvers")
        if (p == 0) break
        rest = substr(s, p + 21)
        sep  = substr(rest, 1, 1)
        if (sep == "." || sep == "_") {
          body = substr(rest, 2)
          if (match(body, /^[A-Za-z0-9_.-]+/) && RLENGTH > 0) {
            name = substr(body, 1, RLENGTH)
            # Ranh giới ưu tiên là ngay TRƯỚC `acme` — nhờ vậy tên có chứa `_` vẫn giữ nguyên.
            if (match(tolower(name), /[._]acme([._]|$)/)) { name = substr(name, 1, RSTART - 1) }
            else                                          { sub(/[._].*$/, "", name) }
            if (name != "") print name
          }
        }
        s = rest
      }
    }
  ' 2>/dev/null | sort -u || true
}

# Ghi nhận tên tìm được trong một tệp cấu hình. $1 = nội dung tệp, $2 = nhãn nguồn (để in).
scan_file_content() {
  local content="$1" source="$2" one
  printf '%s\n' "$content" | scan_names | while IFS= read -r one; do
    [ -n "$one" ] || continue
    note "$one" "$source" "CAO"
    say "      ✓ tên: ${one}   (${source})"
  done
}

command -v docker >/dev/null 2>&1 || {
  say "KHÔNG có lệnh 'docker' trên máy này — script phải chạy TRÊN VPS (nơi có Traefik)."
  exit 2
}

# =============================================================================
head1 "0) Quyền dùng docker"
# ⚠️ Kiểm ngay: nếu tài khoản không thuộc nhóm `docker`, MỌI phép dò dưới đây sẽ trả về lỗi quyền
#    và ta sẽ tưởng "không có gì" — đúng cái bẫy im lặng cần tránh.
DOCKER_PROBE="$(docker ps --quiet 2>&1 | head -n1 || true)"
if printf '%s' "$DOCKER_PROBE" | grep -qi 'permission denied'; then
  say "✗ 'docker ps' bị TỪ CHỐI QUYỀN: ${DOCKER_PROBE}"
  say "  ⇒ Chạy lại bằng: sudo $0 ${1:-}     (hoặc thêm mình vào nhóm docker rồi đăng nhập lại)"
  exit 2
fi
say "✓ gọi được docker"

# =============================================================================
head1 "1) Tìm container Traefik"
PS_OUT="$(docker ps --format '{{.Names}}\t{{.Image}}' 2>&1 || true)"
say "lệnh: docker ps --format '{{.Names}}\t{{.Image}}'"
printf '%s\n' "$PS_OUT" | raw
# ⚠️ Khớp cả TÊN lẫn IMAGE (nhiều bản đặt tên container là `traefik-v2`, `reverse-proxy`… nhưng
#    image vẫn là `traefik`). `tolower` để không phụ thuộc chữ hoa/thường.
TRAEFIK_CONTAINERS="$(printf '%s\n' "$PS_OUT" | awk -F'\t' 'tolower($0) ~ /traefik/ {print $1}' || true)"
if [ -z "$TRAEFIK_CONTAINERS" ]; then
  say "✗ KHÔNG có container nào có tên hoặc image chứa 'traefik'."
  say "  ⇒ Traefik có thể chạy bằng systemd (không phải Docker). Khi đó tệp cấu hình TĨNH nằm"
  say "    trên máy: thử  sudo grep -rl 'certificatesResolvers' /etc/traefik/ 2>/dev/null"
else
  say "→ ứng viên: $(printf '%s' "$TRAEFIK_CONTAINERS" | tr '\n' ' ')"
fi

# =============================================================================
for c in $TRAEFIK_CONTAINERS; do
  head1 "2) Container '${c}' — cờ dòng lệnh, biến môi trường"

  CMD_JSON="$(docker inspect "$c" --format '{{json .Config.Cmd}}' 2>&1 || true)"
  say "lệnh: docker inspect ${c} --format '{{json .Config.Cmd}}'"
  printf '%s\n' "$CMD_JSON" | raw
  CMD_NAMES="$(printf '%s\n' "$CMD_JSON" | scan_names || true)"
  if [ -n "$CMD_NAMES" ]; then
    printf '%s\n' "$CMD_NAMES" | while IFS= read -r one; do
      [ -n "$one" ] || continue
      note "$one" "cờ dòng lệnh của '${c}'" "CAO"
      say "      ✓ tên: ${one}   (cờ dòng lệnh của '${c}')"
    done
  else
    say "      (không có 'certificatesresolvers' trong cờ dòng lệnh — BÌNH THƯỜNG nếu Traefik"
    say "       cấu hình bằng tệp; xem mục 3)"
  fi

  ENV_JSON="$(docker inspect "$c" --format '{{json .Config.Env}}' 2>&1 || true)"
  say "lệnh: docker inspect ${c} --format '{{json .Config.Env}}'  (lọc dòng có 'certificatesresolvers')"
  # ⚠️ Bộ lọc là `certificatesresolvers|certresolver` — KHÔNG phải `certresolv` (xem ghi chú ở
  #    `scan_names`: `CERTIFICATESRESOLVERS` không chứa chuỗi `certresolv` ⇒ lọc sai là trượt sạch).
  ENV_HITS="$(printf '%s\n' "$ENV_JSON" | tr ',' '\n' | grep -iE 'certificatesresolvers|certresolver' | head -n5 || true)"
  if [ -n "$ENV_HITS" ]; then
    printf '%s\n' "$ENV_HITS" | raw
    printf '%s\n' "$ENV_HITS" | scan_names | while IFS= read -r one; do
      [ -n "$one" ] || continue
      note "$one" "biến môi trường của '${c}'" "CAO"
      say "      ✓ tên: ${one}   (biến môi trường của '${c}')"
    done
  else
    say "      (không có biến môi trường nào chứa 'certificatesresolvers')"
  fi

  # ---------------------------------------------------------------------------
  head1 "3) Container '${c}' — TỆP CẤU HÌNH TĨNH (nguồn phổ biến nhất)"
  # Đường dẫn tệp cấu hình TRONG container: lấy từ `--configFile=` nếu có, nếu không thì thử các
  # đường dẫn mặc định của Traefik. Đây là chỗ mà lệnh cũ trong tài liệu đã bỏ sót hoàn toàn.
  CFG_IN="$(printf '%s\n' "$CMD_JSON" | grep -oE '\-\-configFile=[^",]+' | head -n1 | cut -d= -f2 || true)"
  CANDIDATES=""
  [ -n "$CFG_IN" ] && CANDIDATES="$CFG_IN"
  CANDIDATES="${CANDIDATES} /etc/traefik/traefik.yml /etc/traefik/traefik.yaml /etc/traefik/traefik.toml"
  # ⚠️ Khử trùng lặp: đường dẫn từ `--configFile=` thường CŨNG nằm trong danh sách mặc định ⇒ không
  #    khử thì cùng một tệp bị dò hai lần, báo cáo trông như tìm thấy hai nguồn khác nhau.
  SEEN=""
  for p in $CANDIDATES; do
    case " ${SEEN} " in *" ${p} "*) continue ;; esac
    SEEN="${SEEN} ${p}"
    content="$(docker exec "$c" cat "$p" 2>/dev/null || true)"
    if [ -z "$content" ]; then
      say "    · ${p}  → không đọc được (không có tệp, hoặc Traefik không phải container này)"
      continue
    fi
    say "    · ${p}  → ĐỌC ĐƯỢC ($(printf '%s\n' "$content" | wc -l | tr -d ' ') dòng), tìm 'certificatesResolvers':"
    printf '%s\n' "$content" | grep -i -n -A 3 'certificatesresolvers' | raw || true
    scan_file_content "$content" "tệp ${p} trong '${c}'"
  done

  # ---------------------------------------------------------------------------
  head1 "4) Container '${c}' — tệp cấu hình MOUNT TỪ HOST"
  # ⚠️ Đọc phía HOST là lưới an toàn: kể cả khi `docker exec cat` không đọc được (image tối giản,
  #    tệp nằm ngoài đường dẫn mặc định), tệp vẫn thường hiện diện trên đĩa qua bind-mount.
  MOUNTS_JSON="$(docker inspect "$c" --format '{{json .Mounts}}' 2>&1 || true)"
  say "lệnh: docker inspect ${c} --format '{{json .Mounts}}'"
  printf '%s\n' "$MOUNTS_JSON" | raw
  SRC_LIST="$(printf '%s\n' "$MOUNTS_JSON" | grep -oE '"Source":"[^"]+"' | sed -E 's/^"Source":"//; s/"$//' || true)"
  if [ -z "$SRC_LIST" ]; then
    say "    (không có mount nào)"
  fi
  printf '%s\n' "$SRC_LIST" | while IFS= read -r src; do
    [ -n "$src" ] || continue
    if [ -f "$src" ]; then
      case "$src" in
        *.yml|*.yaml|*.toml|*.conf|*traefik*)
          content="$(cat "$src" 2>/dev/null || true)"
          say "    · ${src} (tệp, HOST) → $(printf '%s\n' "$content" | grep -ci 'certificatesresolvers' || true) dòng khớp"
          printf '%s\n' "$content" | grep -i -n -A 3 'certificatesresolvers' | raw || true
          scan_file_content "$content" "tệp HOST ${src}"
          ;;
        *)
          say "    · ${src} (tệp, HOST) → bỏ qua (không phải tệp cấu hình)"
          ;;
      esac
    elif [ -d "$src" ]; then
      hits="$(find "$src" -maxdepth 2 -type f \( -name '*.yml' -o -name '*.yaml' -o -name '*.toml' \) 2>/dev/null | head -n 5 || true)"
      if [ -n "$hits" ]; then
        say "    · ${src} (thư mục, HOST) → tệp cấu hình tìm thấy:"
        printf '%s\n' "$hits" | raw
        printf '%s\n' "$hits" | while IFS= read -r hf; do
          [ -f "$hf" ] || continue
          content="$(cat "$hf" 2>/dev/null || true)"
          scan_file_content "$content" "tệp HOST ${hf}"
        done
      else
        say "    · ${src} (thư mục, HOST) → không có .yml/.yaml/.toml trong 2 tầng đầu"
      fi
    else
      say "    · ${src} → không tồn tại trên host (socket hoặc mount lạ)"
    fi
  done
done

# =============================================================================
head1 "5) Nhãn 'tls.certresolver' của MỌI container (MANH MỐI — không phải bằng chứng)"
# ⚠️ Đây chỉ là suy đoán CÓ CĂN CỨ: nếu các service khác đang chạy tốt với HTTPS và đều ghi
#    `tls.certresolver=X` thì X rất có thể đúng. Nhưng nếu chúng cũng đang sai thì chúng cũng đang
#    chết HTTPS mà chưa ai biết — nên KHÔNG được xếp vào mức "chắc chắn".
LBL="$(docker ps -q 2>/dev/null | xargs -r docker inspect --format '{{json .Config.Labels}}' 2>/dev/null \
  | grep -oiE 'certresolver[=:][A-Za-z0-9_-]+' | sed -E 's/^[^=:]*[=:]//' | sort -u || true)"
if [ -n "$LBL" ]; then
  printf '%s\n' "$LBL" | raw
  printf '%s\n' "$LBL" | while IFS= read -r one; do
    [ -n "$one" ] || continue
    note "$one" "nhãn của container khác" "THẤP"
  done
else
  say "  (không container nào ghi nhãn 'tls.certresolver')"
fi

# =============================================================================
head1 "KẾT LUẬN"
HIGH="$(awk -F'\t' '$3=="CAO"{print $1}' "$FOUND" | sort -u || true)"
LOW="$(awk -F'\t' '$3!="CAO"{print $1}' "$FOUND" | sort -u || true)"

if [ "$QUIET" -eq 1 ]; then
  N_HIGH="$(printf '%s\n' "$HIGH" | grep -c . || true)"
  if [ "$N_HIGH" -eq 1 ]; then printf '%s\n' "$HIGH"; exit 0; fi
  if [ "$N_HIGH" -eq 0 ]; then exit 3; fi
  printf '%s\n' "$HIGH"; exit 4
fi

if [ -z "$HIGH" ]; then
  printf '\n\033[33m  ✗ KHÔNG tìm được tên resolver nào từ CẤU HÌNH TĨNH của Traefik.\033[0m\n'
  printf '    Điều này KHÔNG có nghĩa "không có resolver" — nó có nghĩa các phép dò ở trên đều không\n'
  printf '    khớp. Hãy đọc lại phần "nguyên văn đầu ra" phía trên để tự tìm, hoặc:\n'
  printf '      • Traefik chạy bằng systemd (không phải Docker)?\n'
  printf '          sudo grep -rl "certificatesResolvers" /etc/traefik/ 2>/dev/null\n'
  printf '      • Tìm thẳng trên đĩa:\n'
  printf '          sudo grep -rn "certificatesResolvers" /etc /opt /root /home 2>/dev/null | head\n'
  printf '      • Traefik KHÔNG dùng ACME (chứng chỉ nạp sẵn / do dịch vụ khác cấp)? Khi đó nhãn\n'
  printf '        "tls.certresolver" là VÔ NGHĨA và nên bỏ hẳn khỏi docker-compose.yml.\n'
  [ -n "$LOW" ] && printf '    Manh mối (độ tin cậy THẤP): %s\n' "$(printf '%s' "$LOW" | tr '\n' ' ')"
  printf '\n'
  exit 3
fi

printf '\n  Tên resolver tìm được (CHẮC CHẮN — đọc từ cấu hình TĨNH của Traefik):\n'
printf '%s\n' "$HIGH" | while IFS= read -r one; do
  [ -n "$one" ] || continue
  printf '    \033[32m%s\033[0m\n' "$one"
  awk -F'\t' -v n="$one" '$1==n {printf "        ← %s (%s)\n", $2, $3}' "$FOUND"
done
if [ -n "$LOW" ]; then
  printf '\n  Manh mối khác (THẤP — nhãn của container khác, KHÔNG dùng để kết luận): %s\n' \
    "$(printf '%s' "$LOW" | tr '\n' ' ')"
fi
printf '\n  Điền vào .env trên VPS:\n'
printf '      TRAEFIK_CERTRESOLVER=%s\n' "$(printf '%s\n' "$HIGH" | head -n1)"
printf '  (Nhiều tên ở trên ⇒ Traefik có nhiều resolver; dùng tên đang phục vụ tên miền của bạn.)\n\n'
