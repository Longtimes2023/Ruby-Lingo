/**
 * RubyLingo — LUẬT CHẤM ĐIỂM CỦA GAME.
 *
 * ⭐ VÌ SAO LUẬT NÀY NẰM Ở `shared/` CHỨ KHÔNG Ở CLIENT:
 *   Server là TRỌNG TÀI CUỐI (T049): client gửi lên các CON SỐ THÔ (đúng mấy câu, chuỗi dài
 *   nhất, số lần sai), server tự tính lại sao/điểm rồi mới ghi vào sổ của bé. Nếu luật nằm
 *   riêng ở client, hai bên sẽ lệch nhau ngay lần đầu ai đó sửa một bên — và triệu chứng là
 *   "bé thấy 3 sao trên màn hình, hôm sau mở lại còn 2 sao". Cùng lý do đã áp dụng cho
 *   `shared/theme-access.ts`.
 *
 * ⚠️⚠️ BA RÀNG BUỘC CỨNG — ĐỌC TRƯỚC KHI SỬA BẤT CỨ CON SỐ NÀO Ở ĐÂY:
 *
 *   1. **KHÔNG BAO GIỜ 0 SAO.** Hoàn thành là đã có thưởng. Bé 7 tuổi nhận 0 sao sẽ đọc đó là
 *      "mình dở", và đó đúng là thứ triết lý "KHÔNG BAO GIỜ MẮNG ĐỨA TRẺ" sinh ra để chặn.
 *   2. **KHÔNG TRỪ ĐIỂM KHI SAI.** Trả lời sai chỉ mất một mạng ❤️, không mất điểm. Bé phải
 *      dám thử — nếu thử sai bị phạt, bé sẽ ngồi im chờ gợi ý.
 *   3. **KHÔNG CÓ ĐỒNG HỒ.** Điểm chỉ dựa trên ĐỘ ĐÚNG, không dựa trên tốc độ. Dưới áp lực
 *      thời gian, bé 7 tuổi hoảng, bấm bừa, và không kịp suy nghĩ ⇒ phản tác dụng học tập.
 *
 *   Ba điều trên không phải "tinh chỉnh cho vui" — chúng là yêu cầu thiết kế, xem
 *   `GAME-REWARD-DESIGN.md` §2.3 và §3.2–3.3.
 */

import type { GameType } from './types/content.js';

// =============================================================================
// Hằng số luật chơi
// =============================================================================

/**
 * Cứ bao nhiêu câu đúng LIÊN TIẾP thì được +1 điểm.
 *
 * Đây là "phần thưởng chuỗi 🔥". Đứt chuỗi KHÔNG trừ gì — chỉ là chuỗi đếm lại từ 0.
 */
export const STREAK_BONUS_EVERY = 3;

/** Trần điểm thưởng chuỗi cho MỘT lượt chơi. */
export const STREAK_BONUS_MAX = 5;

/**
 * Số lần trả lời sai TỐI ĐA trong một câu trước khi hiện gợi ý.
 *
 * ⭐ Vì sao cần: không có giới hạn thì một bé bấm hết mọi lựa chọn sẽ tự "đoán mò" ra đáp án mà
 *   không hề suy nghĩ — mất luôn phần học. Sau 2 lần sai, ta CHỈ CHO bé đáp án (làm nổi bật lựa
 *   chọn đúng) và vẫn cho bé bấm vào nó: bé vẫn đi hết được câu, vẫn không bị mắng.
 */
export const MAX_WRONG_PER_ROUND = 2;

/**
 * Số mạng ❤️ của mỗi game. `0` = game KHÔNG có khái niệm trả lời sai nên không hiện mạng.
 *
 * ⚠️ Vì sao `memory_match` là 0: lật thẻ không có "sai" — lật hai thẻ không khớp chỉ là chưa
 *   tìm ra. Gán mạng cho nó sẽ biến một trò chơi trí nhớ thành một trò chơi may rủi có phạt.
 *
 * Vì sao các game còn lại là 5 chứ không phải 3: với 4 lựa chọn, một bé đang mò có thể đốt 3
 *   mạng chỉ trong một câu. 5 mạng cho bé đủ chỗ để thử mà không kết thúc lượt quá sớm.
 */
