-- =============================================================================
-- 005 — SƯU TẦM: huy hiệu & sticker
-- =============================================================================
-- Huy hiệu và sticker là SƯU TẦM, KHÔNG tiêu được ⇒ không có cột số lượng.
-- Đã đạt = VĨNH VIỄN. Không bao giờ thu hồi.
-- =============================================================================

CREATE TABLE IF NOT EXISTS badge_earned (
  child_id   TEXT NOT NULL REFERENCES child_profile (id) ON DELETE CASCADE,
  badge_id   TEXT NOT NULL,
  earned_at  TEXT NOT NULL,
  PRIMARY KEY (child_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_badge_earned_child ON badge_earned (child_id, earned_at DESC);

CREATE TABLE IF NOT EXISTS sticker_earned (
  child_id   TEXT NOT NULL REFERENCES child_profile (id) ON DELETE CASCADE,
  sticker_id TEXT NOT NULL,
  -- Bài học làm rơi ra sticker này (phần thưởng biến thiên).
  lesson_id  TEXT,
  earned_at  TEXT NOT NULL,
  PRIMARY KEY (child_id, sticker_id)
);

CREATE INDEX IF NOT EXISTS idx_sticker_earned_child ON sticker_earned (child_id, earned_at DESC);
