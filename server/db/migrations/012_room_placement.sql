-- 012 — 每个孩子独立保存房间装饰摆放。
-- 只存放位置与隐藏状态；inventory 仍是所有权的唯一来源。
CREATE TABLE room_decoration_placement (
  child_id   TEXT NOT NULL REFERENCES child_profile (id) ON DELETE CASCADE,
  item_id    TEXT NOT NULL,
  x          REAL NOT NULL CHECK (x BETWEEN 0 AND 100),
  y          REAL NOT NULL CHECK (y BETWEEN 0 AND 100),
  hidden     INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (child_id, item_id)
);
