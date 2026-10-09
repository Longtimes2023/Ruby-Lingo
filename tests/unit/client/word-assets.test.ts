/**
 * RubyLingo — chốt chặn cho ẢNH MINH HOẠ TỪ VỰNG.
 *
 * (Tệp này thay `body-part-figure.test.ts`. Bản cũ canh hình vẽ tay `BodyPartFigure`;
 *  chủ dự án đã chốt chuyển sang ảnh AI cho CẢ `my-body`, nên hình vẽ tay đã bị xoá.)
 *
 * ⭐⭐ VÌ SAO CẦN TỆP NÀY — ĐÚNG HỌ LỖI "KHAI BÁO TRÔNG ĐÚNG NHƯNG HÀNH VI SAI":
 *
 *   Ảnh minh hoạ nối vào từ vựng qua **bốn** nguồn có thể lệch nhau:
 *
 *       1. nội dung từ        src/data/levels/starters/themes/*.json   (từ nào CẦN ảnh)
 *       2. kế hoạch           asset-src/words/plan.json               (từ nào SẼ sinh)
 *       3. manifest           src/data/word-assets.json               (từ nào ĐÃ có, client đọc)
 *       4. tệp trên đĩa       public/assets/words/*.webp              (sự thật cuối cùng)
 *
 *   Lệch nhau thì KHÔNG có gì báo lỗi: `tsc` xanh, `eslint` xanh, build xanh, và ảnh chụp
 *   màn hình chỉ chụp vài thẻ đầu nên không thấy. Bé sẽ gặp lại emoji mơ hồ — hoặc tệ hơn,
 *   một ô vỡ ảnh — mà không ai biết. Đây đúng là họ lỗi ở skill `css-silent-failures`.
 *
 * ⚠️ BẪY ĐÃ TRẢ GIÁ, TỆP NÀY CANH TRỰC TIẾP:
 *   Công cụ sinh ảnh đặt tên tệp CHÍNH XÁC TỚI GIÂY và BỎ QUA `output_dir`; hai lời gọi
 *   cùng giây thì GHI ĐÈ NHAU (đã mất 2/8 ảnh mẫu, mọi lời gọi vẫn báo `completed`).
 *   ⇒ Khẳng định ở đây: hễ `ledger.json` nói `done` thì tệp webp PHẢI có thật. Mất tệp
 *     là test đỏ ngay, không thể im lặng.
 *
 * ⚠️ Test này ĐỌC TỆP THẬT TRÊN ĐĨA. Test đỏ thì sửa NGUỒN (chạy lại
 *    `asset-src/words/plan.py` rồi `convert_words.py`), TUYỆT ĐỐI không nới test ra.
 *
 * ⚠️⚠️ NHƯNG CÓ HAI HẠNG BẤT BIẾN — ĐỪNG LẪN (bài học từ CI GitHub đỏ ngày 2026-10-09):
 *   (a) BẤT BIẾN CỦA REPO — phải đúng ở MỌI nơi, kể cả bản clone sạch: manifest ↔ tệp webp
 *       trên đĩa ↔ nội dung từ. `public/assets/words/*.webp` ĐƯỢC COMMIT nên luôn kiểm được.
 *   (b) BẤT BIẾN CỦA XƯỞNG SINH ẢNH — chỉ có nghĩa ở nơi có ẢNH NGUỒN THÔ:
 *       `asset-src/words/source/*.png` bị `.gitignore` loại (291 MB) nên KHÔNG tồn tại trong
 *       bản clone sạch (CI GitHub, VPS). Phép kiểm "còn nguồn để tái tạo" thuộc hạng (b).
 *   Lần đầu, phép kiểm (b) được viết y như phép kiểm (a) ⇒ nó chỉ xanh ở ĐÚNG MỘT MÁY TRÊN
 *   ĐỜI: `npm run ci` xanh ở máy dev, còn CI GitHub đỏ ở bước "Chạy cổng kiểm của dự án" với
 *   201 mục thiếu nguồn — trong khi `tsc`, `eslint` và `vite build` đều xanh, nên không có gì
 *   gợi ý nguyên nhân.
 *   ⇒ Ở nơi KHÔNG có xưởng: đừng im lặng bỏ qua. Khẳng định điều CÒN kiểm được (ledger vẫn ghi
 *     đường dẫn nguồn cho MỌI mục `done`) — nhờ vậy khi chạy ở nơi CÓ xưởng, phép kiểm hạng (b)
 *     có nghĩa chứ không rỗng.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { WordIcon } from '../../../src/components/common/WordIcon.js';
import { wordAssetUrl, wordAssetUrlOrNull } from '../../../src/data/index.js';

/**
 * Gốc repo `rubylingo/`.
 *
 * ⚠️ KHÔNG dùng `fileURLToPath(new URL(…, import.meta.url))`: dưới Vitest `import.meta.url`
 *    không mang scheme `file:` ⇒ `TypeError: The URL must be of scheme file`. Bẫy đã trả giá
 *    ở `styles-fonts.test.ts`.
 */
