-- =============================================================================
-- 006 — NHIỆM VỤ
-- =============================================================================
-- ⭐ ĐIỂM THIẾT KẾ QUAN TRỌNG: KHÔNG CẦN CRON ĐỂ RESET NHIỆM VỤ.
--
-- Cách làm: mỗi hàng lưu `period_key` của kỳ mà nó thuộc về:
--     daily     → "2026-10-06"   (ngày giờ địa phương)
--     weekly    → "2026-W41"     (tuần ISO)
--     milestone → "all"          (không bao giờ reset)
--
-- Khi truy vấn, server tính `period_key` của kỳ HIỆN TẠI rồi lọc theo nó.
-- Sang ngày/tuần mới, khoá cũ tự nhiên không khớp ⇒ nhiệm vụ "tự reset" mà không
-- cần một job chạy lúc nửa đêm (bớt một thứ phải vận hành trên VPS).
-- =============================================================================

CREATE TABLE IF NOT EXISTS quest_progress (
  child_id    TEXT NOT NULL REFERENCES child_profile (id) ON DELETE CASCADE,
  quest_id    TEXT NOT NULL,
  period_key  TEXT NOT NULL,
  progress    INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
  target      INTEGER NOT NULL CHECK (target > 0),
  completed   INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  -- Đã bấm "Nhận thưởng" chưa. Phần thưởng chỉ trao MỘT lần cho mỗi kỳ.
  claimed     INTEGER NOT NULL DEFAULT 0 CHECK (claimed IN (0, 1)),
  claimed_at  TEXT,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (child_id, quest_id, period_key)
);

-- Truy vấn chính: "các nhiệm vụ của bé trong kỳ hiện tại".
CREATE INDEX IF NOT EXISTS idx_quest_progress_child_period
  ON quest_progress (child_id, period_key);

-- Tìm nhanh nhiệm vụ đã xong nhưng chưa nhận thưởng (để hiện dấu chấm đỏ trên nút Nhiệm vụ).
CREATE INDEX IF NOT EXISTS idx_quest_progress_claimable
  ON quest_progress (child_id, completed, claimed);