export const GAME_HEARTS: Record<GameType, number> = {
  // --- MVP ---
  listen_tap: 5,
  missing_letter: 5,
  prepositions: 5,
  memory_match: 0, // lật thẻ không có "sai"
  word_picture: 5,
  // --- P1 ---
  word_search: 5,
  number_match: 5,
  say_it: 5,
  word_builder: 5,
  sort_basket: 5,
  // --- P2 ---
  count_tap: 5,
  colour_learn: 5,
};

/**
 * Danh sách ĐẦY ĐỦ mọi `GameType`, dùng được LÚC CHẠY (không chỉ lúc biên dịch).
 *
 * ⭐ VÌ SAO SUY RA TỪ `GAME_HEARTS` CHỨ KHÔNG KHAI LẠI:
 *   `GameType` là một union ở mức KIỂU — nó biến mất sau khi biên dịch, nên không thể
 *   `z.enum(GameType)`. Ta cần một MẢNG thật để Zod kiểm dữ liệu client gửi lên.
 *
 *   `GAME_HEARTS` được khai là `Record<GameType, number>` ⇒ TypeScript BẮT BUỘC phải có đủ
 *   mọi khoá. Thêm một `GameType` mới mà quên khai ở đó là **lỗi biên dịch**, không phải lỗi
 *   lúc chạy. Vì vậy khoá của nó chính là danh sách đầy đủ, và danh sách này không thể lệch
 *   với union — khác hẳn một mảng chép tay luôn có nguy cơ lệch.
 */
export const GAME_TYPES = Object.keys(GAME_HEARTS) as GameType[];

/**
 * Điểm đầy đủ cho MỘT câu / một cặp, theo từng game (bảng `GAME-REWARD-DESIGN.md` §2.2).
 */
export const GAME_ROUND_POINTS: Record<GameType, number> = {
  // --- MVP ---
  listen_tap: 2, // +2 điểm/câu
  missing_letter: 2, // +2 điểm/từ đúng ngay lần đầu
  prepositions: 3, // +3 điểm/câu
  memory_match: 5, // +5 điểm/cặp
  word_picture: 3, // +3 điểm/cặp
  // --- P1 ---
  word_search: 2, // +2 điểm/từ
  number_match: 2, // +2 điểm/cặp
  say_it: 3, // +3 điểm/từ
  word_builder: 3, // +3 điểm/từ
  sort_basket: 2, // +2 điểm/món
  // --- P2 ---
  count_tap: 2, // +2 điểm/lượt
  colour_learn: 2, // +2 điểm/hình
};

// =============================================================================
// Sao
// =============================================================================

/** Xếp hạng sao. KHÔNG có giá trị 0 — xem ràng buộc cứng #1 ở đầu file. */
export type StarRating = 1 | 2 | 3;

/**
 * Ngưỡng tỉ lệ đúng để đạt 2 và 3 sao.
 *
 * ⚠️ `0.9` khớp với "≥ 90% câu (hoặc ≤ 1 lỗi)": với 10 câu, 9/10 = 0,9 ⇒ đúng 3 sao.
 *   Đừng nâng lên 0.95 — với 10 câu thì 0.95 đòi 10/10 tuyệt đối, và một câu sai duy nhất
 *   sẽ rơi thẳng xuống 2 sao. Quá khắt khe với bé 7 tuổi.
 */
export const STAR_THRESHOLD_THREE = 0.9;
export const STAR_THRESHOLD_TWO = 0.7;

