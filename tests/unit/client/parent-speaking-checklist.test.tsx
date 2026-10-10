/**
 * RubyLingo — Test `ParentSpeakingChecklist` (TẦNG 4 — phụ huynh xác nhận phần Nói).
 *
 * ⭐ NHỮNG ĐIỀU FILE NÀY CANH:
 *   1. **Rubric là HÀNH VI, không phải điểm.** Bốn mục, mỗi mục hai lựa chọn "Bé đã làm được" /
 *      "Mình ôn thêm nhé" — không có "đạt/trượt", không có từ chê.
 *   2. **Lưu TÁCH THEO BÉ.** Khoá lưu có `childId`; đánh dấu cho bé A không được lộ sang bé B.
 *   3. **Nói THẬT là chưa đồng bộ server.** Câu `parent.speakingLocalNote` bắt buộc hiện.
 *   4. **Bấm lại lựa chọn cũ ⇒ bỏ đánh dấu** (về "chưa xác nhận") để phụ huynh sửa được.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import '@/i18n/index.js';
import { ParentSpeakingChecklist } from '@/components/final-test/ParentSpeakingChecklist.js';
import { __clearSpeakingMarksForTests, loadSpeakingMarks } from '@/lib/parentSpeakingMarks.js';

const CHILD_A = 'chi_a';
const CHILD_B = 'chi_b';

beforeEach(() => {
  __clearSpeakingMarksForTests(CHILD_A);
  __clearSpeakingMarksForTests(CHILD_B);
});

describe('ParentSpeakingChecklist', () => {
  it('hiện rubric 4 phần Nói + câu nói thật về việc chưa đồng bộ server', () => {
    render(<ParentSpeakingChecklist childId={CHILD_A} />);

    expect(
      screen.getByText('Bé làm theo chỉ dẫn: chỉ vào tranh hoặc đặt đồ vật đúng chỗ khi nghe tiếng Anh.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Bé nói được một câu ngắn về bức tranh.')).toBeInTheDocument();
    expect(screen.getByText('Bé nói được tên đồ vật khi được hỏi.')).toBeInTheDocument();
    expect(
      screen.getByText('Bé trả lời được câu hỏi về bản thân (tuổi, gia đình, sở thích).'),
    ).toBeInTheDocument();

    // ⚠️ Bắt buộc: nói rõ lựa chọn chỉ lưu cục bộ.
    expect(
      screen.getByText(/chỉ lưu trên thiết bị này, chưa đồng bộ lên máy chủ/),
    ).toBeInTheDocument();
  });

  it('đánh dấu "Bé đã làm được" cho phần 1 ⇒ ghi vào localStorage của đúng bé', () => {
    render(<ParentSpeakingChecklist childId={CHILD_A} />);

    const doneButtons = screen.getAllByRole('button', { name: /Bé đã làm được/ });
    fireEvent.click(doneButtons[0] as HTMLElement);

    expect(loadSpeakingMarks(CHILD_A)).toMatchObject({ 1: 'done' });
  });

  it('⚠️ lưu TÁCH THEO BÉ — bé A đánh dấu không ảnh hưởng bé B', () => {
    render(<ParentSpeakingChecklist childId={CHILD_A} />);
    fireEvent.click(screen.getAllByRole('button', { name: /Bé đã làm được/ })[0] as HTMLElement);
    expect(loadSpeakingMarks(CHILD_A)).toMatchObject({ 1: 'done' });

    // Render cho bé B: chưa có gì.
    render(<ParentSpeakingChecklist childId={CHILD_B} />);
    expect(loadSpeakingMarks(CHILD_B)).toEqual({});
  });

  it('⚠️ bấm lại lựa chọn cũ ⇒ BỎ đánh dấu (về "chưa xác nhận")', () => {
    render(<ParentSpeakingChecklist childId={CHILD_A} />);
    const doneButton = screen.getAllByRole('button', { name: /Bé đã làm được/ })[0] as HTMLElement;
    const notYetButton = screen.getAllByRole('button', { name: /Mình ôn thêm nhé/ })[0] as HTMLElement;

    fireEvent.click(doneButton);
    expect(doneButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(doneButton); // bấm lại chính nó
    expect(doneButton).toHaveAttribute('aria-pressed', 'false');
    expect(loadSpeakingMarks(CHILD_A)).toEqual({});

    // Chuyển sang "ôn thêm" rồi lại "ôn thêm" ⇒ bỏ đánh dấu.
    fireEvent.click(notYetButton);
    expect(loadSpeakingMarks(CHILD_A)).toMatchObject({ 1: 'not-yet' });
    fireEvent.click(notYetButton);
    expect(loadSpeakingMarks(CHILD_A)).toEqual({});
  });

  it('⚠️ LUẬT TRẺ: không có từ phán xét nào trong màn hình', () => {
    const { container } = render(<ParentSpeakingChecklist childId={CHILD_A} />);
    const html = container.innerHTML.toLowerCase();
    for (const word of ['sai', 'kém', 'chưa đạt', 'thất bại', 'trượt']) {
      expect(html.includes(word)).toBe(false);
    }
  });
});
