/**
 * RubyLingo — Kiểu dữ liệu TIẾN ĐỘ HỌC (dùng chung client + server).
 *
 * Nguyên tắc: tiến độ lưu ở cấp TỪNG TỪ (`WordProgress`), không chỉ cấp bài —
 * vì báo cáo phụ huynh và tính năng ôn tập từ hay sai cần dữ liệu này.
 *
 * Mọi bản ghi đều thuộc một `childId`; server suy ra quyền sở hữu qua
 * `child_profile.parent_id` ⇒ client KHÔNG bao giờ được tin `childId` do nó gửi lên.
 */

// `RewardGrant` sống ở miền "thưởng" (reward.ts) nhưng progress.ts vừa DÙNG vừa
// RE-EXPORT nó ⇒ cần cả `import` (để dùng trong file) lẫn `export` (để nơi khác
// vẫn import được từ progress.js như trước).
import type { GameType } from './content.js';
import type { RewardGrant } from './reward.js';
export type { RewardGrant };

/** Trạng thái học của một từ với một bé. */
export interface WordProgress {
  childId: string;
  wordId: string;
  /** Bé đã từng gặp từ này trong flashcard chưa. */
  learned: boolean;
  /** Bé đã trả lời đúng từ này >= 3 lần ⇒ coi như nhớ. */
  mastered: boolean;
  correctCount: number;
  wrongCount: number;
  /** Lần cuối bé gặp từ này (ISO UTC). Dùng cho ôn tập từ hay sai. */
  lastSeenAt: string | null;
  updatedAt: string;
}

/** Trạng thái một bài học. */
export interface LessonProgress {
  childId: string;
  lessonId: string;
  /** Điểm cao nhất từng đạt (không bao giờ giảm). */
  bestScore: number;
  /** Số sao cao nhất từng đạt, 0–3 (không bao giờ giảm). */
  starsBest: 0 | 1 | 2 | 3;
  attempts: number;
  completed: boolean;
  completedAt: string | null;
  updatedAt: string;
}

/** Trạng thái một chủ đề trên bản đồ. */
export interface ThemeProgress {
  childId: string;
  themeId: string;
  unlocked: boolean;
  unlockedAt: string | null;
  lessonsCompleted: number;
  starsEarned: number;
  updatedAt: string;
}

/** Thống kê theo ngày — nguồn dữ liệu cho báo cáo phụ huynh. */
export interface DailyStat {
  childId: string;
  /** Ngày theo giờ địa phương của gia đình, dạng YYYY-MM-DD. */
  date: string;
  wordsLearned: number;
  questionsAnswered: number;
  correctCount: number;
  starsEarned: number;
  acornsEarned: number;
  xpEarned: number;
  /** Số giây bé thực sự tương tác (không tính thời gian mở tab rồi bỏ đi). */
  activeSeconds: number;
  updatedAt: string;
}

/**
 * Một thay đổi tiến độ chờ đồng bộ.
 * `clientEventId` để server chống ghi trùng khi client retry (mất mạng rồi gửi lại).
 */
export interface ProgressEvent {
  clientEventId: string;
  kind: 'word_answer' | 'word_learned' | 'lesson_completed';
  wordId?: string;
  lessonId?: string;
  /** Bé trả lời đúng hay sai (chỉ dùng cho kind = 'word_answer'). */
  correct?: boolean;
  occurredAt: string;
}

/** Ảnh chụp toàn bộ tiến độ của một bé — trả về từ GET /api/children/:id/progress. */
export interface ProgressSnapshot {
  childId: string;
  words: WordProgress[];
  lessons: LessonProgress[];
  themes: ThemeProgress[];
  dailyStats: DailyStat[];
  /** Thời điểm server tạo ảnh chụp (ISO UTC) — client dùng để so LWW. */
  serverTime: string;
}

/**
 * Một câu trả lời trong một lượt chơi game.
 *
 * ⭐ MỘT CÂU = MỘT TỪ. Điều này đúng với cả 5 game MVP (`listen_tap`, `missing_letter`,
 *   `prepositions`, `memory_match`, `word_picture`): mỗi vòng chơi gắn với đúng một từ. Nhờ
 *   vậy server mới quy được tiến độ về cấp TỪNG TỪ — thứ mà báo cáo phụ huynh và tính năng
 *   "ôn lại từ hay sai" cần.
 */
