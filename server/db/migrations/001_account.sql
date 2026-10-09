-- =============================================================================
-- 001 — TÀI KHOẢN PHỤ HUYNH & PHIÊN ĐĂNG NHẬP
-- =============================================================================
-- Nguyên tắc bảo mật:
--   • Mật khẩu lưu dạng HASH (argon2id), không bao giờ lưu bản rõ.
--   • Token phiên lưu dạng HASH: nếu file DB bị lộ, kẻ tấn công KHÔNG thể dùng
--     giá trị trong DB để giả mạo phiên (vì cookie thật là bản gốc chưa hash).
--   • Mã khôi phục cũng lưu dạng HASH.
--   • Tuân thủ COPPA/GDPR-K: chỉ lưu email của PHỤ HUYNH. Không có bảng nào lưu
--     dữ liệu cá nhân của trẻ ngoài biệt danh + tuổi + avatar chọn sẵn.
-- =============================================================================

CREATE TABLE IF NOT EXISTS parent_account (
  id                     TEXT PRIMARY KEY,
  email                  TEXT NOT NULL,
  password_hash          TEXT NOT NULL,
  display_name           TEXT,
  -- PIN 4 số để vào khu vực phụ huynh. CHỈ là rào UX, không phải ranh giới bảo mật
  -- (ranh giới thật là phiên đăng nhập của phụ huynh).
  pin_hash               TEXT,
  -- Dấu vết đồng ý chính sách quyền riêng tư trẻ em — bằng chứng tuân thủ COPPA/GDPR-K.
  consent_policy_version TEXT NOT NULL,
  consented_at           TEXT NOT NULL,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);

-- Email không phân biệt hoa/thường; lưu ở dạng lowercase khi ghi.
CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_account_email ON parent_account (email);

CREATE TABLE IF NOT EXISTS session (
  id          TEXT PRIMARY KEY,
  parent_id   TEXT NOT NULL REFERENCES parent_account (id) ON DELETE CASCADE,
  -- SHA-256 của token thật nằm trong cookie. Cookie bị lộ ≠ DB bị lộ.
  token_hash  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  last_seen_at TEXT,
  user_agent  TEXT,
  ip          TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_token_hash ON session (token_hash);
CREATE INDEX IF NOT EXISTS idx_session_parent ON session (parent_id);
CREATE INDEX IF NOT EXISTS idx_session_expires ON session (expires_at);

CREATE TABLE IF NOT EXISTS recovery_code (
  id         TEXT PRIMARY KEY,
  parent_id  TEXT NOT NULL REFERENCES parent_account (id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  -- Dùng một lần: sau khi đặt lại mật khẩu thì mã này vô hiệu.
  used_at    TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recovery_code_parent ON recovery_code (parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recovery_code_hash ON recovery_code (code_hash);
