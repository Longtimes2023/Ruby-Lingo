-- =============================================================================
-- 013 — BÀI THI CUỐI KHOÁ STARTERS: NHẬT KÝ LẦN THI + TIẾN ĐỘ ĐANG DỞ
-- =============================================================================
-- Hai bảng, hai câu hỏi KHÁC NHAU — gộp chúng lại là trộn hai sự thật:
--   • final_test_attempt  — mỗi lần bé NỘP một phần (đã làm xong) ⇒ một hàng.
--       Nguồn DUY NHẤT cho "khiên cao nhất mỗi phần" và "bé đã tốt nghiệp chưa".
--   • final_test_progress — tiến độ ĐANG DỞ của một phần (đổi máy thì làm tiếp đúng chỗ).
--       Khoá chính là (child_id, section) nên không phình theo số lần bấm.
--
-- ⚠️ additive: chỉ CREATE TABLE/INDEX, KHÔNG sửa bảng cũ. Chạy lại an toàn theo lối repo
--    (`CREATE ... IF NOT EXISTS` + `schema_migrations` chặn chạy hai lần).
--
-- ⚠️⚠️ `shields BETWEEN 1 AND 5` — SÀN = 1 LÀ RÀNG BUỘC CỨNG, KHÔNG PHẢI CHI TIẾT.
--    Bé 7 tuổi không bao giờ nhận "0 khiên" (đọc thành "mình dở"). DB TỪ CHỐI giá trị 0, nên
--    một bug ở tầng ứng dụng KHÔNG THỂ ghi ra một hàng mà bé hiểu là thất bại. Cùng bất biến
--    với `shared/final-test-scoring.ts` (B1) — DB là lưới an toàn cuối cùng.
--
-- ⚠️ `client_event_id` UNIQUE — CỔNG CHỐNG GHI TRÙNG, VÀ MỌI THỨ KHÁC PHỤ THUỘC VÀO NÓ.
--    Kịch bản thật: bé nộp xong, server ghi xong, nhưng PHẢN HỒI mất trên đường về. Client gửi
--    lại y nguyên. Cổng này chặn lần thứ hai ⇒ phần thưởng (⭐/🌰/XP) không bị cộng hai lần.
--    Cùng cơ chế, cùng lý do như `game_result.client_event_id` (migration 003), và cũng dùng
--    `INSERT OR IGNORE` + đọc lại hàng (xem quyết định 3 ở đầu `GameResultService.ts`).
-- =============================================================================

CREATE TABLE IF NOT EXISTS final_test_attempt (
  id                TEXT PRIMARY KEY,
  child_id          TEXT NOT NULL REFERENCES child_profile (id) ON DELETE CASCADE,
  -- 'listening' | 'reading-writing' | 'speaking' (danh mục đóng ở shared/schemas/final-test.ts).
  section           TEXT NOT NULL,
  -- id do CLIENT sinh, UNIQUE ⇒ gửi lại cùng một lần thi không bị tính hai lần.
  client_event_id   TEXT NOT NULL,
  -- Thời điểm bé NỘP phần thi (client ghi), KHÔNG phải lúc server nhận — bé có thể thi offline.
  occurred_at       TEXT NOT NULL,
  total_items       INTEGER NOT NULL CHECK (total_items > 0),
  correct_first_try INTEGER NOT NULL CHECK (correct_first_try >= 0),
  -- SÀN = 1, TRẦN = 5. Xem ghi chú đầu tệp.
  shields           INTEGER NOT NULL CHECK (shields BETWEEN 1 AND 5),
  created_at        TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_final_test_attempt_event ON final_test_attempt (client_event_id);
CREATE INDEX IF NOT EXISTS idx_final_test_attempt_child ON final_test_attempt (child_id, section);

CREATE TABLE IF NOT EXISTS final_test_progress (
  child_id     TEXT NOT NULL REFERENCES child_profile (id) ON DELETE CASCADE,
  section      TEXT NOT NULL,
  -- Số câu bé đã làm trong phần này. Server SUY từ độ dài `answers_json` — KHÔNG tin một con
  -- số `answered` do client khai riêng (hai nguồn cho một sự thật thì sớm muộn cũng lệch).
  answered     INTEGER NOT NULL DEFAULT 0 CHECK (answered >= 0),
  -- Đáp án bé đã chọn, dạng JSON array [{ itemId, value }] — để đổi máy làm tiếp đúng chỗ.
  answers_json TEXT NOT NULL DEFAULT '[]',
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (child_id, section)
);
