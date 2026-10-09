// @vitest-environment node
/**
 * Test cho T066 — LINH VẬT LỚN LÊN và ❤️ HAO THEO NGÀY XA APP.
 *
 * ⭐ HAI LUẬT Ở ĐÂY ĐỀU LÀ LUẬT CỦA DỰ ÁN, KHÔNG PHẢI CHI TIẾT KỸ THUẬT:
 *
 *   1. TIẾN HOÁ SUY RA TỪ SỐ TỪ ĐÃ HỌC, và **không mua được bằng ⭐**. Cột
 *      `pet_state.evolution_stage` trở thành XÁC CHẾT đúng như `equipped_item_ids` đã trở thành
 *      ở T062 — vẫn nằm trong schema vì migration là bất biến, nhưng KHÔNG BAO GIỜ được đọc.
 *      Test khoá điều đó bằng cách ghi RÁC vào cột rồi khẳng định `readPet` không hề đổi.
 *
 *   2. ❤️ CHỈ HAO KHI BÉ XA APP — và neo là `streak_state.last_active_date`, **KHÔNG** phải
 *      `pet_state.last_fed_at`. Đây là chỗ dễ hỏng nhất và hỏng theo kiểu ác ý nhất: lấy "lần
 *      cho ăn gần nhất" làm mốc thì một bé HỌC MỖI NGÀY mà không tiêu ⭐ sẽ thấy Momo buồn dần
 *      ⇒ một áp lực tiêu tiền đặt lên đứa trẻ 7 tuổi. Test "last_fed_at cũ 30 ngày mà ❤️ vẫn
 *      nguyên" chính là cái khoá của quyết định đó.
 *
 * ⚠️ Tệp này KHÔNG dùng chung fixture với `reward-service.test.ts` (cố ý): nó dựng dữ liệu bằng
 *    SQL thô nên đọc được như một bản tả schema, và không phụ thuộc vào việc tệp kia có đổi
 *    helper hay không.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { type Db } from '../../../server/db/connection.js';
import { rewardService } from '../../../server/services/RewardService.js';
import { dateKeyDaysAgo, localDateKey } from '../../../server/lib/time.js';
import { clearAllData, setupTestDb } from './helpers/testDb.js';

const NOW = '2026-10-08T08:00:00.000Z';

let db: Db;

beforeAll(() => {
  db = setupTestDb();
});

beforeEach(() => {
  clearAllData(db);
});

// =============================================================================
// Dựng dữ liệu
// =============================================================================

function seedChild(id = 'chi_na'): string {
  db.prepare(
    `INSERT INTO parent_account
       (id, email, password_hash, consent_policy_version, consented_at, created_at, updated_at)
     VALUES ('par_1', 'bo@example.com', 'x', 'v1', ?, ?, ?)`,
  ).run(NOW, NOW, NOW);
  db.prepare(
    `INSERT INTO child_profile (id, parent_id, nickname, age, avatar_id, created_at, updated_at)
     VALUES (?, 'par_1', 'Na', 7, 'rabbit', ?, ?)`,
  ).run(id, NOW, NOW);
  db.prepare(
    `INSERT INTO pet_state (child_id, evolution_stage, happiness, equipped_item_ids, last_fed_at, updated_at)
     VALUES (?, 'egg', 3, '[]', NULL, ?)`,
  ).run(id, NOW);
  db.prepare(
    `INSERT INTO streak_state (child_id, current_streak, longest_streak, last_active_date, milestones_claimed, updated_at)
     VALUES (?, 0, 0, NULL, '[]', ?)`,
  ).run(id, NOW);
  return id;
}

/** Đánh dấu MỘT từ là đã học — dùng khi cần một id cụ thể (biên, từ thứ N). */
function learnWord(childId: string, wordId: string): void {
  db.prepare(
    `INSERT INTO word_progress
       (child_id, word_id, learned, mastered, correct_count, wrong_count, last_seen_at, updated_at)
     VALUES (?, ?, 1, 0, 1, 0, ?, ?)`,
  ).run(childId, wordId, NOW, NOW);
}

