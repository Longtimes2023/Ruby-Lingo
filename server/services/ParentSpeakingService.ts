/**
 * RubyLingo — `ParentSpeakingService`: XÁC NHẬN RUBRIC PHẦN NÓI CỦA PHỤ HUYNH (TẦNG 4).
 *
 * ⭐ NHIỆM VỤ: đọc/ghi MỘT hàng `parent_speaking_confirm` cho một bé — trạng thái bốn mục Nói mà
 *   bố/mẹ tự đánh dấu sau khi nghe con nói. Trước đây việc này chỉ nằm trong `localStorage` của
 *   từng máy (mất khi đổi máy, không thấy được xác nhận của nhau); nay là dữ liệu CỦA HỒ SƠ BÉ.
 *
 * -----------------------------------------------------------------------------
 * HAI QUYẾT ĐỊNH CẦN HIỂU
 * -----------------------------------------------------------------------------
 *
 * ⚠️ 1. ĐÂY KHÔNG PHẢI GHI ĐIỂM. Không trừ/cộng ⭐🌰, không đụng `happiness`, không đổi khiên,
 *    không đi qua `XpService`. Đây là GHI NHẬN QUAN SÁT của người lớn. Vì vậy service chỉ chạm
 *    ĐÚNG một bảng và gói trong một transaction gọn (upsert một hàng) — cùng khuôn `RoomService`.
 *
 * ⚠️ 2. QUYỀN SỞ HỮU SUY TỪ `parent_id`, KHÔNG TIN `childId` CLIENT GỬI.
 *    `:id` nằm trên URL nên phụ huynh A có thể gửi id bé nhà B. Quyền với bé CỤ THỂ do
 *    `childService.getChild(parentId, childId)` kiểm (đối chiếu `parent_id`); sai ⇒ `CHILD_NOT_FOUND`.
 *    Tầng route KHÔNG kiểm lại và KHÔNG gọi DB — đúng như MỌI service khác của dự án.
 */

import { getDb, transaction } from '../db/connection.js';
import { childService } from './ChildService.js';
import type { ChildService } from './ChildService.js';
import {
  parentSpeakingSaveSchema,
  parentSpeakingStateSchema,
  parseParentSpeakingMarks,
} from '../../shared/schemas/parent-speaking.js';
import type { ParentSpeakingState } from '../../shared/schemas/parent-speaking.js';
import { errors } from '../plugins/errors.js';
import { nowIso } from '../lib/time.js';

interface ConfirmRow {
  marks_json: string;
  updated_at: string;
}

export class ParentSpeakingService {
  constructor(private readonly children: ChildService = childService) {}

  /**
   * Trạng thái xác nhận hiện tại của một bé.
   *
   * ⚠️ BÉ CHƯA ĐƯỢC XÁC NHẬN ⇒ `{ items: [], updatedAt: null }` — KHÔNG bịa một mốc thời gian
   *    cũng không ném lỗi. "Chưa có gì" là một trạng thái BÌNH THƯỜNG của thế giới.
   */
  getState(parentId: string, childId: string): ParentSpeakingState {
    this.requireChild(parentId, childId);

    const row = getDb()
      .prepare('SELECT marks_json, updated_at FROM parent_speaking_confirm WHERE child_id = ?')
      .get(childId) as ConfirmRow | undefined;

    if (!row) return { items: [], updatedAt: null };

    // Parse ĐẦU RA bằng schema dùng chung: hàng trong DB méo mó thì ném Ở ĐÂY, không để client
    // nhận dữ liệu sai rồi hỏng âm thầm. Cùng lối `FinalTestService.getState`.
    return parentSpeakingStateSchema.parse({
      items: parseParentSpeakingMarks(row.marks_json),
      updatedAt: row.updated_at,
    });
  }

  /**
   * GHI ĐÈ (upsert) trạng thái bốn mục Nói. Một bé một hàng — lần ghi sau thay trọn hàng cũ.
   *
   * ⚠️ `updatedAt` do SERVER đóng dấu (`nowIso()`), KHÔNG lấy từ client: một mốc do client khai
   *    là một mốc có thể sai (đồng hồ máy lệch) và không có cách nào kiểm chứng.
   */
  saveState(parentId: string, childId: string, rawInput: unknown): ParentSpeakingState {
    // Parse ở tầng service (không chỉ ở route) — xem ghi chú ở `ChildService`.
    const input = parentSpeakingSaveSchema.parse(rawInput);
    this.requireChild(parentId, childId);

    return transaction((db) => {
      const at = nowIso();
      db.prepare(
        `INSERT INTO parent_speaking_confirm (child_id, marks_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT (child_id) DO UPDATE SET
           marks_json = excluded.marks_json,
           updated_at = excluded.updated_at`,
      ).run(childId, JSON.stringify(input.items), at);

      const state: ParentSpeakingState = { items: input.items, updatedAt: at };
      parentSpeakingStateSchema.parse(state);
      return state;
    });
  }

  /** Kiểm quyền sở hữu bé. Ném `CHILD_NOT_FOUND` nếu không phải con của phụ huynh này. */
  private requireChild(parentId: string, childId: string): void {
    if (!this.children.getChild(parentId, childId)) throw errors.childNotFound();
  }
}

/** Dùng chung một instance. */
export const parentSpeakingService = new ParentSpeakingService();
