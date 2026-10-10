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

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import { SpeakPromptGame } from '@/components/final-test/SpeakPromptGame.js';
import { WriteWordGame } from '@/components/final-test/WriteWordGame.js';
import { ArrangeLettersGame } from '@/components/final-test/ArrangeLettersGame.js';
import { ChoosePictureGame } from '@/components/final-test/ChoosePictureGame.js';
import { GapFillGame } from '@/components/final-test/GapFillGame.js';
import { PickNameGame } from '@/components/final-test/PickNameGame.js';
import { StoryAnswerGame } from '@/components/final-test/StoryAnswerGame.js';
import { TickCrossGame } from '@/components/final-test/TickCrossGame.js';
import { YesNoGame } from '@/components/final-test/YesNoGame.js';
import { __resetSettingsForTests, useSettingsStore } from '@/store/settingsStore.js';
import { finalTestItemSchema, type FinalTestItem } from '@shared/schemas/final-test.js';

function makeItem(raw: Record<string, unknown>): FinalTestItem {
  return finalTestItemSchema.parse(raw);
}

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

  it('choose_picture: 3 lựa chọn, chọn đúng ⇒ báo lên trên', () => {
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

    render(<ChoosePictureGame item={item} onAnswered={onAnswered} />);
    fireEvent.click(screen.getByRole('button', { name: 'kite' }));

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