const ROOT = process.cwd() + '/';
const THEMES_DIR = join(ROOT, 'src/data/levels/starters/themes');
const WORDS_DIR = join(ROOT, 'public/assets/words');
const MANIFEST_PATH = join(ROOT, 'src/data/word-assets.json');
const PLAN_PATH = join(ROOT, 'asset-src/words/plan.json');
const LEDGER_PATH = join(ROOT, 'asset-src/words/ledger.json');

/**
 * Cờ hoàn tất: ĐÃ LẬT `true` ngày 2026-10-08 khi sinh đủ **201/201** ảnh. Xem test ⑪.
 *
 * ⚠️ Từ đây test ⑪ khẳng định điều MẠNH HƠN: không một từ nào cần ảnh mà còn thiếu. Đổi cờ này
 *    về `false` là tự nới lỏng cổng kiểm — đừng làm, trừ khi thật sự xoá ảnh để sinh lại.
 */
const GENERATION_COMPLETE = true;

interface WordRecord {
  id: string;
  en: string;
  icon: string;
  picturable?: boolean;
  primaryThemeId: string;
}
interface ThemeFile {
  words: WordRecord[];
}
interface PlanEntry {
  key: string;
  id: string;
  en: string;
  theme: string;
  subject: string;
  prompt: string;
}

// --- Đọc thẳng từ đĩa --------------------------------------------------------

