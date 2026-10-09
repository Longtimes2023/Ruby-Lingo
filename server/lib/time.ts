/**
 * RubyLingo — Tiện ích thời gian & kỳ nhiệm vụ.
 *
 * ⚠️ NGUỒN CHÂN LÝ VỀ `period_key`: reset nhiệm vụ ngày/tuần **KHÔNG cần cron**.
 *    Mỗi bản ghi quest_progress lưu `period_key`; khi truy vấn, server tính `periodKey`
 *    của kỳ HIỆN TẠI rồi lọc theo nó ⇒ kỳ cũ tự nhiên không khớp, không cần job dọn dẹp.
 */

/** Thời điểm hiện tại dạng ISO UTC — dùng cho mọi cột `updated_at`. */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Ngày theo GIỜ ĐỊA PHƯƠNG của gia đình (YYYY-MM-DD).
 *
 * Vì sao không dùng UTC: bé học buổi tối ở Việt Nam (UTC+7) sẽ bị tính sang ngày hôm sau
 * nếu dùng UTC ⇒ chuỗi ngày và nhiệm vụ ngày bị sai.
 */
export function localDateKey(date: Date = new Date(), offsetMinutes = 7 * 60): string {
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Khoá kỳ của nhiệm vụ ngày: "2026-10-06".
 * Nhiệm vụ ngày reset khi `localDateKey` đổi.
 */
export function dailyPeriodKey(date: Date = new Date()): string {
  return localDateKey(date);
}

/**
 * Khoá kỳ của nhiệm vụ tuần theo chuẩn ISO-8601: "2026-W41".
 * Tuần ISO bắt đầu từ THỨ HAI và tuần 1 là tuần chứa thứ Năm đầu tiên của năm.
 */
export function weeklyPeriodKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Chuyển về thứ Năm của tuần hiện tại (ISO: tuần thuộc về năm chứa thứ Năm).
  const dayNum = d.getUTCDay() || 7; // Chủ nhật = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** Nhiệm vụ mốc mở khoá không bao giờ reset ⇒ dùng khoá cố định. */
export const MILESTONE_PERIOD_KEY = 'all';

/** Khoá kỳ theo tầng nhiệm vụ. */
export function periodKeyForTier(tier: 'daily' | 'weekly' | 'milestone', date: Date = new Date()): string {
  switch (tier) {
    case 'daily':
      return dailyPeriodKey(date);
    case 'weekly':
      return weeklyPeriodKey(date);
    case 'milestone':
      return MILESTONE_PERIOD_KEY;
  }
}

/** Khoảng ngày YYYY-MM-DD lui về trước `days` ngày (cho báo cáo phụ huynh). */
export function dateKeyDaysAgo(days: number, from: Date = new Date()): string {
  const d = new Date(from.getTime() - days * 86_400_000);
  return localDateKey(d);
}

/** Đã qua ngày mới chưa (so sánh khoá ngày) — dùng để phát hiện bé quay lại sau 1 ngày. */
export function isNewDay(previousDateKey: string | null, now: Date = new Date()): boolean {
  return previousDateKey !== localDateKey(now);
}

/** Số ngày lệch giữa hai khoá ngày YYYY-MM-DD (dương nếu `to` muộn hơn `from`). */
export function daysBetweenDateKeys(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Thời điểm hết hạn của một phiên đăng nhập. */
export function sessionExpiry(ttlMs: number, from: Date = new Date()): string {
  return new Date(from.getTime() + ttlMs).toISOString();
}

/**
 * Mốc MUỘN HƠN trong hai mốc ISO; coi chuỗi rỗng là "chưa có gì" (cũ nhất).
 *
 * ⭐ ĐÂY LÀ LUẬT "`updated_at` KHÔNG BAO GIỜ LÙI", chỉ viết một lần.
 *   Một sự kiện đến muộn (bé chơi offline từ hôm qua, hôm nay mới có mạng) không được phép làm
 *   bản ghi "cũ đi": luật gộp ở client là "lần ghi sau thắng", nên nếu `updated_at` lùi thì bản
 *   trong máy bé sẽ thắng và XOÁ mất việc vừa đồng bộ lên.
 *
 *   So sánh chuỗi là đủ và đúng vì mọi mốc trong hệ thống đều là ISO-8601 UTC cùng định dạng
 *   (`toISOString()`), nên thứ tự từ vựng trùng với thứ tự thời gian.
 */
export function laterIso(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}