export interface GameAnswerRecord {
  /**
   * Từ của câu này — hoặc `null` nếu câu này KHÔNG thuộc về một từ vựng nào.
   *
   * ⚠️⚠️ VÌ SAO PHẢI CHO PHÉP `null` — ĐỪNG ĐỔI LẠI THÀNH `string`:
   *
   *   Không phải mọi game đều dạy TỪ VỰNG. `prepositions` (G4) dạy một GIỚI TỪ trong một câu
   *   ("The cat is **on** the box"); `config.slots[i]` chỉ có `sentenceEn`/`preposition`, KHÔNG
   *   có `wordId`. Các game P1/P2 (`number_match`, `count_tap`, `colour_learn`) cũng vậy — chúng
   *   dạy số và màu, không dạy từ.
   *
   *   Nếu bắt buộc phải có `wordId`, chỉ còn hai cách, cả hai đều tệ:
   *     1. Gán bừa một từ của bài cho câu đó ⇒ `word_progress` của bé nhận một con số SAI, và
   *        vì tiến độ là "thành tựu không bao giờ mất" (xem `mergeWordProgress`), nó ở lại
   *        VĨNH VIỄN.
   *     2. Bỏ hẳn câu đó khỏi `answers` ⇒ `answers.length` nhỏ hơn `totalRounds`, mà server
   *        suy `answered` từ `answers.length` ⇒ bé chơi hết cả ván vẫn bị coi là **bỏ dở** và
   *        chỉ nhận **1 sao**. Một hình phạt cho việc chơi đúng — vi phạm thẳng ràng buộc cứng
   *        #1 ("không bao giờ 0/1 sao oan").
   *
   *   Nên: `null` là câu trả lời ĐÚNG. Câu vẫn được tính vào điểm, sao, và thống kê ngày —
   *   chỉ là nó không đóng góp gì cho `word_progress`. Server bỏ qua những câu như vậy ở tầng
   *   ghi tiến độ TỪNG TỪ (`deriveRun` không sinh `attempt` nào cho chúng).
   */
  wordId: string | null;
  /** Bé trả lời đúng NGAY LẦN ĐẦU (không phải sửa). Đây là con số quyết định số sao. */
  firstTry: boolean;
  /**
   * Số lần bé chọn SAI ở câu này trước khi giải xong. `0` nếu đúng ngay.
   *
   * ⚠️ Không dùng con số này để phạt — chỉ để ghi `word_progress.wrong_count`, tức là "từ
   *   này bé còn yếu". Bé vẫn đi hết câu, vẫn được điểm, vẫn không bị mắng.
   */
  wrongAttempts: number;
}

/**
 * Dữ liệu THÔ của một lượt chơi game — đúng thứ client gửi lên server ở T049.
 *
 * ⚠️⚠️ HỢP ĐỒNG NÀY CỐ Ý TỐI GIẢN: NÓ **KHÔNG** CHỨA ĐIỂM, SAO, HAY SỐ ĐẾM.
 *
 *   `answered`, `correctFirstTry`, `wrongAttempts`, `longestStreak`, `endedEarly` — TẤT CẢ
 *   đều SUY RA ĐƯỢC từ `answers` + `totalRounds`, nên không có trường nào cho chúng ở đây.
 *
 *   Đây không phải chuyện tiết kiệm vài byte. Mỗi con số client tự khai là một con số có thể
 *   MÂU THUẪN với chính `answers` nó gửi kèm — và khi ấy server phải chọn tin bên nào. Bỏ
 *   hẳn chúng đi thì câu hỏi đó không còn tồn tại, và không ai gian lận được bằng cách sửa
 *   một trường trong JSON (`{"correctFirstTry": 999}`) vì server không đọc trường đó nữa.
 *
 *   Hệ quả: `totalRounds` vẫn phải gửi vì nó KHÔNG suy ra được từ `answers` — bé có thể hết
 *   mạng giữa chừng, và khi ấy số câu ĐÃ ĐI QUA nhỏ hơn số câu THEO KẾ HOẠCH.
 */
