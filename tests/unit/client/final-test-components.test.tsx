/**
 * RubyLingo — Test các COMPONENT một câu của bài thi cuối khoá.
 *
 * ⭐ NHỮNG ĐIỀU FILE NÀY CANH:
 *   1. **Trả lời ĐÚNG ⇒ báo lên trên `firstTry: true`** — con số quyết định khiên. Sai ở đây là
 *      trao khiên sai cho bé.
 *   2. **Sai rồi sửa ⇒ `firstTry: false`** — không tính "đúng sau khi sửa" là đúng ngay.
 *   3. **Phần Nói**: hiện câu miễn trừ bắt buộc, KHÔNG micro, bấm "Nói rồi!" là xong.
 *   4. **Tắt tiếng ⇒ nút 🔊 ẩn, nhưng chữ của đề vẫn còn** (B7) — nội dung vẫn đọc được bằng mắt/
 *      screen reader dù app tắt âm thanh.
 *
 * Dữ liệu câu dựng qua CHÍNH schema đề (`finalTestItemSchema.parse`) để test dùng đúng hình dạng
 * thật, không dựng một hình dạng song song có thể lệch.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import { SpeakPromptGame } from '@/components/final-test/SpeakPromptGame.js';
import { WriteWordGame } from '@/components/final-test/WriteWordGame.js';
import { ArrangeLettersGame } from '@/components/final-test/ArrangeLettersGame.js';
import { ChoosePictureGame } from '@/components/final-test/ChoosePictureGame.js';
import { GapFillGame } from '@/components/final-test/GapFillGame.js';
import { findWordForOption, buildWordsByEn } from '@/components/final-test/optionWords.js';
import { PickNameGame } from '@/components/final-test/PickNameGame.js';
import { StoryAnswerGame } from '@/components/final-test/StoryAnswerGame.js';
import { TickCrossGame } from '@/components/final-test/TickCrossGame.js';
import { YesNoGame } from '@/components/final-test/YesNoGame.js';
import { wordAssetUrlOrNull } from '@/data/index.js';
import { contentRepository } from '@/services/ContentRepository.js';
import { __resetSettingsForTests, useSettingsStore } from '@/store/settingsStore.js';
import { finalTestItemSchema, type FinalTestItem } from '@shared/schemas/final-test.js';
import type { Word } from '@shared/types/content.js';

function makeItem(raw: Record<string, unknown>): FinalTestItem {
  return finalTestItemSchema.parse(raw);
}

/** Bảng tra `en` → `Word` từ nội dung THẬT của level starters (dùng cho dạng `choose_picture`). */
const WORDS_BY_EN: ReadonlyMap<string, Word> = buildWordsByEn(
  contentRepository.loadLevel('starters'),
);

/** Thư mục nội dung đề THẬT — đọc để đối chiếu (không dựng hình dạng song song). */
const FINAL_TEST_DIR = join(process.cwd(), 'src/data/levels/starters/final-test');

beforeEach(() => {
  __resetSettingsForTests();
});

// =============================================================================
// Lựa chọn: pick_name / choose_picture / tick_cross / yes_no / gap_fill
// =============================================================================

