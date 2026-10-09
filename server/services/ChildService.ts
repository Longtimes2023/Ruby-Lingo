/**
 * RubyLingo — ChildService: hồ sơ bé.
 *
 * ⭐ QUY TẮC QUAN TRỌNG NHẤT CỦA FILE NÀY:
 *   Tạo hồ sơ bé PHẢI tạo kèm ĐỦ 5 bảng con, trong MỘT transaction:
 *       wallet · xp_state · pet_state · streak_state · settings
 *
 *   Vì sao không "tạo sau, khi cần": các bảng đó KHÔNG có cơ chế tự tạo (không có trigger,
 *   không có upsert ngầm). Nếu thiếu `wallet`, màn hình thưởng sẽ đọc `undefined` và hiện
 *   "NaN Sao" — mà lỗi đó xảy ra ở một màn hình KHÁC hẳn nơi gây ra nó, nên rất khó truy.
 *   Gói tất cả vào một transaction cũng đảm bảo: hoặc bé có đủ dữ liệu, hoặc không có bé nào.
 *
 * ⭐ MỌI THAO TÁC ĐỀU PHẢI KIỂM QUYỀN SỞ HỮU:
 *   `childId` do client gửi lên. Nếu chỉ tra theo `childId` mà không kiểm `parent_id` thì
 *   bất kỳ phụ huynh nào đoán được id cũng đọc/sửa/xoá được hồ sơ bé nhà người khác.
 *   Vì vậy MỌI truy vấn ở đây đều có `AND parent_id = ?`. Không có ngoại lệ.
 *
 * ⚙️ RÀNG BUỘC: `transaction()` là ĐỒNG BỘ ⇒ không `await` bên trong. Ở file này không có
 *    thao tác bất đồng bộ nào nên không gặp vấn đề, nhưng đừng thêm `await` vào trong.
 *
 * ⚠️ MỌI PHƯƠNG THỨC GHI ĐỀU TỰ PARSE BẰNG SCHEMA DÙNG CHUNG — ĐỪNG BỎ:
 *    Route đã parse trước khi gọi vào đây, nên việc parse lại trông có vẻ thừa. Nó không
 *    thừa: `nicknameSchema` có `.trim()`, và nếu chỉ dựa vào route thì bất kỳ lời gọi nào
 *    khác (script seed, test, công cụ quản trị) sẽ ghi biệt danh còn khoảng trắng vào DB —
 *    hiển thị lệch và so sánh chuỗi sai. Cùng lý do đã áp dụng ở `AuthService`.
 */

import type { Db } from '../db/connection.js';
import { getDb, transaction } from '../db/connection.js';
import { newIdWithPrefix } from '../lib/ids.js';
import { nowIso } from '../lib/time.js';
import { errors } from '../plugins/errors.js';
import { MAX_CHILDREN_PER_ACCOUNT } from '../../shared/constants.js';
import { avatarsFileSchema } from '../../shared/schemas/content.js';
import type { CreateChildInput, UpdateChildInput } from '../../shared/schemas/auth.js';
import { createChildSchema, updateChildSchema } from '../../shared/schemas/auth.js';
import type { UpdateSettingsInput } from '../../shared/schemas/settings.js';
import { updateSettingsSchema } from '../../shared/schemas/settings.js';
import type { ChildProfileDto, SettingsDto } from '../../shared/types/api.js';
// Import JSON theo đúng lối đã dùng ở `src/data/global-scenes.ts` (không dùng import
// attributes) — `resolveJsonModule` đã bật trong tsconfig gốc, và esbuild/tsx xử lý được.
import avatarsRaw from '../../shared/content/avatars.json';

// =============================================================================
// Avatar hợp lệ
// =============================================================================

/**
 * Tập id avatar hợp lệ, đọc từ `shared/content/avatars.json` — CÙNG nguồn với client.
 *
 * Kiểm ngay lúc nạp module: nếu file avatar hỏng thì server phải chết lúc khởi động, chứ
 * không phải để mọi request tạo hồ sơ bé thất bại với lỗi mơ hồ.
 */