export interface GameResultSubmission {
  /** Mã do client sinh, UNIQUE phía server ⇒ gửi lại không bị tính hai lần. */
  clientEventId: string;
  exerciseId: string;
  lessonId: string;
  gameType: GameType;
  /** Tổng số câu THEO KẾ HOẠCH của lượt chơi (`config.rounds`). */
  totalRounds: number;
  /**
   * Thời điểm lượt chơi KẾT THÚC, do CLIENT ghi (ISO-8601 UTC).
   *
   * ⚠️ KHÔNG dùng giờ server nhận được. Bé chơi trên iPad không có wifi rồi hôm sau mới có
   *    mạng: nếu lấy giờ server, lượt chơi hôm qua sẽ mang thời điểm hôm nay và THẮNG mọi bản
   *    ghi khác trong luật "lần ghi sau thắng" (xem `shared/progress-merge.ts`) — đè mất tiến
   *    độ bé vừa làm trên thiết bị khác. Giờ của chính lượt chơi mới là mốc đúng.
   */
  occurredAt: string;
  /** Số giây bé chơi lượt này. Chỉ để thống kê — KHÔNG ảnh hưởng điểm (xem ràng buộc #3). */
  durationSeconds: number;
  /** Các câu trả lời, THEO ĐÚNG THỨ TỰ bé chơi. Thứ tự này là thứ cho phép suy `longestStreak`. */
  answers: GameAnswerRecord[];
}

/** Kết quả đã được server chấm (client KHÔNG tự quyết định sao/thưởng). */
export interface GameResultAward {
  /** Điểm thô của lượt này: điểm các câu + thưởng chuỗi 🔥. */
  score: number;
  /** Số sao của lượt này. KHÔNG BAO GIỜ là 0 — xem ràng buộc cứng #1 ở `game-scoring.ts`. */
  stars: 1 | 2 | 3;
  /** Điểm cao nhất từng đạt cho bài này, SAU lượt này. Không bao giờ giảm. */
  bestScore: number;
  /** Số sao cao nhất từng đạt cho bài này, SAU lượt này. Không bao giờ giảm. */
  bestStars: 0 | 1 | 2 | 3;
  /** Lượt này có phá kỷ lục điểm cũ không. */
  isNewRecord: boolean;
  /**
   * `true` nếu lượt chơi này ĐÃ được ghi từ trước (client gửi lại sau khi mất phản hồi).
   * Khi đó mọi trường thưởng đều là 0 và KHÔNG có gì được cộng thêm — đúng như mong đợi.
   */
  duplicate: boolean;
  /** XP nhận được ở lượt này, ĐÃ cộng vào `xp_state`. `0` khi `duplicate`. */
  xpGained: number;
  /**
   * ⭐ nhận được ở lượt này, ĐÃ cộng vào ví. `0` khi `duplicate`.
   *
   * ⚠️ KHÔNG chỉ là thưởng của ván — nó GỘP cả quà của (các) cấp vừa vượt qua trong cùng lượt.
   *    Đó là con số nên hiện cho bé, vì nó khớp với số dư ví tăng lên. Nếu chỉ báo phần thưởng
   *    của ván, bé tự cộng lại và thấy lệch mà không có gì giải thích khoản chênh.
   */
  starsGained: number;
  /** 🌰 nhận được ở lượt này, ĐÃ cộng vào ví — cùng quy tắc gộp như `starsGained`. */
  acornsGained: number;
  /**
   * Có lên cấp không — nếu có, client hiện overlay ăn mừng.
   *
   * `null` khi lượt này không vượt cấp nào, HOẶC khi `duplicate` (lượt cũ gửi lại — xem ghi chú
   * ở trường `duplicate`, không được ăn mừng lại).
   *
   * ⚠️ Nhảy qua nhiều cấp trong một lượt là BÌNH THƯỜNG (`from`→`to` có thể cách nhau > 1), và
   *    `rewards` liệt kê quà của MỌI cấp đã vượt — không được chỉ lấy cấp cuối.
   */
  levelUp: { from: number; to: number; rewards: RewardGrant[] } | null;
  /**
   * Id những nhiệm vụ VỪA hoàn thành trong lượt này — để client báo "Bé vừa xong nhiệm vụ X!".
   *
   * ⚠️ CHỈ LÀ THÔNG BÁO, KHÔNG PHẢI "QUÀ ĐÃ ĐƯỢC TRAO".
   *    Quà của nhiệm vụ chỉ được trao khi BÉ BẤM "Nhận thưởng" ở màn Nhiệm vụ (`QuestService.claim`).
   *    Trao luôn ở đây sẽ khiến nhiệm vụ không bao giờ hiện ở trạng thái "chờ nhận" — và khoảnh
   *    khắc bé thấy mình vừa được thưởng biến mất.
   *
   * Luôn `[]` khi `duplicate` (lượt cũ gửi lại không được báo lại lần nữa).
   */
  questsCompleted: string[];
  /**
   * Huy hiệu MỚI THỰC SỰ được trao ở lượt này. `[]` khi `duplicate`.
   *
   * ⚠️ Đây là PHẦN CHÊNH, khác `levelUp.rewards` — danh sách kia là ĐỊNH NGHĨA thô của cấp và
   *    có thể chứa món bé đã có từ đường khác. UI dùng danh sách này để bật thông báo "huy hiệu
   *    mới"; dùng `levelUp.rewards` để vẽ màn quà lên cấp. Lẫn hai thứ là ăn mừng hai lần.
   *
   * Huy hiệu đến từ HAI nguồn (đã gộp): quà của (các) cấp vừa vượt qua (T053) và huy hiệu
   * theo THÀNH TÍCH do `BadgeService` đánh giá (T068). Gộp ở server để client chỉ việc bật một
   * thông báo "Bé vừa có huy hiệu mới", không phải tự ghép hai danh sách.
   */
  badgesEarned: string[];
  /** Sticker vừa mở ở lượt này (T069). `null` khi bài không có sticker, hoặc sticker đã mở rồi. */
  stickerEarned: string | null;
}

