/**
 * RubyLingo — THANG KHIÊN 🛡️ của bài thi cuối khoá Starters.
 *
 * ⭐ VÌ SAO LUẬT NÀY NẰM Ở `shared/` VÀ LÀ HÀM THUẦN:
 *   Server là TRỌNG TÀI CUỐI. Client chấm để HIỆN NGAY cho bé thấy, nhưng server chấm LẠI từ
 *   chính dữ liệu thô (`correctFirstTry` / `total`) trước khi ghi vào sổ. Nếu luật nằm riêng ở
 *   client, hai bên sẽ lệch nhau ngay lần đầu ai đó sửa một bên — và triệu chứng là "bé thấy 4
 *   khiên trên màn hình, hôm sau mở lại còn 3". Cùng lý do đã áp dụng cho `shared/game-scoring.ts`
 *   và `shared/theme-access.ts`. Hàm thuần: không React, không `fetch`, không `Date.now`.
 *
 * ⚠️⚠️ RÀNG BUỘC CỨNG #1 — **KHÔNG BAO GIỜ 0 KHIÊN** (B1):
 *   Bé 7 tuổi nhận "0 khiên" sẽ đọc đó là "mình dở", và đó đúng là thứ triết lý "KHÔNG BAO GIỜ
 *   MẮNG ĐỨA TRẺ" sinh ra để chặn. Hoàn thành là đã có thưởng ⇒ SÀN TUYỆT ĐỐI = 1, kể cả khi bé
 *   không đúng câu nào. Không có nhánh nào trong file này trả về 0.
 *
 * ⚠️ "CHƯA LÀM" KHÁC "LÀM DỞ" KHÁC "LÀM XONG" — và đó là lý do có `readSectionShields`:
 *   `shieldsForSection(0, 20)` (làm xong, không đúng câu nào) trả 1 khiên — ĐÚNG, bé đã bỏ công.
 *   Nhưng một phần bé CHƯA HỀ MỞ cũng có `correctFirstTry = 0`; nếu UI vẽ "1 khiên" cho nó thì
 *   đó là LỜI NÓI SAI (bé chưa làm gì cả, sao lại có khiên). `readSectionShields` trả `null` khi
 *   phần chưa hoàn thành, để nơi gọi không bao giờ hiện khiên cho thứ bé chưa làm xong.
 */

/** Trần khiên — mô hình Cambridge (Bảng §2.3 của thiết kế), và `maxShields: 5` trong schema. */
export const SHIELD_MAX = 5;

/** Sàn khiên — ràng buộc cứng #1 ở đầu file. KHÔNG có giá trị 0. */
export const SHIELD_MIN = 1;

/** Số khiên hợp lệ của một phần thi. */
export type ShieldCount = 1 | 2 | 3 | 4 | 5;

/**
 * Ngưỡng TỈ LỆ ĐÚNG (trên số câu "đúng ngay lần đầu") để đạt từng bậc khiên.
 *
 * ⭐ VÌ SAO DÙNG "ĐÚNG NGAY LẦN ĐẦU" CHỨ KHÔNG PHẢI "ĐÚNG SAU KHI SỬA":
 *   Cùng lý do `starsForRun` (`game-scoring.ts:171-175`). Nếu tính cả câu phải sửa thì bé nào
 *   cũng sửa tới khi đúng ⇒ ai cũng 5 khiên, và khiên mất hết ý nghĩa.
 *
 * ⚠️⚠️ NGƯỠNG LÀ MẶC ĐỊNH, SẼ TINH CHỈNH BẰNG DỮ LIỆU CHƠI THẬT (Q6) — đừng coi là chốt cứng.
 *   Ghi vào `BALANCE_TODO` cùng chỗ với ngưỡng sao (`shared/content/economy.ts`).
 *
 * ⚠️⚠️ BẢN NHÁP THIẾT KẾ (tài liệu §4.1) CÒN có nhánh theo SỐ LỖI (`errors <= 1 ⇒ 5`). Nhánh đó
 *   ĐÃ BỎ Ở ĐÂY, và đó là chủ ý: với phần ít câu, "≤ 1 lỗi ⇒ 5" khiến **0/1 câu vẫn được 5 khiên**
 *   — trái thẳng yêu cầu "0/total ⇒ 1 khiên" và biến khiên thành vô nghĩa. Thang dưới đây CHỈ theo
 *   tỉ lệ, nên `correct = 0` LUÔN ra 1 khiên với mọi `total`. Vẫn giữ nguyên các mốc tỉ lệ (0,9 /
 *   0,75 / 0,6 / 0,4) của thiết kế.
 */
export const SHIELD_RATIO_FIVE = 0.9;
export const SHIELD_RATIO_FOUR = 0.75;
export const SHIELD_RATIO_THREE = 0.6;
export const SHIELD_RATIO_TWO = 0.4;

/**
 * Khiên của MỘT phần CHẤM TỰ ĐỘNG, theo số câu đúng NGAY LẦN ĐẦU trên tổng số câu.
 *
 * ⭐ ĐƠN ĐIỆU KHÔNG GIẢM theo `correctFirstTry`: bé làm đúng nhiều hơn KHÔNG BAO GIỜ bị ít khiên
 *   hơn. Đây là bất biến được kiểm vét cạn ở `tests/unit/shared/final-test-scoring.test.ts`.
 *
 * ⚠️ `total <= 0` NÉM LỖI, KHÔNG trả 1. Một phần "0 câu" không phải bài thi — nó là "chưa làm",
 *   và câu trả lời cho "chưa làm" là `readSectionShields() === null`, không phải "1 khiên". Nếu ở
 *   đây lặng lẽ trả 1, lỗi lập trình (gọi chấm một phần rỗng) sẽ đi qua IM LẶNG và sinh ra một
 *   khiên trông hoàn toàn hợp lệ cho thứ không tồn tại.
 */
