-- =============================================================================
-- 014 — XÁC NHẬN PHẦN NÓI CỦA PHỤ HUYNH (TẦNG 4): ĐỒNG BỘ LÊN SERVER
-- =============================================================================
-- Một bảng, MỘT hàng cho mỗi bé: rubric 4 mục Nói mà bố/mẹ tự đánh dấu sau khi nghe con nói.
-- Trước đây thứ này chỉ nằm trong `localStorage` của từng máy — đổi máy là mất, và anh/chị/em
-- trong nhà không thấy được xác nhận của nhau. Nay nó là dữ liệu CỦA HỒ SƠ BÉ như mọi thứ khác.
--
-- ⚠️ additive: chỉ CREATE TABLE, KHÔNG sửa bảng cũ. Chạy lại an toàn theo lối repo
--    (`CREATE ... IF NOT EXISTS` + `schema_migrations` chặn chạy hai lần).
--
-- ⚠️ VÌ SAO `marks_json` LÀ MỘT CỘT TEXT (JSON) CHỨ KHÔNG PHẢI 4 CỘT BOOLEAN:
--    Danh mục mục Nói là NỘI DUNG (`src/data/.../final-test/speaking.json`), có thể thêm/bớt
--    part khi soạn đề. Bốn cột boolean ghim số 4 vào LƯỢC ĐỒ CSDL ⇒ đổi số part phải viết một
--    migration nữa, và mỗi cột là một chỗ nữa để lệch với nội dung thật. Một cột JSON thì hình
--    dạng do tầng ứng dụng (Zod) kiểm, khớp đúng với `shared/schemas/parent-speaking.ts`, và
--    giữ được BA trạng thái của giao diện (đã làm được / ôn thêm / chưa xác nhận) trong khi bốn
--    cột boolean chỉ có hai giá trị.
--
-- ⚠️ BẢNG NÀY KHÔNG PHẢI ĐIỂM SỐ. Không trừ/cộng ⭐🌰, không đụng `happiness`, không đổi khiên.
--    Đây là ghi nhận QUAN SÁT của người lớn ("con có làm được việc này không"), không phải kết
--    quả máy chấm. Vì vậy bảng KHÔNG có khoá ngoại nào tới `final_test_attempt`.
-- =============================================================================

CREATE TABLE IF NOT EXISTS parent_speaking_confirm (
  -- Một bé, một hàng ⇒ `child_id` là khoá chính (upsert thay vì chèn nhiều dòng theo thời gian).
  child_id   TEXT PRIMARY KEY REFERENCES child_profile (id) ON DELETE CASCADE,
  -- JSON array [{ "id": "p1", "done": true }] — hình dạng khoá ở shared/schemas/parent-speaking.ts.
  -- Mục VẮNG MẶT = "chưa xác nhận"; có mặt + done=false = "mình ôn thêm nhé".
  marks_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);
