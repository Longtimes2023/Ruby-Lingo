/**
 * RubyLingo — Tiện ích thời gian phía client.
 *
 * ⚠️ Phải khớp logic với `server/lib/time.ts`. `period_key` tính ở CLIENT chỉ để HIỂN THỊ
 * ("còn bao lâu thì reset"); server mới là bên quyết định khi chấm thưởng.
 */

/** Ngày giờ địa phương dạng YYYY-MM-DD (KHÔNG dùng UTC — xem ghi chú ở server). */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Thời điểm hiện tại dạng ISO-8601 UTC, có `Z` ở cuối.
 *
 * ⚠️ ĐỊNH DẠNG NÀY CÓ RÀNG BUỘC, KHÔNG PHẢI QUY ƯỚC CHO ĐẸP.
 *    Luật gộp tiến độ là "lần ghi sau thắng" và nó so sánh bằng CHUỖI (`shared/progress-merge.ts`).
 *    Phép so sánh đó chỉ đúng khi mọi chuỗi cùng định dạng ISO-8601 UTC với `Z` ở cuối —
 *    khi ấy thứ tự từ điển TRÙNG với thứ tự thời gian. Một chuỗi thiếu `Z` (giờ địa phương)
 *    sẽ sắp xếp sai và phá cơ chế đồng bộ, mà triệu chứng thì rất khó lần: tiến độ của bé
 *    "đôi khi" bị ghi đè bởi bản cũ.
 *
 *    `toISOString()` của `Date` luôn trả đúng định dạng này. Vì vậy KHÔNG tự nối chuỗi ngày
 *    giờ bằng tay ở bất kỳ đâu dùng cho tiến độ.
 */
export function nowIso(date: Date = new Date()): string {
  return date.toISOString();
}

/** Khoá kỳ nhiệm vụ tuần theo ISO-8601: "2026-W41". */
export function weeklyPeriodKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** Định dạng ngày thân thiện cho phụ huynh: "6/10/2026". */
export function formatDateVi(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

/** Thứ trong tuần bằng tiếng Việt. */
export const WEEKDAY_VI = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'] as const;

/** "Thứ ba, 6/10" — dùng trong báo cáo. */
export function formatWeekdayVi(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${WEEKDAY_VI[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;
}

/** Đổi giây thành "12 phút" — cho báo cáo thời gian học. */
export function formatDurationVi(seconds: number): string {
  if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} phút`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
}

/** Còn bao lâu nữa thì nhiệm vụ ngày reset (giờ địa phương). */
export function timeUntilMidnightVi(now: Date = new Date()): string {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const ms = midnight.getTime() - now.getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h === 0) return `${m} phút nữa`;
  return `${h} giờ ${m} phút nữa`;
}

/** Số ngày lệch giữa hai khoá ngày YYYY-MM-DD. */
export function daysBetweenDateKeys(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}
