/**
 * RubyLingo — PHẦN THƯỜNG MỘT-LẦN khi bé hoàn thành CẢ bài thi cuối khoá Starters.
 *
 * ⭐ VÌ SAO LÀ HẰNG SỐ DÙNG CHUNG, KHÔNG NHÉT TRONG `FinalTestService`:
 *   Client (G7) cũng cần con số này để dựng màn "Bé tốt nghiệp! 🎓 +300 ⭐". Nếu server trao 300
 *   mà client vẽ 200, bé tự cộng lại và thấy lệch — đúng loại lệch hai nguồn mà dự án cấm.
 *
 * ⚠️⚠️ CHỈ TRAO **MỘT LẦN** — Ở LẦN HOÀN THÀNH ĐẦU TIÊN. Làm lại một phần (để cải thiện khiên)
 *   KHÔNG cộng lại ⭐/🌰/XP. Cơ chế nằm ở `FinalTestService`: phần thưởng chỉ được trao khi số
 *   phần đã hoàn thành chuyển từ 2 → 3 (lần đầu đủ cả ba), và điều đó chỉ xảy ra đúng một lần.
 *
 * ⚠️ CON SỐ DƯỚI ĐÂY LÀ MẶC ĐỊNH, SẼ TINH CHỈNH BẰNG DỮ LIỆU CHƠI THẬT — đừng coi là chốt cứng.
 *   Cùng chỗ với ngưỡng khiên (`BALANCE_TODO` trong `shared/final-test-scoring.ts`).
 */
export interface FinalTestCompletionReward {
  stars: number;
  acorns: number;
  xp: number;
}

/** Quà một-lần cho lần hoàn thành ĐẦU TIÊN của cả bài thi. */
export const FINAL_TEST_COMPLETION_REWARD: FinalTestCompletionReward = Object.freeze({
  stars: 300,
  acorns: 20,
  xp: 200,
});
