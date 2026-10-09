/**
 * RubyLingo — Mức Vui vẻ ❤️ của linh vật (T066). **NGUỒN CHÂN LÝ DUY NHẤT.**
 *
 * ⭐ VÌ SAO HÀM NÀY NẰM Ở `shared/` CHỨ KHÔNG TRONG `RewardService`:
 *   Cùng lý do như `shared/game-scoring.ts`. Server cần nó để trả `pet.happiness` trong ảnh
 *   chụp; test cần nó để kiểm từng con số mà không phải dựng DB. Hai bản cài đặt của cùng một
 *   phép tính là hai câu trả lời cho cùng một câu hỏi — và chúng sẽ lệch nhau đúng vào ngày ai
 *   đó sửa một bên.
 *
 * ⚠️⚠️ SÀN = 1 LÀ QUYẾT ĐỊNH THIẾT KẾ, KHÔNG PHẢI CHI TIẾT KỸ THUẬT.
 *   `happiness` không bao giờ xuống 0. Linh vật KHÔNG BAO GIỜ buồn bã hoàn toàn, dù bé xa app
 *   bao lâu. Một con vật cưng "chết đói" hoặc "giận bé" là một lời trách móc — và dự án này cấm
 *   mắng trẻ (xem luật số một trong `MEMORY.md`). Đây là cùng một luật, viết bằng con số.
 *
 * ⚠️ VÌ SAO CÓ NGÀY ÂN HẠN (`HAPPINESS_GRACE_DAYS`):
 *   Bé 7 tuổi không tự quyết định được việc mình quay lại app mỗi ngày — bố mẹ quyết định. Nghỉ
 *   một ngày (ốm, đi chơi, bố mẹ bận) mà linh vật đã mất ❤️ là trừng phạt một đứa trẻ vì lịch
 *   sinh hoạt của người lớn. Một ngày ân hạn khiến việc mất ❤️ chỉ xảy ra khi bé THẬT SỰ xa app,
 *   và khi đó câu chuyện kể được là "Momo nhớ bé" — không phải "Momo giận bé".
 */

/** SÀN ❤️ — không bao giờ buồn bã hoàn toàn. */
export const HAPPINESS_MIN = 1;

/** Trần ❤️ — khớp `CHECK (happiness BETWEEN 1 AND 5)` trong migration 004. */
export const HAPPINESS_MAX = 5;

/** Mức khởi đầu của một bé mới — khớp `DEFAULT 3` trong migration 004. */
export const HAPPINESS_DEFAULT = 3;

/**
 * Số ngày xa app được MIỄN trừ trước khi bắt đầu mất ❤️.
 *
 * 1 = hôm nay và hôm qua không mất gì; từ ngày thứ ba mỗi ngày mất 1 ❤️.
 */
export const HAPPINESS_GRACE_DAYS = 1;

/**
 * Mức Vui vẻ hiện tại, tính từ mức đã lưu và số ngày bé xa app.
 *
 * ⭐ HÀM THUẦN: cùng đầu vào ⇒ cùng đầu ra, không đọc DB, không đọc đồng hồ. Nhờ vậy
 *   `pet-happiness.test.ts` kiểm được mọi mốc (0, 1, 2, 3, 100 ngày) mà không cần dựng
 *   SQLite, và `readPet` chỉ còn việc đưa đúng hai con số vào.
 *
 * ⚠️ KẸP Ở ĐÂY chứ KHÔNG để `CHECK` của DB ném lỗi: một phép tính sai ở tầng trên phải hạ
 *    xuống SÀN, không được làm NỔ cả transaction — bé sẽ mất luôn phần thưởng của lượt chơi vừa
 *    rồi vì một lỗi ở chỗ khác. Cùng lý do đã áp cho `setPetHappinessInTx`.
 *
 * @param happiness Mức ❤️ đã lưu (trước khi tính hao).
 * @param daysAway  Số NGÀY TRỌN VẸN bé không quay lại app (0 = hôm nay có học).
 */
export function computeHappiness(happiness: number, daysAway: number): number {
  const base = Number.isFinite(happiness) ? Math.floor(happiness) : HAPPINESS_DEFAULT;
  const away = Number.isFinite(daysAway) ? Math.max(0, Math.floor(daysAway)) : 0;

  const lost = Math.max(0, away - HAPPINESS_GRACE_DAYS);
  return Math.min(HAPPINESS_MAX, Math.max(HAPPINESS_MIN, base - lost));
}