// =============================================================================
// Kết quả game ĐÃ CHƠI, gộp theo bài tập (T05) — nguồn dữ liệu cho chip trò chơi
// =============================================================================

/**
 * Tổng hợp kết quả ĐÃ CHƠI của MỘT bài tập (`exerciseId`), do server gộp từ bảng `game_result`.
 *
 * ⭐ VÌ SAO CẦN, KHI ĐÃ CÓ `LessonProgress.starsBest`:
 *   Một BÀI có nhiều GAME (5 trò MVP). `LessonProgress.starsBest` là sao của BÀI — dùng nó tô
 *   cho TỪNG chip trò chơi là NÓI DỐI: một trò chưa từng chơi cũng sáng sao. Chip cần biết
 *   "RIÊNG trò này đã chơi chưa", mà thông tin đó chỉ có ở cấp `exercise_id`.
 *
 * ⚠️ `bestStars` là `MAX(stars)` của MỌI lượt cho bài tập này, không phải sao của lượt gần nhất.
 *    Thành tựu của bé KHÔNG BAO GIỜ giảm (xem `GameResultAward.bestStars`) — chip phải phản ánh
 *    đúng điều đó.
 */
export interface GameResultSummary {
  /** `exercise.id` — "{lessonId}/{game-slug}". */
  exerciseId: string;
  /** Sao CAO NHẤT từng đạt cho bài tập này. `0` chỉ xuất hiện khi chưa chơi (server không trả
   *  hàng cho bài chưa chơi). */
  bestStars: 0 | 1 | 2 | 3;
  /** Điểm cao nhất từng đạt cho bài tập này. */
  bestScore: number;
  /** Số lượt đã chơi bài tập này. */
  attempts: number;
  /** Lượt chơi gần nhất (ISO UTC). */
  lastPlayedAt: string;
}

/**
 * Phản hồi của `GET /api/children/:id/game-results`.
 *
 * ⚠️ ĐÂY LÀ DỮ LIỆU CHỈ-ĐỌC. Client KHÔNG bao giờ gửi ngược nó lên (đó là lý do nó KHÔNG nằm
 *    trong `ProgressSnapshot`) — xem ghi chú ở `shared/schemas/progress.ts`.
 */
export interface GameResultsResponse {
  childId: string;
  results: GameResultSummary[];
  serverTime: string;
}