/**
 * ⭐ VÌ SAO CẦN THÊM NGƯỠNG THEO SỐ LỖI, KHÔNG CHỈ THEO TỈ LỆ:
 *
 *   Thiết kế viết "⭐⭐⭐ Đúng **≥ 90%** câu (**hoặc ≤ 1 lỗi**)". Hai cách nói đó chỉ trùng nhau
 *   khi số câu chia hết cho 10. Với 6 câu (đúng bằng `rounds` của `missing_letter`):
 *     90% của 6 = 5,4 ⇒ đòi đúng CẢ 6 câu mới được 3 sao.
 *   Nhưng "≤ 1 lỗi" của 6 câu là 5/6 — tức 83%.
 *   Đọc theo tỉ lệ thuần thì một bé sai đúng MỘT câu trong 6 bị tụt xuống 2 sao, trong khi
 *   thiết kế nói rõ một lỗi vẫn được 3 sao.
 *
 *   Thêm nhánh theo số lỗi còn có tác dụng thứ hai: nó làm thang sao **mượt** thay vì có vực.
 *   Đọc thuần theo tỉ lệ với 4 câu (đúng bằng `rounds` của `prepositions`), thang là
 *   4/4→3, 3/4→2, 2/4→1: sai thêm một câu là rơi một bậc, không có bậc đệm.
 *
 *   Nên: 3 sao khi tỉ lệ ≥ 90% **hoặc** chỉ sai ≤ 1 câu; 2 sao khi tỉ lệ ≥ 70% **hoặc** sai ≤ 2 câu.
 *   Hệ quả đã biết và CHẤP NHẬN: với game 4 câu, một lỗi vẫn được 3 sao — cố ý rộng rãi, đúng
 *   tinh thần "không tạo áp lực". Đổi lại, thang sao ở 4 câu là 4→3, 3→3, 2→2, 1→1, 0→1.
 */
export const STAR_MAX_ERRORS_THREE = 1;
export const STAR_MAX_ERRORS_TWO = 2;

/**
 * Kẹp một số bất kỳ về miền sao hợp lệ `0 | 1 | 2 | 3`.
 *
 * ⚠️ VẪN CẦN HÀM NÀY dù `starsForRun()` đã luôn trả 1–3 và DB có
 *    `CHECK (stars_best BETWEEN 0 AND 3)`:
 *      • Ràng buộc trong DB bảo vệ dữ liệu **GHI VÀO**, không bảo vệ dữ liệu **ĐỌC RA**. Một
 *        DB bị sửa tay hoặc phục hồi từ bản sao lưu cũ vẫn có thể chứa giá trị ngoài khoảng.
 *      • Kiểu `0 | 1 | 2 | 3` của TypeScript là lời hứa ở mức **BIÊN DỊCH** — nó không kiểm
 *        tra gì lúc chạy, nên `select` trả về `7` vẫn được coi là hợp lệ.
 *
 * ⚠️ `NaN` PHẢI ĐƯỢC CHẶN RIÊNG: mọi phép so sánh với `NaN` đều trả `false`, nên nếu không có
 *    dòng kiểm `Number.isFinite` ở đầu, `NaN` sẽ rơi xuống nhánh cuối và biến thành **2 sao** —
 *    một giá trị trông hoàn toàn hợp lệ, khiến lỗi dữ liệu đi qua im lặng thay vì lộ ra.
 */
export function clampStarsBest(value: number): 0 | 1 | 2 | 3 {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 3) return 3;
  return value === 1 ? 1 : 2;
}

/**
 * Sao của một lượt chơi, tính theo **tỉ lệ đúng NGAY LẦN ĐẦU** (và số lỗi — xem ghi chú trên).
 *
 * ⚠️ Dùng "đúng ngay lần đầu" chứ không phải "đúng sau khi sửa": nếu tính cả câu phải sửa thì
 *   mọi bé đều được 3 sao (vì bé nào cũng sửa tới khi đúng), và sao mất hết ý nghĩa.
 *
 * `total <= 0` ⇒ trả 1 sao, KHÔNG trả 0. Một lượt chơi rỗng vẫn không được mắng bé.
 */
