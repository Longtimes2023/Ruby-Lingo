-- =============================================================================
-- 004 — THƯỞNG: ví tiền tệ, XP, thú cưng, túi đồ, chuỗi ngày
-- =============================================================================
-- Triết lý "KHÔNG BAO GIỜ MẮNG ĐỨA TRẺ":
--   • Không có cột nào cho phép số dư ÂM ⇒ không thể trừ tiền của bé.
--   • `stars` / `acorns` chỉ tăng qua thưởng và giảm khi mua — không có hình phạt.
--   • `happiness` có CHECK >= 1 ⇒ linh vật KHÔNG BAO GIỜ buồn bã hoàn toàn.
--   • `stars_best` ở lesson_progress không bao giờ giảm ⇒ chơi lại kém không mất sao.
-- =============================================================================

CREATE TABLE IF NOT EXISTS wallet (
  child_id   TEXT PRIMARY KEY REFERENCES child_profile (id) ON DELETE CASCADE,
  -- ⭐ Sao — tiền tệ phổ thông. CHECK >= 0: không thể âm.
  stars      INTEGER NOT NULL DEFAULT 0 CHECK (stars >= 0),
  -- 🌰 Hạt dẻ — tiền tệ hiếm, mua vật phẩm đặc biệt.
  acorns     INTEGER NOT NULL DEFAULT 0 CHECK (acorns >= 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS xp_state (
  child_id   TEXT PRIMARY KEY REFERENCES child_profile (id) ON DELETE CASCADE,
  xp         INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  -- Cấp Nhà thám hiểm. Bảng "cấp ↔ XP" nằm ở shared/content/xp-levels.json và do
  -- validator kiểm (V15: cấp phải liên tục và XP phải tăng dần).
  --
  -- CỐ TÌNH KHÔNG viết `CHECK (level BETWEEN 1 AND 7)`:
  -- số cấp là DỮ LIỆU, không phải hằng số code. Nếu khoá cứng ở đây thì lúc thêm
  -- cấp 8 vào JSON, SQLite sẽ ném SQLITE_CONSTRAINT ngay lúc bé lên cấp — mà
  -- migration là BẤT BIẾN, nên phải viết thêm một migration chỉ để nới một con số.
  -- Chặn giá trị rác bằng `level >= 1` là đủ; tính hợp lệ của cấp do tầng ứng dụng lo.
  level      INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pet_state (
  child_id         TEXT PRIMARY KEY REFERENCES child_profile (id) ON DELETE CASCADE,
  -- Tiến hoá theo TỔNG SỐ TỪ ĐÃ HỌC, không mua được bằng tiền.
  -- ⚠️ Danh sách này PHẢI khớp `evolutionStages` trong shared/content/xp-levels.json.
  --    Khác với `level` ở bảng xp_state, ở đây GIỮ CHECK enum: 4 giai đoạn này gắn với
  --    4 bộ hình vẽ của linh vật, thêm giai đoạn mới là việc phải vẽ thêm tranh — không
  --    phải thao tác chỉ sửa JSON, nên việc buộc phải viết migration là HỢP LÝ.
  evolution_stage  TEXT NOT NULL DEFAULT 'egg'
                   CHECK (evolution_stage IN ('egg', 'baby', 'adult', 'super')),
  -- SÀN = 1: dù bé bỏ app nhiều ngày, linh vật cũng không buồn bã hoàn toàn.
  happiness        INTEGER NOT NULL DEFAULT 3 CHECK (happiness BETWEEN 1 AND 5),
  -- id vật phẩm đang mặc / đang trưng bày, lưu dạng JSON array.
  equipped_item_ids TEXT NOT NULL DEFAULT '[]',
  last_fed_at      TEXT,
  updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory (
  child_id    TEXT NOT NULL REFERENCES child_profile (id) ON DELETE CASCADE,
  item_id     TEXT NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  equipped    INTEGER NOT NULL DEFAULT 0 CHECK (equipped IN (0, 1)),
  acquired_at TEXT NOT NULL,
  PRIMARY KEY (child_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_child ON inventory (child_id);

CREATE TABLE IF NOT EXISTS streak_state (
  child_id           TEXT PRIMARY KEY REFERENCES child_profile (id) ON DELETE CASCADE,
  current_streak     INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak     INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  -- Ngày học gần nhất (YYYY-MM-DD giờ địa phương) — dùng để phát hiện bé quay lại.
  last_active_date   TEXT,
  -- Mốc quà đã nhận (3, 7, 14, 30), lưu dạng JSON array.
  milestones_claimed TEXT NOT NULL DEFAULT '[]',
  updated_at         TEXT NOT NULL
);