/**
 * Đánh dấu `count` từ là đã học, bắt đầu từ chỉ số `from`.
 *
 * ⚠️ `from` KHÔNG phải trang trí: khoá chính của `word_progress` là `(child_id, word_id)`, nên
 *    gọi hàm này hai lần từ 0 sẽ nổ UNIQUE constraint — đúng cái bẫy đã xảy ra ở lượt viết đầu.
 */
function learnWords(childId: string, count: number, learned = 1, from = 0): void {
  for (let i = 0; i < count; i += 1) {
    db.prepare(
      `INSERT INTO word_progress
         (child_id, word_id, learned, mastered, correct_count, wrong_count, last_seen_at, updated_at)
       VALUES (?, ?, ?, 0, 1, 0, ?, ?)`,
    ).run(childId, `starters.w${from + i}`, learned, NOW, NOW);
  }
}

function setLastActive(childId: string, dateKey: string | null): void {
  db.prepare('UPDATE streak_state SET last_active_date = ? WHERE child_id = ?').run(dateKey, childId);
}

function setLastFed(childId: string, iso: string | null): void {
  db.prepare('UPDATE pet_state SET last_fed_at = ? WHERE child_id = ?').run(iso, childId);
}

/** ISO cách đây `days` ngày — để làm cũ `pet_state.updated_at`. */
function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function setPetTouched(childId: string, iso: string): void {
  db.prepare('UPDATE pet_state SET updated_at = ? WHERE child_id = ?').run(iso, childId);
}

/**
 * Dựng cảnh "bé xa app `days` ngày": CẢ mốc học lẫn mốc ghi hàng Momo đều cũ.
 *
 * ⚠️ Phải đặt cả hai. Neo hao hụt là mốc MUỘN HƠN trong hai mốc, nên chỉ làm cũ một cái là test
 *    đang kiểm một cảnh không tồn tại trong đời thật — và nó sẽ xanh vì lý do sai.
 */
function setAbsent(childId: string, days: number): void {
  setLastActive(childId, dateKeyDaysAgo(days));
  setPetTouched(childId, isoDaysAgo(days));
}

function storedHappiness(childId: string): number {
  const row = db.prepare('SELECT happiness FROM pet_state WHERE child_id = ?').get(childId) as {
    happiness: number;
  };
  return row.happiness;
}

// =============================================================================
// 1. Tiến hoá theo SỐ TỪ ĐÃ HỌC
// =============================================================================