export function starsForRun(correctFirstTry: number, total: number): StarRating {
  if (total <= 0) return 1;

  // Kẹp lại để dữ liệu bẩn (đúng nhiều hơn tổng) không cho ra tỉ lệ > 1.
  const safeCorrect = Math.max(0, Math.min(correctFirstTry, total));
  const errors = total - safeCorrect;
  const ratio = safeCorrect / total;

  if (ratio >= STAR_THRESHOLD_THREE || errors <= STAR_MAX_ERRORS_THREE) return 3;
  if (ratio >= STAR_THRESHOLD_TWO || errors <= STAR_MAX_ERRORS_TWO) return 2;
  return 1;
}

// =============================================================================
// Điểm
// =============================================================================

/**
 * Điểm thưởng chuỗi 🔥, suy từ chuỗi đúng LIÊN TIẾP DÀI NHẤT của lượt chơi.
 *
 * ⭐ Vì sao suy từ `longestStreak` mà không đếm dồn trong lúc chơi:
 *   Server phải tính lại được ĐÚNG con số này chỉ từ dữ liệu thô. Nếu client đếm dồn (mỗi lần
 *   chuỗi chạm bội số của 3 thì +1) mà server lại suy từ `longestStreak`, hai bên sẽ lệch nhau
 *   ở trường hợp có NHIỀU chuỗi ngắn (ví dụ hai chuỗi 3 câu ⇒ client +2, server +1).
 *   Một luật, hai nơi gọi cùng một hàm — đó là cách duy nhất để không lệch.
 *
 * Hệ quả đã biết và CHẤP NHẬN: nhiều chuỗi ngắn được thưởng ít hơn một chuỗi dài cùng độ dài
 *   tổng. Điều này khuyến khích bé giữ chuỗi — đúng ý đồ thiết kế.
 */
export function streakBonusFor(longestStreak: number): number {
  if (longestStreak < STREAK_BONUS_EVERY) return 0;
  const milestones = Math.floor(longestStreak / STREAK_BONUS_EVERY);
  return Math.min(STREAK_BONUS_MAX, milestones);
}

/**
 * Điểm cho một câu, tuỳ bé đúng ngay lần đầu hay phải sửa lại.
 *
 * Đúng ngay lần đầu ⇒ điểm đầy đủ. Phải sửa ⇒ một nửa, nhưng **ít nhất 1 điểm** — để câu nào
 * cũng đóng góp một cái gì đó, không có câu nào là "công cốc".
 */
export function pointsForRound(fullPoints: number, firstTry: boolean): number {
  if (fullPoints <= 0) return 0;
  if (firstTry) return fullPoints;
  return Math.max(1, Math.floor(fullPoints / 2));
}

// =============================================================================
// Tổng kết một lượt chơi
// =============================================================================

/**
 * Dữ liệu THÔ của một lượt chơi — đúng thứ client gửi lên server ở T049.
 *
 * ⚠️ Cố ý chỉ chứa các CON SỐ ĐẾM ĐƯỢC, không chứa điểm hay sao. Điểm và sao do server tính
 *   từ những con số này (và client cũng tính bằng cùng hàm, chỉ để hiện ngay cho bé thấy).
 *   Nếu client gửi thẳng "tôi được 3 sao", một bé tò mò mở devtools là sửa được sổ của mình.
 */
