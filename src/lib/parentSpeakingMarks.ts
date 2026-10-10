/**
 * RubyLingo — LƯU CỤC BỘ rubric phần Nói của phụ huynh (TẦNG 4).
 *
 * ⚠️ TÁCH KHỎI COMPONENT (`ParentSpeakingChecklist.tsx`) VÌ HAI LÝ DO:
 *   1. Component `.tsx` chỉ nên xuất COMPONENT — xuất thêm hàm thường làm Fast Refresh của Vite
 *      cảnh báo và làm mất trạng thái khi sửa file (xem `react-refresh/only-export-components`).
 *   2. Logic lưu/đọc là thứ cần TEST RIÊNG, không cần render React.
 *
 * ⚠️⚠️ CHỈ LƯU TRONG MÁY — CHƯA ĐỒNG BỘ SERVER. Khoá lưu TÁCH THEO TỪNG BÉ để anh/chị/em trong
 *   nhà không ghi đè kết quả của nhau. Chế độ riêng tư của Safari ném lỗi khi đọc/ghi ⇒ mọi thao
 *   tác đều bọc `try/catch`, không bao giờ để lọt lỗi ra màn hình phụ huynh.
 */

/** Bốn phần Nói (khớp `src/data/levels/starters/final-test/speaking.json`). */
export const SPEAKING_PARTS = [1, 2, 3, 4] as const;

/** Kết quả phụ huynh chọn cho một phần. */
export type SpeakingMark = 'done' | 'not-yet';

export type SpeakingMarks = Partial<Record<number, SpeakingMark>>;

const STORAGE_PREFIX = 'rubylingo.parent.speaking-check.';

/** Khoá lưu của một bé. */
export function speakingMarksKey(childId: string): string {
  return `${STORAGE_PREFIX}${childId}`;
}

/** Đọc lựa chọn đã lưu. Hỏng/không đọc được ⇒ coi như chưa đánh dấu gì. */
export function loadSpeakingMarks(childId: string): SpeakingMarks {
  try {
    const raw = localStorage.getItem(speakingMarksKey(childId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const record = parsed as Record<string, unknown>;
    const result: SpeakingMarks = {};
    for (const part of SPEAKING_PARTS) {
      const value = record[String(part)];
      if (value === 'done' || value === 'not-yet') result[part] = value;
    }
    return result;
  } catch {
    return {};
  }
}

/** Ghi lựa chọn. `false`/giá trị lạ không lọt qua `loadSpeakingMarks`. */
export function saveSpeakingMarks(childId: string, marks: SpeakingMarks): void {
  try {
    localStorage.setItem(speakingMarksKey(childId), JSON.stringify(marks));
  } catch {
    /* Không lưu được thì thôi — lựa chọn vẫn đúng trong phiên hiện tại. */
  }
}

/** Xoá lựa chọn đã lưu của một bé. CHỈ dùng trong test. */
export function __clearSpeakingMarksForTests(childId: string): void {
  try {
    localStorage.removeItem(speakingMarksKey(childId));
  } catch {
    /* Không quan trọng trong test. */
  }
}