describe('T066 — tiến hoá theo tổng từ đã học', () => {
  it('chưa học từ nào ⇒ Trứng (egg)', () => {
    const childId = seedChild();
    expect(rewardService.readPet(db, childId).evolutionStage).toBe('egg');
  });

  /**
   * ⭐⭐ T071.1 — `wordsLearned` phải được TRẢ RA và khớp ĐÚNG con số quyết định giai đoạn.
   *
   *   Màn Hồ sơ nhà thám hiểm (M13) vẽ thanh "còn bao nhiêu từ nữa thì Momo lớn hơn" bằng con số
   *   này. Nếu server trả một con số KHÁC với con số nó dùng để chọn `evolutionStage`, bé sẽ thấy
   *   "thanh đầy" mà Momo chưa lớn (hoặc ngược lại) — và không có lỗi nào nổi lên. Vì vậy khẳng
   *   định cả hai: giá trị đúng, VÀ bằng `countLearnedWords` (một phép đếm, hai chỗ dùng).
   */
  it('⭐ trả `wordsLearned` khớp đúng con số dùng để chọn giai đoạn', () => {
    const childId = seedChild();
    expect(rewardService.readPet(db, childId).wordsLearned).toBe(0);

    learnWords(childId, 25);
    const pet = rewardService.readPet(db, childId);
    expect(pet.wordsLearned).toBe(25);
    expect(pet.wordsLearned).toBe(rewardService.countLearnedWords(db, childId));
    expect(pet.evolutionStage).toBe('baby'); // 25 ≥ mốc 20 của `baby` ⇒ thanh tiến độ khớp hình Momo
  });

  it('đủ 20 từ ⇒ Nhóc con; 19 từ vẫn là Trứng (biên dưới)', () => {
    const childId = seedChild();
    learnWords(childId, 19);
    expect(rewardService.readPet(db, childId).evolutionStage).toBe('egg');

    // Từ thứ 20. ⚠️ KHÔNG gọi `learnWords(childId, 1)` ở đây: hàm đó luôn bắt đầu từ `w0`, mà
    // khoá chính của `word_progress` là `(child_id, word_id)` ⇒ sẽ nổ UNIQUE constraint. Một từ
    // ở giữa dải cũng không được, vì `w0..w18` đã chiếm hết.
    learnWord(childId, 'starters.w19');
    expect(rewardService.readPet(db, childId).evolutionStage).toBe('baby');
  });

  it('80 từ ⇒ Trưởng thành; 200 từ ⇒ Siêu cấp', () => {
    const childId = seedChild();
    learnWords(childId, 80);
    expect(rewardService.readPet(db, childId).evolutionStage).toBe('adult');
    learnWords(childId, 120, 1, 80);
    expect(rewardService.readPet(db, childId).evolutionStage).toBe('super');
  });

  it('⚠️ từ CHƯA học (`learned = 0`) KHÔNG được tính', () => {
    const childId = seedChild();
    learnWords(childId, 300, 0);
    expect(rewardService.countLearnedWords(db, childId)).toBe(0);
    expect(rewardService.readPet(db, childId).evolutionStage).toBe('egg');
  });

  it('⭐ KHÔNG mua được tiến hoá: ví đầy ⭐ cũng không đổi giai đoạn', () => {
    const childId = seedChild();
    db.prepare(
      `INSERT INTO wallet (child_id, stars, acorns, updated_at) VALUES (?, 99999, 99999, ?)`,
    ).run(childId, NOW);
    expect(rewardService.readPet(db, childId).evolutionStage).toBe('egg');
  });

  it('⚠️ cột `evolution_stage` là XÁC CHẾT: ghi rác vào cũng không ảnh hưởng', () => {
    const childId = seedChild();
    // Đúng loại dữ liệu mà một bản cũ / một lần sửa tay để lại.
    db.prepare(`UPDATE pet_state SET evolution_stage = 'super' WHERE child_id = ?`).run(childId);

    // Bé chưa học từ nào ⇒ vẫn phải là 'egg'. Nếu `readPet` đọc cột, test này đỏ ngay.
    expect(rewardService.readPet(db, childId).evolutionStage).toBe('egg');

    // Và ngược lại: cột nói 'egg' nhưng bé đã học 200 từ ⇒ vẫn phải là 'super'.
    learnWords(childId, 200);
    db.prepare(`UPDATE pet_state SET evolution_stage = 'egg' WHERE child_id = ?`).run(childId);
    expect(rewardService.readPet(db, childId).evolutionStage).toBe('super');
  });

  it('chưa có hàng `pet_state` vẫn ra ĐÚNG giai đoạn (suy ở tầng đọc)', () => {
    const childId = seedChild();
    learnWords(childId, 25);
    db.prepare('DELETE FROM pet_state WHERE child_id = ?').run(childId);

    const pet = rewardService.readPet(db, childId);
    expect(pet.evolutionStage).toBe('baby');
    expect(pet.happiness).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// 2. ❤️ hao theo NGÀY XA APP
// =============================================================================

describe('T066 — ❤️ hao theo ngày xa app', () => {
  it('hôm nay bé có học ⇒ ❤️ giữ nguyên', () => {
    const childId = seedChild();
    setAbsent(childId, 0);
    expect(rewardService.readPet(db, childId).happiness).toBe(3);
  });

  it('nghỉ đúng 1 ngày (ân hạn) ⇒ vẫn giữ nguyên', () => {
    const childId = seedChild();
    setAbsent(childId, 1);
    expect(rewardService.readPet(db, childId).happiness).toBe(3);
  });

  it('xa 3 ngày ⇒ mất 2 ❤️', () => {
    const childId = seedChild();
    setAbsent(childId, 3);
    expect(rewardService.readPet(db, childId).happiness).toBe(1);
  });

  it('⚠️⚠️ HỌC HÔM NAY thì ❤️ KHÔNG hao, dù đã 30 ngày không cho ăn', () => {
    /**
     * Cái khoá của quyết định ở T066. Nếu hao hụt neo vào `last_fed_at`, một bé học mỗi ngày mà
     * không tiêu ⭐ sẽ thấy Momo buồn dần — bé 7 tuổi đọc điều đó thành "Momo buồn vì mình không
     * cho ăn", tức là một áp lực tiêu tiền đặt lên đứa trẻ, và là một lời trách móc.
     */
    const childId = seedChild();
    setLastFed(childId, isoDaysAgo(30)); // 30 ngày chưa cho ăn
    setPetTouched(childId, isoDaysAgo(30)); // hàng Momo cũng chưa được ghi lại
    setLastActive(childId, localDateKey()); // NHƯNG bé học hôm nay

    expect(rewardService.readPet(db, childId).happiness).toBe(3);
  });

  it('xa rất lâu ⇒ DỪNG ở SÀN 1, không bao giờ buồn bã hoàn toàn', () => {
    const childId = seedChild();
    setAbsent(childId, 365);
    expect(rewardService.readPet(db, childId).happiness).toBe(1);
  });

  it('hồ sơ vừa tạo hôm nay, chưa học buổi nào ⇒ KHÔNG hao', () => {
    const childId = seedChild();
    // `last_active_date` vẫn NULL, hàng `pet_state` vừa được tạo hôm nay.
    expect(rewardService.readPet(db, childId).happiness).toBe(3);
  });

  it('⚠️ ĐỌC KHÔNG GHI DB: một `GET` không được làm đổi cột `happiness`', () => {
    const childId = seedChild();
    setAbsent(childId, 30);

    expect(rewardService.readPet(db, childId).happiness).toBe(1);
    // Cột vẫn là 3 — hao hụt được TÍNH khi đọc, không được ghi lại. Nếu ghi, mở app lên chỉ để
    // xem cũng đã làm thay đổi dữ liệu, và mọi lần đồng bộ sẽ thấy "có gì đó mới".
    expect(storedHappiness(childId)).toBe(3);
  });

  it('⚠️⚠️⚠️ cho ăn sau nhiều ngày xa ⇒ ❤️ PHẢI NHÍCH NGAY (khoá lỗi hao hai lần)', () => {
    /**
     * LỖI THẬT đã xảy ra ở lượt viết đầu của T066, và test này là cái khoá giữ nó không quay lại.
     *
     *   Hao hụt được áp khi ĐỌC. Nếu neo chỉ vào ngày học (không tính lần cho ăn), thì khi bé xa
     *   3 ngày rồi cho ăn: `feed` đọc mức đã hao (1), ghi 1 + 1 = 2 — rồi lần đọc lại NGAY SAU ĐÓ
     *   lại áp hao với CÙNG `daysAway = 3` ⇒ trả về 1. Bé vừa tiêu một quả chuối mà thanh ❤️
     *   KHÔNG nhích. Đó đúng là "lấy gì của bé mà không đổi lại được gì" — luật cấm của dự án.
     */
    const childId = seedChild();
    setAbsent(childId, 3); // 3 ❤️ ⇒ còn 1 ❤️
    db.prepare(
      `INSERT INTO inventory (child_id, item_id, quantity, equipped, acquired_at)
       VALUES (?, 'food-banana', 1, 0, ?)`,
    ).run(childId, NOW);

    const result = rewardService.feed('par_1', childId, { itemId: 'food-banana' });

    // 1 ❤️ + 1 ❤️ của quả chuối = 2. Không được là 1 (hao lại lần nữa), cũng không được là 4
    // (bỏ qua hao hụt ⇒ phần thưởng cho việc bỏ app ba ngày).
    expect(result.pet.happiness).toBe(2);
    expect(storedHappiness(childId)).toBe(2);
  });
});