export function shieldsForSection(correctFirstTry: number, total: number): ShieldCount {
  if (!Number.isFinite(total) || total <= 0) {
    throw new RangeError(
      `shieldsForSection: "total" phải là số dương hữu hạn, nhận ${String(total)}. ` +
        'Phần rỗng là "chưa làm" — dùng readSectionShields() để nhận null thay vì một khiên giả.',
    );
  }
  if (!Number.isFinite(correctFirstTry)) {
    throw new RangeError(
      `shieldsForSection: "correctFirstTry" phải là số hữu hạn, nhận ${String(correctFirstTry)}.`,
    );
  }

  // Kẹp lại: dữ liệu bẩn (đúng nhiều hơn tổng, hoặc số âm) không được cho ra tỉ lệ > 1 hay < 0.
  const correct = Math.max(0, Math.min(correctFirstTry, total));
  const ratio = correct / total;

  if (ratio >= SHIELD_RATIO_FIVE) return 5;
  if (ratio >= SHIELD_RATIO_FOUR) return 4;
  if (ratio >= SHIELD_RATIO_THREE) return 3;
  if (ratio >= SHIELD_RATIO_TWO) return 2;
  // `correct = 0` LUÔN rơi xuống đây ⇒ 1 khiên, không bao giờ 0 (B1).
  return 1;
}

/** Tiến độ của một phần thi, đủ để quyết định "đã làm xong chưa" và tính khiên. */
export interface SectionShieldInput {
  /** Số câu bé ĐÚNG NGAY LẦN ĐẦU. */
  correctFirstTry: number;
  /** Số câu bé ĐÃ ĐI HẾT (đúng, kể cả phải sửa lại). */
  answered: number;
  /** Tổng số câu của phần (từ manifest). */
  total: number;
}

/**
 * Khiên ĐỌC RA từ tiến độ của một phần — trả `null` khi phần CHƯA HOÀN THÀNH.
 *
 * ⭐ NHIỆM VỤ DUY NHẤT: chặn cái bug "phần bé chưa mở vẫn hiện 1 khiên".
 *   `null` = KHÔNG có khiên để hiện (chưa làm, hoặc làm dở). `1..5` = phần đã làm xong.
 *   Nhờ vậy màn hình không bao giờ vẽ 🛡️ cho một phần bé chưa hề bắt đầu.
 */
export function readSectionShields(input: SectionShieldInput): ShieldCount | null {
  const { answered, total } = input;
  // Phần rỗng: không có gì để chấm ⇒ không có khiên.
  if (!Number.isFinite(total) || total <= 0) return null;
  // Chưa làm câu nào ⇒ chưa có khiên.
  if (!Number.isFinite(answered) || answered <= 0) return null;
  // Làm dở (chưa đi hết số câu) ⇒ chưa có khiên CHÍNH THỨC.
  if (answered < total) return null;
  return shieldsForSection(input.correctFirstTry, total);
}

/** Ba trạng thái của một phần thi, tách "chưa mở" khỏi "làm dở". */
export type SectionProgressState = 'not_started' | 'in_progress' | 'completed';

/**
 * Trạng thái của một phần, để UI nói đúng: mời bé BẮT ĐẦU, LÀM TIẾP, hay XEM KẾT QUẢ.
 *
 * ⚠️ Tách hẳn khỏi `readSectionShields` (dù suy ra được từ nó) vì hai câu hỏi khác nhau:
 *   "phần này có khiên chưa?" (để vẽ 🛡️) và "bé đang ở đâu?" (để chọn nút). Gộp chúng lại sẽ
 *   khiến nơi gọi phải tự suy, và tự suy là chỗ để lệch.
 */
export function sectionProgressState(
  progress: { answered: number; total: number } | null | undefined,
): SectionProgressState {
  const answered = progress?.answered ?? 0;
  const total = progress?.total ?? 0;
  if (!Number.isFinite(total) || total <= 0) return 'not_started';
  if (!Number.isFinite(answered) || answered <= 0) return 'not_started';
  if (answered < total) return 'in_progress';
  return 'completed';
}

/**
 * Khiên của phần NÓI — tính theo ĐỘ THAM GIA, KHÔNG theo độ đúng.
 *
 * ⚠️⚠️ TUYỆT ĐỐI KHÔNG dùng `shieldsForSection` cho phần Nói.
 *   Phần Nói KHÔNG chấm tự động (nhận dạng giọng trẻ em rất kém chính xác — chấm sẽ sai, và chấm
 *   sai là làm bé thất vọng). Bé nói đủ 4 part ⇒ 5 khiên ("đã bỏ công", không phải "đã đúng");
 *   chưa nói đủ ⇒ `null` (KHÔNG tính là 0, không hiện khiên). Đây là điểm chống "chấm sai" mạnh
 *   nhất — xem tài liệu §3.4.
 */
export function shieldsForSpeaking(completedParts: number, totalParts: number): ShieldCount | null {
  if (!Number.isFinite(totalParts) || totalParts <= 0) return null;
  if (!Number.isFinite(completedParts)) return null;
  if (completedParts < totalParts) return null;
  return 5;
}