function readAllWords(): WordRecord[] {
  return readdirSync(THEMES_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .flatMap((name) => {
      const raw = readFileSync(join(THEMES_DIR, name), 'utf8');
      return (JSON.parse(raw) as ThemeFile).words;
    });
}

/**
 * Tập từ CẦN có ảnh minh hoạ.
 *
 * 198 từ `picturable` + 3 từ `my-body` không vẽ được nhưng VẪN hiện trên thẻ từ vựng
 * (`hair`, `body`, `head`) — đúng ba từ đã gây ra phàn nàn ban đầu.
 *
 * KHÔNG lấy bảng chữ cái (A–Z) và số (one–twenty): thẻ của chúng phải hiện đúng CHỮ/số,
 * đó mới là bài học — vẽ con vật cho chữ "B" là làm hỏng bài.
 */
function requiredWordIds(): Set<string> {
  const words = readAllWords();
  const ids = new Set(words.filter((w) => w.picturable).map((w) => w.id));
  for (const word of words) {
    if (!word.picturable && word.primaryThemeId === 'my-body') ids.add(word.id);
  }
  return ids;
}

function readManifest(): { count: number; ids: string[] } {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { count: number; ids: string[] };
}

function readPlan(): PlanEntry[] {
  return JSON.parse(readFileSync(PLAN_PATH, 'utf8')) as PlanEntry[];
}

/** Id suy từ TÊN TỆP thật trên đĩa (không tin manifest). */
function diskIds(): string[] {
  if (!existsSync(WORDS_DIR)) return [];
  return readdirSync(WORDS_DIR)
    .filter((name) => name.endsWith('.webp'))
    .map((name) => name.slice(0, -'.webp'.length))
    .sort();
}

function readLedger(): Record<string, { status: string; file: string | null }> {
  return JSON.parse(readFileSync(LEDGER_PATH, 'utf8')) as Record<
    string,
    { status: string; file: string | null }
  >;
}

// --- Chốt chặn --------------------------------------------------------------

describe('Ảnh từ vựng — bốn nguồn phải khớp nhau', () => {
  const required = requiredWordIds();
  const manifest = readManifest();
  const plan = readPlan();
  const onDisk = diskIds();
  const ledger = readLedger();

  it('① kế hoạch phủ ĐÚNG tập từ cần ảnh, không thừa không thiếu', () => {
    const planIds = new Set(plan.map((entry) => entry.id));
    const thieu = [...required].filter((id) => !planIds.has(id));
    const thua = [...planIds].filter((id) => !required.has(id));
    expect({ thieu, thua }).toEqual({ thieu: [], thua: [] });
  });

  it('② mỗi mục trong kế hoạch đều có câu tả chủ thể và prompt đầy đủ', () => {
    for (const entry of plan) {
      expect(entry.subject.length, entry.id).toBeGreaterThan(15);
      expect(entry.prompt.length, entry.id).toBeGreaterThan(200);
      // Phong cách đã chốt: 3D phim hoạt hình, KHÔNG bóng nhựa.
      expect(entry.prompt, entry.id).toContain('animated children');
      expect(entry.prompt, entry.id).toContain('NOT glossy plastic');
    }
  });

  it('③ MỌI prompt đều yêu cầu nền trong suốt — xoá mất câu này là hỏng cả 201 ảnh', () => {
    // Thẻ từ vựng nền TRẮNG, ô đáp án đổi sang xanh/đỏ/vàng nhạt. Ảnh có nền sẽ thành
    // một ô vuông dán lên thẻ. Đây là bất biến, không phải sở thích.
    for (const entry of plan) {
      expect(entry.prompt, entry.id).toContain('BACKGROUND: fully transparent');
    }
  });

  it('④ manifest và tệp trên đĩa phải GIỐNG HỆT nhau', () => {
    expect([...manifest.ids].sort()).toEqual(onDisk);
  });

  it('⑤ không nguồn nào chứa id lạ (không phải từ cần ảnh)', () => {
    const la = [...manifest.ids, ...onDisk].filter((id) => !required.has(id));
    expect(la).toEqual([]);
  });

  it('⑥ manifest tự nhất quán: count đúng, id duy nhất, đã sắp xếp', () => {
    expect(manifest.count).toBe(manifest.ids.length);
    expect(new Set(manifest.ids).size).toBe(manifest.ids.length);
    expect(manifest.ids).toEqual([...manifest.ids].sort());
  });

  it('⑦ mọi id trong manifest đều có tệp thật', () => {
    const thieu = manifest.ids.filter((id) => !existsSync(join(WORDS_DIR, `${id}.webp`)));
    expect(thieu).toEqual([]);
  });

  it('⑧ ledger nói `done` thì tệp PHẢI có thật (canh bẫy ghi đè cùng giây)', () => {
    const done = Object.entries(ledger).filter(([, value]) => value.status === 'done');
    const thieu = done
      .map(([key, value]) => ({ key, value }))
      .filter(({ key }) => !manifest.ids.includes(`starters.${key}`))
      .map(({ key }) => key);
    expect(thieu).toEqual([]);
    // Không đếm trùng: số mục `done` phải bằng số ảnh thật có trong manifest.
    expect(done.length).toBe(manifest.ids.length);
    // Mọi mục `done` cũng phải có ảnh nguồn — mất ảnh nguồn thì không tái tạo được.
    //
    // ⚠️ Đây là bất biến hạng (b) — xem khối chú thích đầu tệp. `asset-src/words/source/` bị
    //    `.gitignore` loại nên chỉ tồn tại ở xưởng sinh ảnh, KHÔNG có trong bản clone sạch.
    const SOURCE_DIR = join(ROOT, 'asset-src/words/source');
    if (!existsSync(SOURCE_DIR)) {
      // Không có xưởng ⇒ KHÔNG im lặng bỏ qua. Kiểm điều còn kiểm được: ledger phải ghi đường
      // dẫn nguồn cho MỌI mục `done`. Nếu chính điều đó sai thì ở xưởng phép kiểm dưới đây sẽ
      // rỗng nghĩa (mọi `value.file` undefined ⇒ mọi mục đều bị coi là thiếu nguồn).
      expect(
        done.every(
          ([, value]) => typeof value.file === 'string' && value.file.startsWith('source/'),
        ),
        'ledger phải ghi đường dẫn ảnh nguồn (dạng `source/<tên>.png`) cho mọi mục done',
      ).toBe(true);
      return;
    }
    const matNguon = done
      .filter(([, value]) => !existsSync(join(ROOT, 'asset-src/words', value.file ?? '')))
      .map(([key]) => key);
    expect(matNguon).toEqual([]);
  });

  it('⑨ wordAssetUrlOrNull: có ảnh ⇒ URL đúng, không có ⇒ null', () => {
    expect(wordAssetUrlOrNull('starters.khong-co-that')).toBeNull();
    for (const id of manifest.ids) {
      expect(wordAssetUrl(id)).toBe(`/assets/words/${id}.webp`);
      expect(wordAssetUrlOrNull(id)).toBe(`/assets/words/${id}.webp`);
    }
    // Từ THẬT nhưng CHƯA sinh ảnh cũng phải trả null (để UI lùi về emoji, không 404).
    const chuaCo = [...required].filter((id) => !manifest.ids.includes(id));
    for (const id of chuaCo) expect(wordAssetUrlOrNull(id)).toBeNull();
  });

  it('⑩ khoá ảnh theo ID chứ không theo `en` — các từ cùng viết phải khác ảnh', () => {
    // `orange-adj` (màu cam) / `orange-n` (quả cam) · `chicken` (con gà) / `chicken-meat`
    // (thịt gà) · `mouse` (con chuột) / `mouse-computer` (chuột máy tính).
    // Khoá theo `en` sẽ gán nhầm hình cho nhau, và KHÔNG có gì báo lỗi.
    const byEn = new Map<string, string[]>();
    for (const id of required) {
      const wordId = id.split('.', 2)[1] ?? '';
      const en = wordId.replace(/-(adj|n|meat|computer)$/, '');
      byEn.set(en, [...(byEn.get(en) ?? []), id]);
    }
    const nhomTrung = [...byEn.entries()].filter(([, ids]) => ids.length > 1);
    expect(nhomTrung.length).toBeGreaterThan(0); // dữ liệu phải CÓ ca này, không phải test rỗng

    for (const [en, ids] of nhomTrung) {
      const urls = ids.map((id) => wordAssetUrl(id));
      expect(new Set(urls).size, `en=${en}`).toBe(ids.length);
    }

    // Nếu cả hai đã có ảnh thì nội dung tệp phải KHÁC nhau (không sinh trùng một prompt).
    for (const [en, ids] of nhomTrung) {
      const hai = ids.filter((id) => manifest.ids.includes(id));
      if (hai.length < 2) continue;
      const bytes = hai.map((id) => readFileSync(join(WORDS_DIR, `${id}.webp`)));
      for (let i = 1; i < bytes.length; i += 1) {
        expect(bytes[i]?.equals(bytes[0] as Buffer), `en=${en}`).toBe(false);
      }
    }
  });

  it('⑪ mọi từ cần ảnh đều đã có ảnh (bật khi sinh xong)', () => {
    const thieu = [...required].filter((id) => !manifest.ids.includes(id));
    if (!GENERATION_COMPLETE) {
      // Đang sinh dần theo chủ đề. Chỉ khẳng định phần đã sinh là nhất quán và số còn
      // lại tính đúng — không nới lỏng các bất biến ở trên.
      expect(thieu.length).toBe(required.size - manifest.ids.length);
      return;
    }
    expect(thieu).toEqual([]);
  });

  it('⑫ WordIcon THẬT SỰ dùng manifest: có ảnh ⇒ <img>, chưa có ⇒ emoji', () => {
    // Chốt chặn cuối: manifest đúng mà component không đọc thì cũng vô nghĩa. Test này
    // render component thật, không mock `wordAssetUrlOrNull`.
    for (const id of manifest.ids.slice(0, 5)) {
      const markup = renderToStaticMarkup(createElement(WordIcon, { wordId: id, fallback: '🐘' }));
      expect(markup, id).toContain('<img');
      expect(markup, id).toContain(`src="/assets/words/${id}.webp"`);
      // Ảnh là TRANG TRÍ: nghĩa của từ do chữ hoặc `aria-label` ở nơi gọi đảm nhiệm.
      // Không có `alt=""` thì trình đọc màn hình đọc tên tệp.
      expect(markup, id).toContain('alt=""');
      expect(markup, id).not.toContain('🐘');
    }

    /**
     * ⚠️ Dùng một từ THẬT nhưng CỐ Ý không có ảnh (`starters.a` — thẻ bảng chữ cái phải hiện đúng
     * CHỮ, đó mới là bài học), chứ KHÔNG lấy "từ đầu tiên còn thiếu trong `required`".
     *
     *   Bản cũ làm thế, và khi sinh đủ 201 ảnh thì danh sách đó RỖNG ⇒ cả nhánh kiểm này **lặng lẽ
     *   biến mất**. Một test canh chuyện DỰ PHÒNG mà tự tắt đúng lúc mọi thứ hoàn hảo là một test
     *   sẽ không bao giờ bắt được lúc nó hỏng.
     */
    const chuaCo = 'starters.a';
    expect(manifest.ids, 'giả định của test này đã sai').not.toContain(chuaCo);
    const markup = renderToStaticMarkup(
      createElement(WordIcon, { wordId: chuaCo, fallback: '🐘' }),
    );
    expect(markup).not.toContain('<img');
    expect(markup).toContain('🐘');
  });
});
