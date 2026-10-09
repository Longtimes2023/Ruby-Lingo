/**
 * RubyLingo — `useGameEngine`: bộ đếm dùng chung cho MỌI game.
 *
 * ⭐ VÌ SAO PHẢI CÓ MỘT ENGINE DÙNG CHUNG, KHÔNG ĐỂ MỖI GAME TỰ ĐẾM:
 *   Bé không phải học lại cách chơi ở mỗi trò. Mạng ❤️, chuỗi 🔥, "Câu 3 / 10", và luật chấm
 *   điểm phải GIỐNG HỆT nhau ở cả 12 game — nếu mỗi game tự đếm, sớm muộn một game sẽ cộng
 *   điểm sai, hoặc trừ mạng sai, và triệu chứng là "trò này dễ kiếm sao hơn trò kia" mà không
 *   ai biết vì sao.
 *
 * ⭐ ENGINE CHỈ BIẾT HAI SỰ KIỆN — MỌI GAME ĐỀU QUY VỀ HAI CÁI ĐÓ:
 *
 *   `attempt(correct)`  — bé vừa ĐƯA RA MỘT LỰA CHỌN.
 *                         Sai ⇒ mất 1 mạng ❤️, đứt chuỗi 🔥, và sau `MAX_WRONG_PER_ROUND` lần
 *                         sai trong cùng một câu thì bật gợi ý.
 *                         KHÔNG trừ điểm — xem ràng buộc cứng #2 ở `shared/game-scoring.ts`.
 *
 *   `completeRound()`   — bé vừa GIẢI XONG một câu / một cặp.
 *                         Đây mới là lúc cộng điểm và đếm "đúng ngay lần đầu".
 *
 *   Tách hai việc này là điều kiện để một engine phục vụ được cả 5 game rất khác nhau:
 *     • `listen_tap` / `prepositions`: một cú chạm đúng ⇒ `attempt(true)` + `completeRound()`.
 *     • `missing_letter`: MỖI chữ cái bé gõ là một `attempt`; chỉ khi từ đầy đủ mới
 *       `completeRound()`. Nếu gộp làm một, một từ 9 chữ cái sẽ bị tính là 9 "câu".
 *     • `memory_match`: một cặp khớp ⇒ `attempt(true)` + `completeRound()`. Lật hai thẻ không
 *       khớp KHÔNG gọi `attempt(false)` — đó là chưa tìm ra, không phải trả lời sai (xem
 *       `GAME_HEARTS.memory_match === 0`).
 *
 * ⚠️ KHÔNG CÓ TRẠNG THÁI THUA. Hết mạng ⇒ `finished = true` với `endedEarly = true`, và bé
 *   VẪN nhận sao. Tên trường cố ý không có chữ "lose"/"fail" để không ai vô tình viết ra một
 *   màn hình mắng trẻ.
 *
 * ⚠️ KHÔNG GỌI CALLBACK KHI KẾT THÚC. Kết quả được TÍNH RA từ state (`result`) chứ không đẩy
 *   qua `onFinish`. Lý do: trong `StrictMode`, React chạy hiệu ứng hai lần, và một callback
 *   `onFinish` sẽ bắn hai lần ⇒ ghi hai sự kiện hoàn thành lên server. Trả kết quả như dữ liệu
 *   thì không có gì để bắn hai lần.
 *
 * ⭐ ENGINE CŨNG GIỮ NHẬT KÝ TỪNG CÂU (`state.answers`) — KHÔNG ĐỂ GAME TỰ GIỮ.
 *   T049 cần gửi lên server "ván này bé đã làm gì": mỗi câu là từ nào, có đúng ngay lần đầu
 *   không, đã chọn sai mấy lần. Ba thông tin đó chỉ đúng vào ĐÚNG khoảnh khắc câu kết thúc —
 *   mà lúc đó `wrongThisRound` là biến của ENGINE. Game tự đếm lại nghĩa là 12 game có 12 cách
 *   đếm, và một game đếm sai sẽ ghi số sai vào sổ của bé VĨNH VIỄN (tiến độ không bao giờ mất).
 *   Vì vậy game chỉ phải nói MỘT điều mà chỉ nó biết: câu này là TỪ NÀO.
 */

import { useCallback, useMemo, useReducer } from 'react';

import type { GameRunResult } from '@shared/game-scoring.js';
import type { GameAnswerRecord } from '@shared/types/progress.js';
import {
  MAX_WRONG_PER_ROUND,
  pointsForRound,
  summarizeGameRun,
} from '@shared/game-scoring.js';