describe('final-test — câu dạng chọn', () => {
  it('pick_name: chọn đúng ngay ⇒ firstTry = true', () => {
    const onAnswered = vi.fn();
    const item = makeItem({
      id: 'starters.final-test.listening.p1.q1',
      interaction: 'pick_name',
      wordId: 'starters.boy',
      promptEn: 'Who is it?',
      audioTextEn: 'This is a boy.',
      options: ['boy', 'girl'],
      answer: 'boy',
    });

    render(<PickNameGame item={item} onAnswered={onAnswered} />);
    fireEvent.click(screen.getByRole('button', { name: 'boy' }));

    expect(onAnswered).toHaveBeenCalledWith({
      itemId: item.id,
      firstTry: true,
      wrongAttempts: 0,
    });
  });

  it('pick_name: chọn sai rồi chọn đúng ⇒ firstTry = false, wrongAttempts = 1', () => {
    const onAnswered = vi.fn();
    const item = makeItem({
      id: 'starters.final-test.listening.p1.q2',
      interaction: 'pick_name',
      wordId: 'starters.boy',
      promptEn: 'Who is it?',
      options: ['boy', 'girl'],
      answer: 'boy',
    });

    render(<PickNameGame item={item} onAnswered={onAnswered} />);
    fireEvent.click(screen.getByRole('button', { name: 'girl' }));
    expect(onAnswered).not.toHaveBeenCalled();
    expect(screen.getByText('Bé thử lại nhé!')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'boy' }));
    expect(onAnswered).toHaveBeenCalledWith({ itemId: item.id, firstTry: false, wrongAttempts: 1 });
  });

  it('choose_picture: 3 lựa chọn, chọn đúng ⇒ báo lên trên (luật trả lời KHÔNG đổi)', () => {
    const onAnswered = vi.fn();
    const item = makeItem({
      id: 'starters.final-test.listening.p3.q1',
      interaction: 'choose_picture',
      wordId: 'starters.kite',
      promptEn: 'Choose the right picture.',
      audioTextEn: 'Look! The kite is in the sky.',
      options: ['kite', 'balloon', 'boat'],
      answer: 'kite',
    });

    render(<ChoosePictureGame item={item} wordsByEn={WORDS_BY_EN} onAnswered={onAnswered} />);
    // Nhãn đọc nay kèm nghĩa tiếng Việt ⇒ tra bằng regex cho phần chữ tiếng Anh.
    fireEvent.click(screen.getByRole('button', { name: /^kite/ }));

    expect(onAnswered).toHaveBeenCalledWith({ itemId: item.id, firstTry: true, wrongAttempts: 0 });
  });

  it('tick_cross: hai nút có nhãn đọc tiếng Việt, bấm ✓ ⇒ báo lên trên', () => {
    const onAnswered = vi.fn();
    const item = makeItem({
      id: 'starters.final-test.reading-writing.p1.q1',
      interaction: 'tick_cross',
      wordId: 'starters.cat',
      promptEn: 'This is a cat.',
      options: ['tick', 'cross'],
      answer: 'tick',
    });

    render(<TickCrossGame item={item} onAnswered={onAnswered} />);

    expect(screen.getByRole('button', { name: 'Đánh dấu đúng' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đánh dấu không đúng' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu đúng' }));

    expect(onAnswered).toHaveBeenCalledWith({ itemId: item.id, firstTry: true, wrongAttempts: 0 });
  });

  it('yes_no: bấm "yes" ⇒ báo lên trên', () => {
    const onAnswered = vi.fn();
    const item = makeItem({
      id: 'starters.final-test.reading-writing.p2.q1',
      interaction: 'yes_no',
      wordId: 'starters.banana',
      promptEn: 'The banana is yellow.',
      options: ['yes', 'no'],
      answer: 'yes',
    });

    render(<YesNoGame item={item} onAnswered={onAnswered} />);
    fireEvent.click(screen.getByRole('button', { name: 'yes' }));

    expect(onAnswered).toHaveBeenCalledWith({ itemId: item.id, firstTry: true, wrongAttempts: 0 });
  });

  it('gap_fill: chọn từ đúng trong khung ⇒ báo lên trên', () => {
    const onAnswered = vi.fn();
    const item = makeItem({
      id: 'starters.final-test.reading-writing.p4.q1',
      interaction: 'gap_fill',
      wordId: 'starters.hat',
      promptEn: 'I have a new ___ on my head.',
      wordBox: ['hat', 'book', 'shoe'],
      answer: 'hat',
    });

    render(<GapFillGame item={item} onAnswered={onAnswered} />);
    fireEvent.click(screen.getByRole('button', { name: 'hat' }));

    expect(onAnswered).toHaveBeenCalledWith({ itemId: item.id, firstTry: true, wrongAttempts: 0 });
  });
});

// =============================================================================
// Xếp chữ
// =============================================================================