const AVATARS: ReadonlySet<string> = (() => {
  const parsed = avatarsFileSchema.safeParse(avatarsRaw);
  if (!parsed.success) {
    throw new Error(
      'shared/content/avatars.json không hợp lệ: ' +
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  }
  return new Set(parsed.data.avatars.map((a) => a.id));
})();

// =============================================================================
// Hàng dữ liệu thô
// =============================================================================

interface ChildRow {
  id: string;
  parent_id: string;
  nickname: string;
  age: number;
  avatar_id: string;
  created_at: string;
  updated_at: string;
}

function toChildDto(row: ChildRow): ChildProfileDto {
  return {
    id: row.id,
    nickname: row.nickname,
    age: row.age,
    avatarId: row.avatar_id,
    createdAt: row.created_at,
  };
}

// =============================================================================
// Cài đặt của bé (T074)
// =============================================================================

/** Hàng thô của bảng `settings`. Cột 0/1 là `INTEGER` (SQLite không có BOOLEAN). */
interface SettingsRow {
  sound_enabled: number;
  music_enabled: number;
  speech_rate: number;
  reduced_motion: number;
}

/**
 * Giá trị mặc định — ⚠️ PHẢI khớp `DEFAULT` trong `migrations/002_child.sql`
 * (`sound_enabled 1`, `music_enabled 1`, `speech_rate 0.8`, `reduced_motion 0`).
 *
 * Dùng cho nhánh "không có hàng `settings`" — bất thường, vì `createChild` luôn tạo hàng này
 * trong cùng transaction với hồ sơ bé. Nhưng một DB bị sửa tay không được làm sập màn hình
 * cài đặt: trả mặc định tốt hơn là ném lỗi.
 */
const DEFAULT_SETTINGS: SettingsDto = {
  soundEnabled: true,
  musicEnabled: true,
  speechRate: 0.8,
  reducedMotion: false,
};

/** Hàng SQLite (0/1) ⇒ DTO (true/false). Một chỗ duy nhất đổi kiểu, không nơi nào phải nhớ. */
function toSettingsDto(row: SettingsRow): SettingsDto {
  return {
    soundEnabled: row.sound_enabled === 1,
    musicEnabled: row.music_enabled === 1,
    speechRate: row.speech_rate,
    reducedMotion: row.reduced_motion === 1,
  };
}

// =============================================================================
// Service
// =============================================================================

export class ChildService {
  constructor(private readonly db: Db = getDb()) {}

  /** Danh sách bé của một phụ huynh, sắp theo thời điểm tạo (bé tạo trước đứng trước). */
  listChildren(parentId: string): ChildProfileDto[] {
    const rows = this.db
      .prepare('SELECT * FROM child_profile WHERE parent_id = ? ORDER BY created_at ASC')
      .all(parentId) as ChildRow[];
    return rows.map(toChildDto);
  }

  /**
   * Lấy một bé — CÓ KIỂM QUYỀN SỞ HỮU.
   * Trả `null` nếu không tồn tại HOẶC không thuộc phụ huynh này (hai trường hợp trả giống
   * nhau có chủ đích: không tiết lộ sự tồn tại của hồ sơ bé nhà người khác).
   */
  getChild(parentId: string, childId: string): ChildProfileDto | null {
    const row = this.db
      .prepare('SELECT * FROM child_profile WHERE id = ? AND parent_id = ?')
      .get(childId, parentId) as ChildRow | undefined;
    return row ? toChildDto(row) : null;
  }

  /**
   * Tạo hồ sơ bé + ĐỦ 5 bảng con trong MỘT transaction. Xem ghi chú đầu file.
   */
  createChild(parentId: string, rawInput: CreateChildInput): ChildProfileDto {
    // Chuẩn hoá + kiểm lại (xem ghi chú đầu file): `nickname` được `.trim()` ở đây.
    const input = createChildSchema.parse(rawInput);

    if (!AVATARS.has(input.avatarId)) {
      throw errors.validation('Bạn đồng hành này không có trong danh sách', {
        avatarId: 'Bố mẹ chọn lại bạn đồng hành cho bé nhé',
      });
    }

    const count = this.db
      .prepare('SELECT COUNT(*) AS n FROM child_profile WHERE parent_id = ?')
      .get(parentId) as { n: number };
    if (count.n >= MAX_CHILDREN_PER_ACCOUNT) {
      throw errors.validation(
        `Mỗi tài khoản chỉ tạo được tối đa ${MAX_CHILDREN_PER_ACCOUNT} hồ sơ bé`,
      );
    }

    const childId = newIdWithPrefix('chi');
    const now = nowIso();

    transaction((db) => {
      db.prepare(
        `INSERT INTO child_profile (id, parent_id, nickname, age, avatar_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(childId, parentId, input.nickname, input.age, input.avatarId, now, now);

      // --- 5 bảng con: giá trị khởi tạo phải KHỚP DEFAULT trong migration ---
      db.prepare(
        'INSERT INTO wallet (child_id, stars, acorns, updated_at) VALUES (?, 0, 0, ?)',
      ).run(childId, now);

      db.prepare('INSERT INTO xp_state (child_id, xp, level, updated_at) VALUES (?, 0, 1, ?)').run(
        childId,
        now,
      );

      // `happiness` khởi tạo 3 (không phải 1 hay 5): linh vật mới nhận nuôi ở trạng thái
      // vui vẻ trung tính, để việc cho ăn lần đầu thấy được thay đổi rõ rệt.
      db.prepare(
        `INSERT INTO pet_state (child_id, evolution_stage, happiness, equipped_item_ids, last_fed_at, updated_at)
         VALUES (?, 'egg', 3, '[]', NULL, ?)`,
      ).run(childId, now);

      db.prepare(
        `INSERT INTO streak_state (child_id, current_streak, longest_streak, last_active_date, milestones_claimed, updated_at)
         VALUES (?, 0, 0, NULL, '[]', ?)`,
      ).run(childId, now);

      db.prepare(
        `INSERT INTO settings (child_id, sound_enabled, music_enabled, speech_rate, reduced_motion, updated_at)
         VALUES (?, 1, 1, 0.8, 0, ?)`,
      ).run(childId, now);
    });

    const row = this.db.prepare('SELECT * FROM child_profile WHERE id = ?').get(childId) as ChildRow;
    return toChildDto(row);
  }

  /** Cập nhật hồ sơ bé — có kiểm quyền sở hữu. */
  updateChild(parentId: string, childId: string, rawInput: UpdateChildInput): ChildProfileDto {
    // `updateChildSchema` cũng từ chối object rỗng ⇒ PATCH "thành công giả" không xảy ra.
    const input = updateChildSchema.parse(rawInput);

    const existing = this.getChild(parentId, childId);
    if (!existing) throw errors.childNotFound();

    if (input.avatarId !== undefined && !AVATARS.has(input.avatarId)) {
      throw errors.validation('Bạn đồng hành này không có trong danh sách', {
        avatarId: 'Bố mẹ chọn lại bạn đồng hành cho bé nhé',
      });
    }

    // Chỉ ghi những trường THẬT SỰ được gửi lên. Ghi đè bằng giá trị cũ cũng được về mặt
    // kết quả, nhưng nó làm `updated_at` thay đổi vô cớ và xoá mất thông tin "lần sửa cuối
    // là khi nào" — thứ hữu ích khi truy vết sự cố.
    const sets: string[] = [];
    const values: unknown[] = [];
    if (input.nickname !== undefined) {
      sets.push('nickname = ?');
      values.push(input.nickname);
    }
    if (input.age !== undefined) {
      sets.push('age = ?');
      values.push(input.age);
    }
    if (input.avatarId !== undefined) {
      sets.push('avatar_id = ?');
      values.push(input.avatarId);
    }
    sets.push('updated_at = ?');
    values.push(nowIso());

    this.db
      .prepare(`UPDATE child_profile SET ${sets.join(', ')} WHERE id = ? AND parent_id = ?`)
      .run(...values, childId, parentId);

    const row = this.db.prepare('SELECT * FROM child_profile WHERE id = ?').get(childId) as ChildRow;
    return toChildDto(row);
  }

  /**
   * Xoá hồ sơ bé.
   *
   * Toàn bộ dữ liệu học tập của bé (tiến độ, ví, túi đồ, huy hiệu, nhiệm vụ) bị xoá theo
   * nhờ `ON DELETE CASCADE` ở mọi bảng con — không phải xoá tay từng bảng, và không thể
   * quên một bảng nào (khoá ngoại đã bật `foreign_keys = ON` trong `db/connection.ts`).
   */
  deleteChild(parentId: string, childId: string): void {
    const result = this.db
      .prepare('DELETE FROM child_profile WHERE id = ? AND parent_id = ?')
      .run(childId, parentId);
    if (result.changes === 0) throw errors.childNotFound();
  }

  // --- Cài đặt của bé (T074) ------------------------------------------------

  /**
   * Đọc cài đặt của bé — CÓ KIỂM QUYỀN SỞ HỮU.
   *
   * ⚠️ Quyền sở hữu kiểm qua `getChild` (cùng `AND parent_id = ?` như mọi truy vấn ở file này).
   *    Chỉ tra `child_id` là một phụ huynh đọc được cài đặt con nhà khác — ranh giới giữa các
   *    gia đình, không phải chi tiết nhỏ.
   */
  readSettings(parentId: string, childId: string): SettingsDto {
    const child = this.getChild(parentId, childId);
    if (!child) throw errors.childNotFound();

    const row = this.db
      .prepare(
        'SELECT sound_enabled, music_enabled, speech_rate, reduced_motion FROM settings WHERE child_id = ?',
      )
      .get(childId) as SettingsRow | undefined;

    return row ? toSettingsDto(row) : { ...DEFAULT_SETTINGS };
  }

  /**
   * Cập nhật cài đặt của bé — CẬP NHẬT MỘT PHẦN THẬT, và có kiểm quyền sở hữu.
   *
   * ⚠️⚠️ HAI CÁI BẪY IM LẶNG CỦA HÀM NÀY — ĐỌC TRƯỚC KHI SỬA:
   *
   *  1. **"Không gửi" ≠ "gửi giá trị mặc định".** Hàm đọc giá trị HIỆN CÓ rồi chỉ thay những
   *     trường ĐƯỢC GỬI. Nếu ai đó viết `input.soundEnabled ?? true` (thay vì `?? current…`), thì
   *     một request chỉ đổi `speechRate` sẽ ĐẶT LẠI âm thanh/nhạc/giảm-chuyển-động về mặc định —
   *     phụ huynh chỉnh tốc độ đọc xong thấy bé mất luôn cài đặt âm thanh, và không có lỗi nào.
   *
   *  2. **PHẢI DÙNG `??`, TUYỆT ĐỐI KHÔNG DÙNG `||`.** `soundEnabled: false` (bé tắt tiếng) là giá
   *     trị FALSY hợp lệ. `input.soundEnabled || current.soundEnabled` sẽ biến `false` thành
   *     `current.soundEnabled` ⇒ **không tắt được âm thanh**, mà cũng chẳng có thông báo nào.
   *     Đây đúng là lớp lỗi `??`-vs-`||` mà test "gửi MỘT trường" phải khoá lại.
   */
  updateSettings(parentId: string, childId: string, rawInput: UpdateSettingsInput): SettingsDto {
    // Parse lại ở tầng service (xem ghi chú đầu file): route không phải đường gọi duy nhất.
    const input = updateSettingsSchema.parse(rawInput);

    const child = this.getChild(parentId, childId);
    if (!child) throw errors.childNotFound();

    const now = nowIso();
    let saved: SettingsDto = { ...DEFAULT_SETTINGS };

    // Đọc + ghi trong CÙNG transaction: giá trị nền để trộn và giá trị ghi ra không thể lệch nhau.
    transaction((db) => {
      const row = db
        .prepare(
          'SELECT sound_enabled, music_enabled, speech_rate, reduced_motion FROM settings WHERE child_id = ?',
        )
        .get(childId) as SettingsRow | undefined;
      const current = row ? toSettingsDto(row) : { ...DEFAULT_SETTINGS };

      saved = {
        soundEnabled: input.soundEnabled ?? current.soundEnabled,
        musicEnabled: input.musicEnabled ?? current.musicEnabled,
        speechRate: input.speechRate ?? current.speechRate,
        reducedMotion: input.reducedMotion ?? current.reducedMotion,
      };

      // UPSERT: hàng đã có (đường thường) thì cập nhật; thiếu hàng (DB sửa tay) thì tạo đủ 4 cột.
      db.prepare(
        `INSERT INTO settings (child_id, sound_enabled, music_enabled, speech_rate, reduced_motion, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (child_id) DO UPDATE SET
           sound_enabled  = excluded.sound_enabled,
           music_enabled  = excluded.music_enabled,
           speech_rate    = excluded.speech_rate,
           reduced_motion = excluded.reduced_motion,
           updated_at     = excluded.updated_at`,
      ).run(
        childId,
        saved.soundEnabled ? 1 : 0,
        saved.musicEnabled ? 1 : 0,
        saved.speechRate,
        saved.reducedMotion ? 1 : 0,
        now,
      );
    });

    return saved;
  }
}

/** Dùng chung một instance. */
export const childService = new ChildService();
