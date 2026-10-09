/**
 * RubyLingo — G4 `prepositions`: LUẬT THUẦN + BẢNG BỐ CỤC CẢNH.
 *
 * ⚠️⚠️ BÉ CHẠM VÀO **HÌNH**, KHÔNG CHẠM VÀO CHỮ GIỚI TỪ.
 *   Đây là điểm dễ làm sai nhất của trò này. Thiết kế (`GAME-REWARD-DESIGN.md`) ghi rõ: app đọc
 *   một câu, bé chạm vào HÌNH thể hiện đúng vị trí, và **chỉ sau khi trả lời câu chữ mới hiện ra**.
 *   Nếu ta vẽ bốn nút chữ "in / on / under / behind" thì trò chơi biến thành bài đọc — bé đọc chữ
 *   thay vì nghe và hiểu vị trí. Cả bốn lựa chọn ở đây là bốn CẢNH.
 *
 * ⭐ VÌ SAO BỐ CỤC NẰM TRONG MỘT BẢNG DỮ LIỆU, KHÔNG NẰM TRONG JSX:
 *   Bảy giới từ của thiết kế (in · on · under · next to · behind · between · in front of) phải
 *   trông KHÁC NHAU RÕ RÀNG — nếu `under` và `behind` vẽ ra hai cảnh giống nhau thì bé chọn đúng
 *   mà vẫn bị báo sai. Để chúng thành dữ liệu thì kiểm được bằng test ("mọi giới từ phải có bố cục
 *   riêng", "không giới từ nào trùng bố cục với giới từ khác").
 */

import type { Word } from '@shared/types/content.js';

/** Một ô trong cảnh, toạ độ tính theo % cạnh của khung. */
export interface SceneSlot {
  left: number;
  top: number;
}

export interface SceneLayout {
  /** Các cái hộp trong cảnh (`between` có hai hộp). */
  boxes: SceneSlot[];
  /** Con vật. */
  pet: SceneSlot & {
    /** Thu nhỏ lại khi con vật ở TRONG hộp — để đọc ra "nằm gọn bên trong". */
    scale: number;
    /** `true` = con vật vẽ ĐÈ LÊN hộp (ở trước); `false` = hộp che mất một phần con vật (ở sau). */
    front: boolean;
  };
}

/** Bố cục mặc định khi gặp giới từ lạ (dữ liệu mới chưa cập nhật bảng này). */
const FALLBACK: SceneLayout = {
  boxes: [{ left: 27, top: 27 }],
  pet: { left: 31, top: 31, scale: 1, front: true },
};

/**
 * Bố cục cho từng giới từ. Khoá là chữ THƯỜNG, đã gộp khoảng trắng.
 *
 * Kích thước vẽ: hộp 46px, con vật 38px trong khung ~160px ⇒ 46px ≈ 29% và 38px ≈ 24%.
 */
const LAYOUTS: Readonly<Record<string, SceneLayout>> = {
  // Gọn bên trong hộp, nhỏ hơn một chút.
  in: { boxes: [{ left: 27, top: 27 }], pet: { left: 31, top: 31, scale: 0.82, front: true } },
  // Ngồi TRÊN NẮP hộp.
  on: { boxes: [{ left: 27, top: 42 }], pet: { left: 31, top: 6, scale: 1, front: true } },
  // Chui DƯỚI đáy hộp.
  under: { boxes: [{ left: 27, top: 10 }], pet: { left: 31, top: 52, scale: 1, front: true } },
  // Hộp ở trước che mất một phần con vật ⇒ `front: false`.
  behind: { boxes: [{ left: 32, top: 34 }], pet: { left: 16, top: 22, scale: 1, front: false } },
  // Đứng BÊN CẠNH hộp.
  'next to': { boxes: [{ left: 8, top: 27 }], pet: { left: 56, top: 27, scale: 1, front: true } },
  // Kẹp GIỮA hai hộp — phải là hai hộp, nếu một hộp thì bé không thể phân biệt với "next to".
  between: {
    boxes: [
      { left: 0, top: 27 },
      { left: 62, top: 27 },
    ],
    pet: { left: 34, top: 27, scale: 0.9, front: true },
  },
  // Đứng TRƯỚC hộp (hộp ở sau, con vật che mất một phần hộp).
  'in front of': { boxes: [{ left: 27, top: 20 }], pet: { left: 31, top: 46, scale: 1, front: true } },
};

/** Bố cục của một giới từ. Luôn trả về một bố cục dùng được, không bao giờ `undefined`. */
export function sceneLayout(preposition: string): SceneLayout {
  const key = preposition.trim().toLowerCase().replace(/\s+/g, ' ');
  return LAYOUTS[key] ?? FALLBACK;
}

/** Mọi giới từ đã có bố cục riêng — để test khỏi bỏ sót khi thêm giới từ mới. */
export function knownPrepositions(): string[] {
  return Object.keys(LAYOUTS);
}

export interface SentenceParts {
  before: string;
  after: string;
}

/**
 * Cắt câu quanh giới từ để vẽ chỗ trống.
 *
 * ⚠️ Dùng khớp THEO TỪ (`\\b`) chứ không `indexOf`: `indexOf('in')` trong "The mouse is in the
 *   box." vẫn đúng, nhưng với câu khác nó sẽ bắt được "in" nằm trong một từ khác và cắt câu sai
 *   chỗ — bé đọc ra một câu vô nghĩa, mà không có lỗi nào được ném.
 *
 * Không tìm thấy thì trả `before = cả câu` và `after = ''`: chỗ trống thành cuối câu. Xấu, nhưng
 * KHÔNG mất câu — bé vẫn đọc được câu và vẫn nhận ra giới từ.
 */
export function splitSentence(sentenceEn: string, preposition: string): SentenceParts {
  const escaped = preposition.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`\\b${escaped}\\b`, 'i').exec(sentenceEn);
  if (!match || match.index === undefined) return { before: sentenceEn, after: '' };
  return {
    before: sentenceEn.slice(0, match.index),
    after: sentenceEn.slice(match.index + match[0].length),
  };
}

/**
 * Emoji con vật của câu.
 *
 * Câu luôn có dạng "The <con vật> is <giới từ> the box." nên con vật là từ tiếng Anh trong câu
 * trùng với một từ của bài tập — tra bảng đó thay vì bịa một emoji.
 *
 * Không tra được thì trả `fallback` (emoji con vật chung) chứ KHÔNG trả chuỗi rỗng: một ô trống
 * trong cảnh làm bé tưởng màn hình lỗi.
 */
export function subjectIcon(sentenceEn: string, words: readonly Word[], fallback = '🐾'): string {
  const haystack = sentenceEn.toLowerCase();
  for (const word of words) {
    const needle = word.en.toLowerCase();
    if (needle.length > 0 && new RegExp(`\\b${needle}\\b`).test(haystack)) return word.icon;
  }
  return fallback;
}