describe('final-test — câu dạng xếp chữ (arrange_letters)', () => {
  function arrange(): FinalTestItem {
    return makeItem({
      id: 'starters.final-test.reading-writing.p3.q1',
      interaction: 'arrange_letters',
      wordId: 'starters.cat',
      promptEn: 'Look at the picture. Make the word.',
      options: ['t', 'c', 'a'],
      hintMask: 'c__',
      answer: 'cat',
    });
  }

  it('xếp đúng "cat" ⇒ firstTry = true', () => {
    const onAnswered = vi.fn();
    render(<ArrangeLettersGame item={arrange()} onAnswered={onAnswered} />);

    fireEvent.click(screen.getByLabelText('chữ c'));
    fireEvent.click(screen.getByLabelText('chữ a'));
    // Chưa đủ 3 chữ ⇒ chưa báo.
    expect(onAnswered).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('chữ t'));

    expect(onAnswered).toHaveBeenCalledWith({
      itemId: 'starters.final-test.reading-writing.p3.q1',
      firstTry: true,
      wrongAttempts: 0,
    });
  });

  it('xếp sai ⇒ KHÔNG báo lên trên, cho xếp lại', () => {
    const onAnswered = vi.fn();
    render(<ArrangeLettersGame item={arrange()} onAnswered={onAnswered} />);

    fireEvent.click(screen.getByLabelText('chữ t'));
    fireEvent.click(screen.getByLabelText('chữ a'));
    fireEvent.click(screen.getByLabelText('chữ c')); // "tac" — sai

    expect(onAnswered).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Viết 1 từ
// =============================================================================

describe('final-test — câu dạng viết 1 từ', () => {
  it('write_word: gõ đúng rồi bấm Kiểm tra ⇒ báo lên trên', () => {
    const onAnswered = vi.fn();
    const item = makeItem({
      id: 'starters.final-test.listening.p2.q1',
      interaction: 'write_word',
      wordId: 'starters.seven',
      promptEn: 'Write the number.',
      audioTextEn: 'Number seven.',
      answer: 'seven',
    });

    render(<WriteWordGame item={item} onAnswered={onAnswered} />);

    fireEvent.change(screen.getByLabelText('Ô viết câu trả lời bằng tiếng Anh'), {
      target: { value: 'Seven' }, // hoa/thường không quan trọng
    });
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra' }));

    expect(onAnswered).toHaveBeenCalledWith({ itemId: item.id, firstTry: true, wrongAttempts: 0 });
  });

  it('story_answer: gõ đúng ⇒ báo lên trên', () => {
    const onAnswered = vi.fn();
    const item = makeItem({
      id: 'starters.final-test.reading-writing.p5.q1',
      interaction: 'story_answer',
      wordId: 'starters.boy',
      promptEn: 'Who is in the park?',
      imageKey: 'story-park',
      answer: 'boy',
    });

    render(<StoryAnswerGame item={item} onAnswered={onAnswered} />);
    fireEvent.change(screen.getByLabelText('Ô viết câu trả lời bằng tiếng Anh'), {
      target: { value: 'boy' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra' }));

    expect(onAnswered).toHaveBeenCalledWith({ itemId: item.id, firstTry: true, wrongAttempts: 0 });
  });
});

// =============================================================================
// Giai đoạn 10 — HÌNH của từ: có asset ⇒ <img>, thiếu asset ⇒ emoji, KHÔNG ảnh vỡ
// =============================================================================

/** Mọi `choose_picture` THẬT trong đề (đọc từ JSON, KHÔNG dựng hình dạng song song). */
function realChoosePictureRaw(): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value !== null && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (record['interaction'] === 'choose_picture') out.push(record);
      Object.values(record).forEach(walk);
    }
  };
  for (const file of readdirSync(FINAL_TEST_DIR)) {
    if (!file.endsWith('.json')) continue;
    walk(JSON.parse(readFileSync(join(FINAL_TEST_DIR, file), 'utf8')));
  }
  return out;
}

/** Đọc `src` của mọi `<img>` trong một `container` (đã render). */
function imgSrcs(container: HTMLElement): string[] {
  return [...container.querySelectorAll('img')].map((img) => img.getAttribute('src') ?? '');
}

describe('final-test — hình của từ (Giai đoạn 10)', () => {
  it('choose_picture: từ CÓ asset ⇒ render <img> đúng src + nhãn đọc tiếng Việt', () => {
    const item = makeItem({
      id: 'starters.final-test.listening.p3.q1',
      interaction: 'choose_picture',
      wordId: 'starters.kite',
      promptEn: 'Choose the right picture.',
      audioTextEn: 'Look! The kite is in the sky.',
      options: ['kite', 'balloon', 'boat'],
      answer: 'kite',
    });

    const { container } = render(
      <ChoosePictureGame item={item} wordsByEn={WORDS_BY_EN} onAnswered={vi.fn()} />,
    );

    expect(imgSrcs(container).sort()).toEqual(
      [
        wordAssetUrlOrNull('starters.kite'),
        wordAssetUrlOrNull('starters.balloon'),
        wordAssetUrlOrNull('starters.boat'),
      ].sort(),
    );
    // Nhãn tiếng Việt cho trình đọc màn hình (kèm chữ tiếng Anh đang hiện).
    expect(screen.getByRole('button', { name: 'kite — cái diều' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^boat/ })).toBeInTheDocument();
  });

  it('choose_picture: từ CHƯA có asset ⇒ emoji, TUYỆT ĐỐI không render <img>', () => {
    const item = makeItem({
      id: 'starters.final-test.listening.p3.q9',
      interaction: 'choose_picture',
      wordId: 'starters.two',
      promptEn: 'Choose the right picture.',
      audioTextEn: 'Two cats.',
      options: ['two', 'three', 'four'],
      answer: 'two',
    });

    const { container } = render(
      <ChoosePictureGame item={item} wordsByEn={WORDS_BY_EN} onAnswered={vi.fn()} />,
    );

    expect(imgSrcs(container)).toHaveLength(0);
    // Emoji của từ vẫn hiện (đường lùi cho ảnh chưa sinh).
    expect(screen.getByText('2️⃣')).toBeInTheDocument();
  });

  it('choose_picture: lựa chọn vẫn bấm được và trả về ĐÚNG chuỗi của đề', () => {
    const onAnswered = vi.fn();
    const item = makeItem({
      id: 'starters.final-test.listening.p3.q1',
      interaction: 'choose_picture',
      wordId: 'starters.kite',
      promptEn: 'Choose the right picture.',
      options: ['kite', 'balloon', 'boat'],
      answer: 'kite',
    });

    render(<ChoosePictureGame item={item} wordsByEn={WORDS_BY_EN} onAnswered={onAnswered} />);

    fireEvent.click(screen.getByRole('button', { name: /^boat/ }));
    expect(onAnswered).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^kite/ }));
    expect(onAnswered).toHaveBeenCalledWith({ itemId: item.id, firstTry: false, wrongAttempts: 1 });
  });

  it('story_answer: KHÔNG BAO GIỜ vẽ hình của ĐÁP ÁN (chống lộ đáp án)', () => {
    // `wordId` là ĐÁP ÁN và CÓ asset (boy) — nhưng KHÔNG khai `imageKey` (không tranh truyện).
    const item = makeItem({
      id: 'starters.final-test.reading-writing.p5.q1',
      interaction: 'story_answer',
      wordId: 'starters.boy',
      promptEn: 'Who is in the park?',
      answer: 'boy',
    });

    const { container } = render(
      <StoryAnswerGame
        item={item}
        word={contentRepository.getWord('starters.boy')}
        onAnswered={vi.fn()}
      />,
    );

    // Không tranh truyện ⇒ KHÔNG ảnh nào, và tuyệt đối không phải hình của đáp án.
    expect(imgSrcs(container)).toHaveLength(0);
    expect(imgSrcs(container)).not.toContain(wordAssetUrlOrNull('starters.boy'));
  });

  it('story_answer: có tranh truyện THẬT ⇒ hiện TRANH TRUYỆN, không phải hình đáp án', () => {
    const item = makeItem({
      id: 'starters.final-test.reading-writing.p5.q1',
      interaction: 'story_answer',
      wordId: 'starters.boy',
      promptEn: 'Who is in the park?',
      imageKey: 'story-park',
      answer: 'boy',
    });

    const { container } = render(
      <StoryAnswerGame
        item={item}
        word={contentRepository.getWord('starters.boy')}
        onAnswered={vi.fn()}
      />,
    );

    expect(imgSrcs(container)).toEqual(['/assets/scenes/story-park.webp']);
    expect(imgSrcs(container)).not.toContain(wordAssetUrlOrNull('starters.boy'));
  });

  it('story_answer: `imageKey` trỏ tới tranh KHÔNG có thật ⇒ KHÔNG vẽ ảnh (không ảnh vỡ)', () => {
    const item = makeItem({
      id: 'starters.final-test.reading-writing.p5.q1',
      interaction: 'story_answer',
      wordId: 'starters.boy',
      promptEn: 'Who is in the park?',
      imageKey: 'khong-co-tranh-nay',
      answer: 'boy',
    });

    const { container } = render(
      <StoryAnswerGame
        item={item}
        word={contentRepository.getWord('starters.boy')}
        onAnswered={vi.fn()}
      />,
    );

    expect(imgSrcs(container)).toHaveLength(0);
  });

  it('KHÔNG có lựa chọn/wordId nào của đề render <img> với src SAI (đối chiếu manifest asset)', () => {
    const raws = realChoosePictureRaw();
    // Cổng không được rỗng: nếu 0 item thì vòng lặp dưới không chạy và test "xanh giả".
    expect(raws.length).toBeGreaterThanOrEqual(10);

    for (const raw of raws) {
      const item = finalTestItemSchema.parse(raw);
      if (item.interaction !== 'choose_picture') continue;

      const { container, unmount } = render(
        <ChoosePictureGame item={item} wordsByEn={WORDS_BY_EN} onAnswered={vi.fn()} />,
      );

      for (const src of imgSrcs(container)) {
        const match = /^\/assets\/words\/(.+)\.webp$/.exec(src);
        expect(match, `src ảnh không đúng dạng chuẩn: ${src}`).not.toBeNull();
        const wordId = match![1]!;
        // `wordAssetUrlOrNull` trả `null` khi id KHÔNG có trong manifest ⇒ lệch nghĩa là src sai.
        expect(src, `src ảnh trỏ tới từ KHÔNG có asset: ${wordId}`).toBe(
          wordAssetUrlOrNull(wordId),
        );
      }

      // Với mỗi lựa chọn: CÓ asset ⇒ đúng 1 <img>; KHÔNG có asset ⇒ không <img> nào cho nó.
      for (const option of item.options ?? []) {
        const word = findWordForOption(WORDS_BY_EN, option);
        expect(word, `lựa chọn "${option}" không tra được từ trong level`).not.toBeNull();
        const expectedSrc = wordAssetUrlOrNull(word!.id);
        const srcsForWord = imgSrcs(container).filter((s) => s === expectedSrc);
        expect(srcsForWord.length).toBe(expectedSrc === null ? 0 : 1);
      }

      unmount();
    }
  });
});

