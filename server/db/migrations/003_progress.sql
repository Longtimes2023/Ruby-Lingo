-- =============================================================================
-- 003 — TIẾN ĐỘ HỌC
-- =============================================================================
-- Tiến độ lưu ở cấp TỪNG TỪ (không chỉ cấp bài) — vì báo cáo phụ huynh và tính năng
-- ôn tập từ hay sai cần biết bé yếu từ nào cụ thể.
--
-- ⚠️ `word_id` / `lesson_id` / `theme_id` là TEXT chứa id của MỌI CẤP HỌC
--    (starters.*, movers.*, flyers.*) ⇒ thêm cấp mới KHÔNG cần đổi schema.
--
-- Quyền sở hữu: mọi bảng đều gắn `child_id`; server suy ra `parent_id` qua
-- child_profile để kiểm tra quyền. Client KHÔNG bao giờ được tin `child_id` nó gửi lên.
-- =============================================================================

CREATE TABLE IF NOT EXISTS word_progress (
  child_id      TEXT NOT NULL REFERENCES child_profile (id) ON DELETE CASCADE,
  word_id       TEXT NOT NULL,
  learned       INTEGER NOT NULL DEFAULT 0 CHECK (learned IN (0, 1)),
  mastered      INTEGER NOT NULL DEFAULT 0 CHECK (mastered IN (0, 1)),
  correct_count INTEGER NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  wrong_count   INTEGER NOT NULL DEFAULT 0 CHECK (wrong_count >= 0),
  last_seen_at  TEXT,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (child_id, word_id)
);

CREATE INDEX IF NOT EXISTS idx_word_progress_child ON word_progress (child_id);
-- Tìm nhanh "từ bé hay sai" cho báo cáo phụ huynh.
CREATE INDEX IF NOT EXISTS idx_word_progress_wrong ON word_progress (child_id, wrong_count DESC);

CREATE TABLE IF NOT EXISTS lesson_progress (
  child_id     TEXT NOT NULL REFERENCES child_profile (id) ON DELETE CASCADE,
  lesson_id    TEXT NOT NULL,
  -- Điểm cao nhất từng đạt. KHÔNG BAO GIỜ giảm: chơi lại kém hơn không làm mất kỷ lục.
  best_score   INTEGER NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  stars_best   INTEGER NOT NULL DEFAULT 0 CHECK (stars_best BETWEEN 0 AND 3),
  attempts     INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  completed    INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  completed_at TEXT,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (child_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_child ON lesson_progress (child_id);

CREATE TABLE IF NOT EXISTS theme_progress (
  child_id          TEXT NOT NULL REFERENCES child_profile (id) ON DELETE CASCADE,
  theme_id          TEXT NOT NULL,
  unlocked          INTEGER NOT NULL DEFAULT 0 CHECK (unlocked IN (0, 1)),
  unlocked_at       TEXT,
  lessons_completed INTEGER NOT NULL DEFAULT 0 CHECK (lessons_completed >= 0),
  stars_earned      INTEGER NOT NULL DEFAULT 0 CHECK (stars_earned >= 0),
  updated_at        TEXT NOT NULL,
  PRIMARY KEY (child_id, theme_id)
);

CREATE INDEX IF NOT EXISTS idx_theme_progress_child ON theme_progress (child_id);

CREATE TABLE IF NOT EXISTS daily_stats (
  child_id           TEXT NOT NULL REFERENCES child_profile (id) ON DELETE CASCADE,
  -- Ngày theo GIỜ ĐỊA PHƯƠNG của gia đình (YYYY-MM-DD), KHÔNG phải UTC —
  -- nếu dùng UTC thì buổi học tối ở Việt Nam sẽ bị tính sang ngày hôm sau.
  date               TEXT NOT NULL,
  words_learned      INTEGER NOT NULL DEFAULT 0 CHECK (words_learned >= 0),
  questions_answered INTEGER NOT NULL DEFAULT 0 CHECK (questions_answered >= 0),
  correct_count      INTEGER NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  stars_earned       INTEGER NOT NULL DEFAULT 0 CHECK (stars_earned >= 0),
  acorns_earned      INTEGER NOT NULL DEFAULT 0 CHECK (acorns_earned >= 0),
  xp_earned          INTEGER NOT NULL DEFAULT 0 CHECK (xp_earned >= 0),
  active_seconds     INTEGER NOT NULL DEFAULT 0 CHECK (active_seconds >= 0),
  updated_at         TEXT NOT NULL,
  PRIMARY KEY (child_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_child_date ON daily_stats (child_id, date DESC);

-- -----------------------------------------------------------------------------
-- Nhật ký lượt chơi: phục vụ 3 việc cùng lúc
--   1. chống ghi trùng khi client mất mạng rồi gửi lại (client_event_id UNIQUE)
--   2. đếm "đã chơi N game" cho nhiệm vụ ngày
--   3. đếm "thắng N lượt game X" cho huy hiệu
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_result (
  id               TEXT PRIMARY KEY,
  child_id         TEXT NOT NULL REFERENCES child_profile (id) ON DELETE CASCADE,
  -- id do CLIENT sinh, UNIQUE ⇒ gửi lại cùng một lượt chơi không bị tính hai lần.
  client_event_id  TEXT NOT NULL,
  exercise_id      TEXT NOT NULL,
  lesson_id        TEXT NOT NULL,
  game_type        TEXT NOT NULL,
  total_questions  INTEGER NOT NULL CHECK (total_questions >= 0),
  correct_count    INTEGER NOT NULL CHECK (correct_count >= 0),
  longest_streak   INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  score            INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
  stars            INTEGER NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 3),
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  created_at       TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_result_event ON game_result (client_event_id);
CREATE INDEX IF NOT EXISTS idx_game_result_child ON game_result (child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_result_child_game ON game_result (child_id, game_type);