export interface GameEngineState {
  /** Câu hiện tại, 0-based. Khi `finished` thì bằng số câu đã đi qua. */
  index: number;
  /**
   * Tổng số câu theo kế hoạch (`config.rounds`).
   *
   * ⭐ Có mặt trong state công khai vì `GameShell` cần nó để vẽ "Câu 3 / 10" và `ProgressDots`.
   *   Nếu để riêng ở trong reducer, mỗi game sẽ phải tự truyền lại con số đó xuống `GameShell`
   *   — và một game truyền sai là thanh tiến độ nói sai mà không có gì báo.
   */
  totalRounds: number;
  /** Mạng còn lại. `0` khi game không có khái niệm mạng (xem `maxHearts`). */
  hearts: number;
  maxHearts: number;
  /** Chuỗi đúng liên tiếp hiện tại. */
  streak: number;
  /** Chuỗi đúng liên tiếp dài nhất của lượt chơi. */
  longestStreak: number;
  /** Số câu đúng NGAY LẦN ĐẦU. Đây là con số quyết định số sao. */
  correctFirstTry: number;
  /** Số câu đã giải xong (kể cả phải sửa). */
  answered: number;
  /** Tổng số lần trả lời sai trong cả lượt. */
  wrongAttempts: number;
  /** Số lần sai trong CÂU HIỆN TẠI — dùng để quyết định đã tới lúc gợi ý chưa. */
  wrongThisRound: number;
  /** Điểm câu đã cộng dồn (chưa gồm thưởng chuỗi). */
  roundScore: number;
  /** Lượt chơi đã kết thúc chưa (đi hết, hoặc hết mạng). */
  finished: boolean;
  /** Kết thúc vì hết mạng ❤️ giữa chừng. KHÔNG phải "thua". */
  endedEarly: boolean;
  /**
   * Nhật ký TỪNG CÂU đã đi qua, theo đúng thứ tự bé chơi — dữ liệu thô để gửi lên server ở
   * T049 (`game-result`). Server chấm lại điểm/sao từ mảng này, nên nó phải phản ánh ĐÚNG
   * những gì đã xảy ra, không phải những gì bé muốn.
   *
   * ⚠️ `wordId` có thể là `null` — xem `GameAnswerRecord.wordId` ở `shared/types/progress.ts`.
   *    `prepositions` dạy giới từ trong một câu, `number_match`/`count_tap`/`colour_learn`
   *    dạy số và màu: chúng không có từ vựng để quy về.
   */
  answers: GameAnswerRecord[];
}

export interface UseGameEngineOptions {
  /** Tổng số câu theo `config.rounds`. */
  totalRounds: number;
  /**
   * Số mạng ❤️. `0` = game không có trả lời sai (ví dụ `memory_match`) ⇒ không hiện mạng và
   * `attempt(false)` không trừ gì.
   */
  maxHearts: number;
  /** Điểm đầy đủ cho một câu, theo `GAME_ROUND_POINTS[gameType]`. */
  roundPoints: number;
}

export interface UseGameEngineResult {
  state: GameEngineState;
  /**
   * Bé vừa đưa ra một lựa chọn.
   *
   * Trả về `true` nếu đây là lượt chơi CUỐI CÙNG vừa kết thúc (để game biết mà hiện overlay).
   * Trả về `false` nếu ván còn tiếp — kể cả khi bé vừa trả lời sai.
   */
  attempt: (correct: boolean) => void;
  /**
   * Bé vừa giải xong câu hiện tại. Cộng điểm, ghi nhật ký câu này, và đi tiếp.
   *
   * ⚠️ `wordId` BẮT BUỘC — CỐ Ý, VÀ CÓ THỂ LÀ `null`.
   *   Engine không biết trên màn hình đang là từ nào (mỗi game tự chọn và tự xáo thứ tự).
   *   Để tham số này TUỲ CHỌN thì một game quên truyền sẽ lặng lẽ ghi `wordId: undefined` —
   *   mà lỗi kiểu đó chỉ lộ ra khi bé mở báo cáo tiến độ và thấy thiếu từ. Bắt buộc truyền
   *   biến nó thành lỗi BIÊN DỊCH, phát hiện ngay lúc viết game mới. Game nào không dạy từ
   *   vựng thì truyền `null` — một lựa chọn có ý thức, đọc ra là hiểu.
   */
  completeRound: (wordId: string | null) => void;
  /** Đã tới lúc hiện gợi ý cho câu hiện tại chưa (bé đã sai đủ `MAX_WRONG_PER_ROUND` lần). */
  hintVisible: boolean;
  /** Đang ở câu cuối cùng. */
  isLastRound: boolean;
  /** Câu đang chơi, đếm từ 1 — để hiện "Câu 3 / 10". */
  roundNumber: number;
  /** Kết quả đã chấm, chỉ có khi `finished`. */
  result: GameRunResult | null;
  /** Chơi lại từ đầu. */
  restart: () => void;
}

type Action =
  | { type: 'attempt'; correct: boolean }
  | { type: 'completeRound'; wordId: string | null }
  | { type: 'restart' };

/**
 * State nội bộ = state công khai + điểm mỗi câu.
 *
 * `roundPoints` không nằm trong state công khai vì không màn hình nào cần biết nó; còn
 * `totalRounds` thì `GameShell` cần, nên nó đã được đưa lên `GameEngineState`.
 */