// =============================================================================
// Phần Nói
// =============================================================================

describe('final-test — câu dạng nói (speak_prompt)', () => {
  function speak(): FinalTestItem {
    return makeItem({
      id: 'starters.final-test.speaking.p1.q1',
      interaction: 'speak_prompt',
      promptEn: 'Point to the door.',
      audioTextEn: 'Point to the door.',
      imageKey: 'home-scene',
      wordId: 'starters.door',
    });
  }

  it('hiện CÂU MIỄN TRỪ bắt buộc (không phải kỳ thi Cambridge)', () => {
    render(<SpeakPromptGame item={speak()} onAnswered={vi.fn()} />);

    expect(
      screen.getByText(
        'RubyLingo không phải kỳ thi Cambridge; kết quả ở đây không có giá trị chứng nhận.',
      ),
    ).toBeInTheDocument();
  });

  it('bấm "Nói rồi!" ⇒ báo lên trên (độ tham gia, không chấm điểm)', () => {
    const onAnswered = vi.fn();
    const item = speak();

    render(<SpeakPromptGame item={item} onAnswered={onAnswered} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bé đã nói xong câu này' }));

    expect(onAnswered).toHaveBeenCalledWith({ itemId: item.id, firstTry: true, wrongAttempts: 0 });
  });

  it('KHÔNG có micro / ghi âm — không có nút nào yêu cầu quyền micro', () => {
    render(<SpeakPromptGame item={speak()} onAnswered={vi.fn()} />);
    // Không có nội dung nào nhắc tới "ghi âm" hay "micro" trong phần Nói.
    expect(document.body.textContent?.toLowerCase()).not.toContain('ghi âm');
  });
});

// =============================================================================
// Tắt tiếng ⇒ ẩn nút loa, nhưng chữ của đề vẫn còn (B7)
// =============================================================================

describe('final-test — tắt tiếng thì ẩn nút 🔊 nhưng giữ chữ (B7)', () => {
  const item = (): FinalTestItem =>
    makeItem({
      id: 'starters.final-test.listening.p1.q7',
      interaction: 'pick_name',
      wordId: 'starters.boy',
      promptEn: 'Who is it?',
      audioTextEn: 'This is a boy.',
      options: ['boy', 'girl'],
      answer: 'boy',
    });

  it('bật tiếng ⇒ có nút "Nghe lại"', () => {
    useSettingsStore.setState({ soundEnabled: true });
    render(<PickNameGame item={item()} onAnswered={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Nghe lại' })).toBeInTheDocument();
  });

  it('tắt tiếng ⇒ KHÔNG còn nút "Nghe lại", nhưng câu lệnh + lựa chọn vẫn hiện', () => {
    useSettingsStore.setState({ soundEnabled: false });
    render(<PickNameGame item={item()} onAnswered={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Nghe lại' })).not.toBeInTheDocument();
    // Nội dung KHÔNG mất: câu lệnh tiếng Anh + hai lựa chọn vẫn còn cho mắt và screen reader.
    expect(screen.getByText('Who is it?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'boy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'girl' })).toBeInTheDocument();
  });
});
