-- =============================================================================
-- 002 — HỒ SƠ BÉ & CÀI ĐẶT
-- =============================================================================
-- QUYỀN RIÊNG TƯ TRẺ EM (COPPA / GDPR-K) — đây là ràng buộc thiết kế, không phải gợi ý:
--   • KHÔNG lưu ảnh của bé
--   • KHÔNG lưu tên thật
--   • KHÔNG lưu ngày sinh (chỉ lưu TUỔI, và tuổi chỉ để chọn độ khó)
--   • KHÔNG lưu email/số điện thoại của bé
--   Bé chỉ có: biệt danh + tuổi + 1 avatar chọn từ bộ 8 avatar dựng sẵn.
-- =============================================================================

CREATE TABLE IF NOT EXISTS child_profile (
  id         TEXT PRIMARY KEY,
  parent_id  TEXT NOT NULL REFERENCES parent_account (id) ON DELETE CASCADE,
  nickname   TEXT NOT NULL,
  age        INTEGER NOT NULL CHECK (age >= 5 AND age <= 12),
  -- id avatar chọn sẵn, KHÔNG phải đường dẫn ảnh bé tự tải lên.
  avatar_id  TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_child_profile_parent ON child_profile (parent_id);

CREATE TABLE IF NOT EXISTS settings (
  child_id       TEXT PRIMARY KEY REFERENCES child_profile (id) ON DELETE CASCADE,
  sound_enabled  INTEGER NOT NULL DEFAULT 1 CHECK (sound_enabled IN (0, 1)),
  music_enabled  INTEGER NOT NULL DEFAULT 1 CHECK (music_enabled IN (0, 1)),
  -- Tốc độ đọc của Web Speech API. Trẻ nhỏ cần chậm hơn người lớn.
  speech_rate    REAL NOT NULL DEFAULT 0.8 CHECK (speech_rate >= 0.5 AND speech_rate <= 1.2),
  -- Tôn trọng lựa chọn giảm chuyển động — quan trọng với trẻ nhạy cảm.
  reduced_motion INTEGER NOT NULL DEFAULT 0 CHECK (reduced_motion IN (0, 1)),
  updated_at     TEXT NOT NULL
);