interface InternalState extends GameEngineState {
  roundPoints: number;
}

function initialState(options: UseGameEngineOptions): InternalState {
  return {
    index: 0,
    hearts: options.maxHearts,
    maxHearts: options.maxHearts,
    streak: 0,
    longestStreak: 0,
    correctFirstTry: 0,
    answered: 0,
    wrongAttempts: 0,
    wrongThisRound: 0,
    roundScore: 0,
    finished: options.totalRounds <= 0,
    endedEarly: false,
    totalRounds: options.totalRounds,
    roundPoints: options.roundPoints,
    answers: [],
  };
}

function reducer(state: InternalState, action: Action): InternalState {
  // ⚠️ Sau khi kết thúc thì BỎ QUA mọi thao tác. Bé có thể vẫn chạm vào bàn phím ảo trong lúc
  //   overlay kết quả đang hiện ra (hiệu ứng mất ~300ms), và những cú chạm đó không được phép
  //   làm thay đổi điểm số đã chốt.
  if (state.finished && action.type !== 'restart') return state;

  switch (action.type) {
    case 'attempt': {
      if (action.correct) {
        // Đúng thì KHÔNG cộng điểm ở đây — điểm cộng khi `completeRound`, để một từ nhiều chữ
        // cái không bị cộng điểm nhiều lần.
        return state;
      }

      const hearts = state.maxHearts > 0 ? Math.max(0, state.hearts - 1) : state.hearts;
      const next: InternalState = {
        ...state,
        hearts,
        wrongThisRound: state.wrongThisRound + 1,
        wrongAttempts: state.wrongAttempts + 1,
        // Đứt chuỗi. KHÔNG trừ điểm — chỉ là chuỗi đếm lại từ 0.
        streak: 0,
      };

      // Hết mạng ⇒ kết thúc SỚM. Không phải thua: bé vẫn nhận sao, xem `summarizeGameRun`.
      if (next.maxHearts > 0 && next.hearts === 0) {
        return { ...next, finished: true, endedEarly: true };
      }
      return next;
    }

    case 'completeRound': {
      const firstTry = state.wrongThisRound === 0;
      const streak = firstTry ? state.streak + 1 : 0;
      const index = state.index + 1;
      const isDone = index >= state.totalRounds;

      return {
        ...state,
        index,
        streak,
        longestStreak: Math.max(state.longestStreak, streak),
        correctFirstTry: state.correctFirstTry + (firstTry ? 1 : 0),
        answered: state.answered + 1,
        wrongThisRound: 0,
        roundScore: state.roundScore + pointsForRound(state.roundPoints, firstTry),
        finished: isDone,
        endedEarly: false,
        // Nhật ký câu vừa xong. `wrongAttempts` lấy từ `state.wrongThisRound` TRƯỚC khi nó bị
        // xoá về 0 ở dòng trên — đó chính là số lần bé đã chọn sai ở câu này.
        answers: [
          ...state.answers,
          { wordId: action.wordId, firstTry, wrongAttempts: state.wrongThisRound },
        ],
      };
    }

    case 'restart':
      return initialState({
        totalRounds: state.totalRounds,
        maxHearts: state.maxHearts,
        roundPoints: state.roundPoints,
      });
  }
}

export function useGameEngine(options: UseGameEngineOptions): UseGameEngineResult {
  const { totalRounds, maxHearts, roundPoints } = options;

  const [state, dispatch] = useReducer(
    reducer,
    { totalRounds, maxHearts, roundPoints },
    initialState,
  );

  const attempt = useCallback((correct: boolean) => {
    dispatch({ type: 'attempt', correct });
  }, []);

  const completeRound = useCallback((wordId: string | null) => {
    dispatch({ type: 'completeRound', wordId });
  }, []);

  const restart = useCallback(() => {
    dispatch({ type: 'restart' });
  }, []);

  /**
   * ⚠️ Kết quả được TÍNH RA từ state, không lưu lại và không đẩy qua callback.
   *   Nhờ vậy hiệu ứng của `StrictMode` (chạy hai lần) không thể sinh hai sự kiện hoàn thành.
   *   `summarizeGameRun` là hàm thuần nên tính lại mỗi render cũng không tốn gì đáng kể.
   */
  const result = useMemo<GameRunResult | null>(() => {
    if (!state.finished) return null;
    return summarizeGameRun({
      totalRounds: state.totalRounds,
      correctFirstTry: state.correctFirstTry,
      answered: state.answered,
      wrongAttempts: state.wrongAttempts,
      longestStreak: state.longestStreak,
      endedEarly: state.endedEarly,
      roundScore: state.roundScore,
    });
  }, [state]);

  return {
    state,
    attempt,
    completeRound,
    hintVisible: state.wrongThisRound >= MAX_WRONG_PER_ROUND,
    isLastRound: state.index >= state.totalRounds - 1,
    roundNumber: Math.min(state.index + 1, state.totalRounds),
    result,
    restart,
  };
}
