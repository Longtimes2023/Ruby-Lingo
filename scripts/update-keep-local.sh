#!/usr/bin/env bash
# =============================================================================
# RubyLingo — CẬP NHẬT VPS **MÀ GIỮ NGUYÊN CÁC TỆP ĐANG SỬA TAY** (lệnh gõ hằng ngày)
# =============================================================================
# Đây là TỆP MỎNG, cố ý: nó KHÔNG chứa logic. Toàn bộ việc nặng nề nằm ở `scripts/update.sh`
# (một nguồn sự thật duy nhất). Hai bản sao của cùng một quy trình thì bản này sẽ lệch — và lệch
# theo hướng tệ nhất: "tưởng là đã kiểm". Nên ở đây chỉ có ĐÚNG MỘT việc: bật cờ rồi giao lại.
#
# ⭐ VÌ SAO CÓ TỆP NÀY:
#   Trên VPS có vài tệp ĐƯỢC SỬA TAY CỐ Ý (ví dụ tham số riêng của máy chủ trong
#   `docker-compose.yml`). Mỗi lần cập nhật mã mới, `update.sh` cũ — đúng theo thiết kế an toàn
#   của nó — sẽ DỪNG và bắt người chạy tự xử lý cây làm việc. Làm tay vài lần thì mệt, và thao tác
#   tay lặp lại là thứ dễ sai nhất.
#   Tệp này biến việc đó thành MỘT lệnh, không hỏi gì:
#
#       ./scripts/update-keep-local.sh
#
#   Nó sẽ: tự dò tệp đang sửa tay → SAO LƯU bản vá (backups/keep-local/) → kéo mã mới → ĐỐI CHIẾU
#   VẾT BĂM để CHỨNG MINH các tệp sửa-tay vẫn nguyên → rebuild + 5 bước kiểm của `deploy.sh`.
#
#   ⚠️ Nếu bản mới CŨNG sửa đúng một trong các tệp đó thì KHÔNG thể giữ cả hai — script DỪNG và nói
#      rõ. Đó là việc của con người, không phải thứ nên tự quyết thay bạn.
#   ⚠️ Chi tiết + vì sao cách này KHÔNG tạo cửa sổ mất dữ liệu: xem khối comment ở BƯỚC 4 của
#      `scripts/update.sh`.
#
#   Muốn thêm tiện ích khác: `FORCE=1 ./scripts/update-keep-local.sh` (build lại dù không có commit
#   mới), `SKIP_BUILD=1 …` (dùng image đang có), `KEEP_LOCAL_MAX=<n> …` (nâng trần 10 tệp).
# =============================================================================

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ⚠️ Kiểm trước, báo rõ — thay vì để bash nổ "No such file or directory" khô khan.
if [ ! -f "${HERE}/update.sh" ]; then
  printf '\n\033[31m  ✗ Không thấy %s/update.sh — tệp này phải nằm CÙNG thư mục scripts/ với nó.\033[0m\n\n' "${HERE}"
  exit 1
fi

# ⭐ ĐIỂM DUY NHẤT CỦA TỆP NÀY. `export` (không phải tiền tố `VAR=… exec`) để biến chắc chắn đi
#    theo qua mọi lớp exec.
export KEEP_LOCAL=1

# ⚠️ `exec` chứ KHÔNG gọi rồi `exit $?`: nhờ vậy mã thoát của lệnh này CHÍNH LÀ mã thoát của
#    `update.sh` (không có lớp nào nuốt mã lỗi), và tín hiệu (Ctrl-C) tới thẳng tiến trình đang chạy.
exec "${HERE}/update.sh" "$@"