export interface GameRunRaw {
  /** Tổng số câu của lượt chơi (theo `config.rounds`). */
  totalRounds: number;
  /** Số câu bé trả lời đúng NGAY LẦN ĐẦU. */
  correctFirstTry: number;
  /** Số câu bé đã đi hết (đúng, kể cả phải sửa lại). */
  answered: number;
  /** Tổng số lần trả lời sai trong cả lượt. */
  wrongAttempts: number;
  /** Chuỗi đúng liên tiếp DÀI NHẤT. */
  longestStreak: number;
  /** Lượt chơi kết thúc sớm vì hết mạng ❤️ (không phải "thua" — xem `GameRunResult`). */
  endedEarly: boolean;
  /**
   * Điểm câu đã cộng dồn trong lúc chơi (`Σ pointsForRound(...)`).
   *
   * ⚠️ Trường này do BÊN CHƠI đưa vào chứ không suy ra được từ các trường đếm ở trên: điểm mỗi
   *   câu phụ thuộc bé đúng ngay lần đầu hay phải sửa, mà thông tin đó chỉ có ở chuỗi sự kiện.
   *   Ở T049 server sẽ cộng lại con số này từ chính chuỗi sự kiện nó nhận được, nên đây KHÔNG
   *   phải chỗ hở để gian lận — chỉ là chỗ để client hiện kết quả ngay cho bé thấy.
   */
  roundScore: number;
}

/** Kết quả đã chấm của một lượt chơi. */
export interface GameRunResult {
  stars: StarRating;
  /** Điểm thô: điểm câu + thưởng chuỗi. */
  score: number;
  /** Điểm riêng của phần thưởng chuỗi 🔥 — tách ra để màn kết quả kể được "nhờ chuỗi". */
  streakBonus: number;
  /** Số câu đúng ngay lần đầu, trên tổng số câu ĐÃ ĐI QUA. */
  correctFirstTry: number;
  /**
   * Số câu đã đi qua. Khi `endedEarly`, con số này NHỎ HƠN `totalRounds`.
   *
   * ⭐ Đây là lý do trường này tồn tại chứ không dùng thẳng `totalRounds`: nếu chia cho
   *   `totalRounds` khi bé hết mạng sớm, bé bị tính là "sai" cả những câu CHƯA HỀ ĐƯỢC HỎI.
   *   Ví dụ: 4 câu đầu đúng cả 4 rồi hết mạng ở câu 5 — chia cho 10 sẽ ra 40% và bé chỉ được
   *   1 sao, dù bé chưa từng trả lời sai câu nào.
   */
  answered: number;
  /** Tổng số câu của lượt chơi theo kế hoạch. */
  totalRounds: number;
  /** `true` nếu bé đi hết được cả lượt. `false` nếu hết mạng giữa chừng. */
  completed: boolean;
  longestStreak: number;
}

/**
 * Chấm một lượt chơi từ dữ liệu thô. HÀM THUẦN — không đọc giờ, không đọc mạng, không React.
 *
 * ⭐ `completed` chỉ nói "bé có đi hết số câu theo kế hoạch hay không", dùng để CHỌN CÂU KHEN.
 *   Nó KHÔNG dùng để chặn phần thưởng: bé hết mạng giữa chừng vẫn nhận đủ sao và sticker.
 *   Không có nhánh nào ở đây trả về "thua" — đó là ràng buộc cứng #1 ở đầu file.
 */
export function summarizeGameRun(raw: GameRunRaw): GameRunResult {
  // Mẫu số là số câu ĐÃ ĐI QUA, không phải số câu theo kế hoạch — xem ghi chú ở `answered`.
  const answered = Math.max(0, Math.min(raw.answered, raw.totalRounds));
  const correctFirstTry = Math.max(0, Math.min(raw.correctFirstTry, answered));
  const streakBonus = streakBonusFor(raw.longestStreak);
  const roundScore = Math.max(0, raw.roundScore);

  return {
    stars: starsForRun(correctFirstTry, answered),
    score: roundScore + streakBonus,
    streakBonus,
    correctFirstTry,
    answered,
    totalRounds: raw.totalRounds,
    completed: !raw.endedEarly && answered >= raw.totalRounds,
    longestStreak: raw.longestStreak,
  };
}
