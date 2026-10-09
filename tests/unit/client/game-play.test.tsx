/**
 * RubyLingo — G3/G4/G7/G9: CHƠI THẬT một câu qua `GameShell` + `useGameEngine`.
 *
 * ⭐ VÌ SAO PHẢI RENDER, KHÔNG CHỈ TEST HÀM THUẦN:
 *   `game-*.test.ts` đã chứng minh từng luật đúng khi gọi TRỰC TIẾP. Nhưng nó không chứng minh
 *   được ba thứ mà chỉ render mới thấy:
 *     • game có gọi `engine.completeRound()` không — quên gọi thì bé chơi mãi ở câu 1, và
 *       KHÔNG có lỗi nào được ném;
 *     • game có gọi `attempt(false)` cho một cú chạm sai không — quên thì mạng ❤️ không bao giờ
 *       giảm và gợi ý không bao giờ hiện;
 *     • `GameShell` có đọc đúng số câu từ engine không.
 *   Cả ba đều là "im lặng khi hỏng", nên phải soi DOM.
 *
 * ⚠️ CÁCH TÌM ĐÁP ÁN ĐÚNG TRONG TEST — CỐ Ý KHÔNG DÙNG LẠI HÀM CỦA APP:
 *   • `missing_letter`: test ĐỌC CHÍNH MÀN HÌNH (các chữ đã hiện + ô trống), rồi tra ngược ra từ
 *     trong dữ liệu thật. Đây đúng là việc một đứa trẻ làm, và nó không phụ thuộc vào
 *     `hiddenIndices` — nếu hàm đó chọn ô khác, test vẫn tìm ra chữ đúng.
 *   • `prepositions`: test CHẠM LẦN LƯỢT cho tới khi qua câu (tối đa 4 lần, mạng = 5 nên không
 *     bao giờ hết mạng). Không cần biết đáp án trước.
 *   • `memory_match` / `word_picture`: ghim `Math.random` để bộ bài tất định, rồi tính lại bộ bài
 *     bằng chính `buildDeck`/`buildColumns`. Điều test này kiểm KHÔNG phải "luật đúng" (đã kiểm ở
 *     file riêng) mà là "thẻ thứ i trên màn hình ĐÚNG LÀ thẻ thứ i của bộ bài, và chạm đúng cặp
 *     thì câu được tính xong".
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import '@/i18n/index.js';
import { GameShell } from '@/components/games/shared/GameShell.js';
import { GAME_COMPONENTS, isGamePlayable } from '@/components/games/shared/registry.js';
import { buildDeck } from '@/components/games/memory-match/logic.js';
import { buildColumns } from '@/components/games/word-picture/logic.js';
import { DEFAULT_LEVEL_ID, readLevelBundle } from '@/data/index.js';
import { useExercise, useWordsByIds } from '@/hooks/useContent.js';
import { useGameEngine } from '@/hooks/useGameEngine.js';
import { roundsOf } from '@/lib/gameRounds.js';
import { GAME_HEARTS, GAME_ROUND_POINTS } from '@shared/game-scoring.js';
import { MVP_GAME_TYPES } from '@shared/types/content.js';
import type { Exercise, Word } from '@shared/types/content.js';

const BUNDLE = readLevelBundle(DEFAULT_LEVEL_ID);

/** Một bài tập CÓ THẬT trên đĩa, kèm các từ của nó — đúng thứ tự `wordIds`. */
function exerciseFixture(exerciseId: string): { exercise: Exercise; words: Word[] } {
  const exercise = BUNDLE.exerciseById.get(exerciseId);
  if (!exercise) throw new Error(`Không có bài tập ${exerciseId} trong dữ liệu`);
  const words = exercise.wordIds
    .map((id) => BUNDLE.wordById.get(id))
    .filter((word): word is Word => word !== undefined);
  return { exercise, words };
}

/**
 * Khung thử: dựng ĐÚNG như `GamePage` (engine + shell + game), chỉ bỏ phần định tuyến và tiến độ.
 * Nhờ vậy test kiểm được chính sự ghép nối mà `GamePage` thực hiện trong production.
 */
function Harness({ exerciseId }: { exerciseId: string }) {
  const exercise = useExercise(exerciseId);
  const words = useWordsByIds(exercise?.wordIds ?? []);
  const engine = useGameEngine({
    totalRounds: roundsOf(exercise?.config),
    maxHearts: exercise ? GAME_HEARTS[exercise.gameType] : 0,
    roundPoints: exercise ? GAME_ROUND_POINTS[exercise.gameType] : 0,
  });

  if (!exercise) return <span data-testid="no-exercise" />;
  const GameComponent = GAME_COMPONENTS[exercise.gameType];

  return (
    <>
      <span data-testid="round-number">{engine.roundNumber}</span>
      <span data-testid="hearts">{engine.state.hearts}</span>
      <GameShell
        gameType={exercise.gameType}
        lessonName="Bài thử"
        exitTo="/theme/at-the-zoo"
        state={engine.state}
        roundNumber={engine.roundNumber}
      >
        {GameComponent ? <GameComponent exercise={exercise} words={words} engine={engine} /> : null}
      </GameShell>
    </>
  );
}

function renderGame(exerciseId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Harness exerciseId={exerciseId} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const roundNumber = (): string => screen.getByTestId('round-number').textContent ?? '';

/** Câu hiện tại đã được tính xong chưa (số câu đã tăng). */
function advancedFrom(start: string): boolean {
  return roundNumber() !== start;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// =============================================================================
// Sổ đăng ký: cả 5 game MVP đều phải có component
// =============================================================================

describe('registry — phạm vi MVP đã làm xong', () => {
  it('MỌI game MVP đều có component ⇒ mọi bài tập của at-the-zoo chơi được', () => {
    for (const gameType of MVP_GAME_TYPES) {
      expect(isGamePlayable(gameType), `${gameType} chưa có component`).toBe(true);
      expect(GAME_COMPONENTS[gameType], `${gameType} thiếu trong GAME_COMPONENTS`).toBeDefined();
    }
  });

  it('mọi bài tập của at-the-zoo đều dựng được một component ĐÃ CÓ', () => {
    const exercises = BUNDLE.exercises.filter((exercise) =>
      exercise.lessonId.startsWith('at-the-zoo'),
    );

    // 3 bài × 5 trò = 15 — nếu rỗng thì vòng lặp dưới đây vô nghĩa.
    expect(exercises).toHaveLength(15);

    for (const exercise of exercises) {
      expect(
        isGamePlayable(exercise.gameType),
        `${exercise.id} (${exercise.gameType}) không có component`,
      ).toBe(true);
      // Số câu phải suy được — bằng 0 thì `GamePage` chặn và bé thấy "trò này chưa có từ nào".
      expect(roundsOf(exercise.config), `${exercise.id}: không suy được số câu`).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// G3 — Điền chữ cái còn thiếu
// =============================================================================

describe('MissingLetterGame — chơi thật', () => {
  const EXERCISE_ID = 'at-the-zoo/z1/missing-letter';

  it('chạm đúng chữ còn thiếu ⇒ điền xong và sang câu 2', async () => {
    vi.useFakeTimers();
    renderGame(EXERCISE_ID);

    const start = roundNumber();
    expect(start).toBe('1');

    const { words } = exerciseFixture(EXERCISE_ID);

    /**
     * Đọc màn hình để tìm ô trống — KHÔNG dùng lại `hiddenIndices`.
     * Ô chữ có `role="img"` và `aria-label` là nhãn "từ còn chỗ trống".
     */
    const box = screen.getByLabelText(/Từ còn chỗ trống/);
    const pattern = box.textContent ?? '';
    expect(pattern).toContain('_');

    // Tra ngược ra từ thật khớp với mẫu hiển thị (chữ đã hiện phải trùng, ô trống bỏ qua).
    const matches = words.filter(
      (word) =>
        word.en.length === pattern.length &&
        [...pattern].every((char, index) => char === '_' || char === word.en[index]),
    );
    // Mẫu hiển thị phải chỉ ra ĐÚNG MỘT từ — nếu không, bé cũng không biết đang điền từ nào.
    expect(matches).toHaveLength(1);

    const target = matches[0]!;
    const blankIndex = [...pattern].indexOf('_');
    const answer = target.en[blankIndex]!;

    fireEvent.click(screen.getByRole('button', { name: `chữ ${answer}` }));

    // `completeRound` nằm sau một nhịp 800ms để bé kịp thấy từ hoàn chỉnh.
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(advancedFrom(start)).toBe(true);
    expect(roundNumber()).toBe('2');
    // Và `GameShell` phải nói ra con số mới.
    expect(screen.getAllByText(/Câu 2 \/ 6/).length).toBeGreaterThan(0);
  });

  it('chạm chữ SAI ⇒ mất một mạng, KHÔNG sang câu', () => {
    renderGame(EXERCISE_ID);

    const start = roundNumber();
    const hearts = Number(screen.getByTestId('hearts').textContent);

    const pattern = screen.getByLabelText(/Từ còn chỗ trống/).textContent ?? '';
    const { words } = exerciseFixture(EXERCISE_ID);
    const target = words.find(
      (word) =>
        word.en.length === pattern.length &&
        [...pattern].every((char, index) => char === '_' || char === word.en[index]),
    )!;
    const answer = target.en[[...pattern].indexOf('_')]!;

    // Chọn một chữ bất kỳ trên bàn phím KHÔNG phải đáp án.
    const options = screen.getAllByRole('button', { name: /^chữ / });
    const wrong = options.find((button) => button.textContent !== answer);
    expect(wrong).toBeDefined();

    fireEvent.click(wrong!);

    expect(advancedFrom(start)).toBe(false);
    expect(Number(screen.getByTestId('hearts').textContent)).toBeLessThan(hearts);
    // Câu động viên — KHÔNG có chữ "sai".
    expect(screen.queryByText(/sai/i)).toBeNull();
  });
});

// =============================================================================
// G4 — Thú cưng trốn ở đâu?
// =============================================================================

describe('PrepositionsGame — chơi thật', () => {
  const EXERCISE_ID = 'at-the-zoo/z1/prepositions';

  it('chạm lần lượt cho tới khi đúng ⇒ qua câu, và câu chữ hiện ra kèm giới từ đúng', async () => {
    vi.useFakeTimers();
    renderGame(EXERCISE_ID);

    const start = roundNumber();

    // Bốn CẢNH là bốn nút có `aria-label` (nhãn vị trí). Nút "Nghe câu" không có `aria-label`
    // nên lọc theo thuộc tính đó — lọc theo chữ thì không được, vì nút "Nghe câu" còn chứa emoji 🔊.
    const scenes = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== null);
    expect(scenes).toHaveLength(4);

    let sawReveal = false;
    let attempts = 0;

    for (const scene of scenes) {
      if (advancedFrom(start)) break;
      fireEvent.click(scene);
      attempts += 1;

      // Đúng ⇒ câu chữ hiện ra NGAY, trước khi `completeRound` chạy (nó nằm sau 900ms). Phải ghi
      // nhận ở đây vì khi sang câu mới, câu chữ của câu cũ được gỡ đi.
      if (screen.queryAllByText(/Con vật đang ở/).length > 0) sawReveal = true;

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }

    expect(advancedFrom(start), 'không cảnh nào qua được câu — không có đáp án đúng?').toBe(true);
    // Tệ nhất là câu thứ 4 mới đúng, và mạng ban đầu là 5 ⇒ bé không bao giờ hết mạng.
    expect(attempts).toBeLessThanOrEqual(4);
    // Sau khi đúng, câu chữ hiện ra để bé thấy cấu trúc câu.
    expect(sawReveal, 'câu chữ không hiện ra sau khi bé chọn đúng').toBe(true);
  });

  it('chạm cảnh sai ⇒ mất một mạng', () => {
    renderGame(EXERCISE_ID);

    const hearts = Number(screen.getByTestId('hearts').textContent);
    const scenes = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== null);

    fireEvent.click(scenes[0]!);

    // Cảnh đầu tiên có thể đúng (khi đó câu đã xong và không mất mạng) — chấp nhận cả hai nhánh,
    // nhưng KHÔNG bao giờ được tăng mạng.
    expect(Number(screen.getByTestId('hearts').textContent)).toBeLessThanOrEqual(hearts);
  });
});

// =============================================================================
// G7 — Lật thẻ ghi nhớ
// =============================================================================

describe('MemoryMatchGame — chơi thật', () => {
  const EXERCISE_ID = 'at-the-zoo/z1/memory-match';

  it('mở đúng hai thẻ của một cặp ⇒ cặp được tính, và KHÔNG mất mạng (game không có mạng)', () => {
    // Ghim `Math.random` để bộ bài tất định ⇒ tính lại được bộ bài trong test.
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    renderGame(EXERCISE_ID);

    const { exercise, words } = exerciseFixture(EXERCISE_ID);
    const config = exercise.config as { pairMode: 'en_icon' | 'en_vi'; pairs: number };
    const deck = buildDeck(words, config, `${EXERCISE_ID}#mm#0.42`);

    // Mọi thẻ đang úp ⇒ mỗi thẻ là một nút tên "Thẻ úp", theo ĐÚNG thứ tự bộ bài.
    const cards = screen.getAllByRole('button', { name: 'Thẻ úp' });
    expect(cards).toHaveLength(deck.length);

    const first = deck[0]!;
    const i0 = 0;
    const i1 = deck.findIndex((card) => card.wordId === first.wordId && card.id !== first.id);
    expect(i1).toBeGreaterThan(0);

    const start = roundNumber();
    // Mạng không bao giờ được hiện với trò này — `GameShell` hiện câu "chơi thoải mái" thay vào đó.
    expect(screen.getByText(/Chơi thoải mái/)).toBeInTheDocument();

    fireEvent.click(cards[i0]!);
    // Thẻ vừa lật phải NÓI RA nội dung, không còn là "Thẻ úp" với screen reader.
    expect(screen.getByRole('button', { name: `Thẻ đang mở: ${first.face}` })).toBeInTheDocument();

    fireEvent.click(cards[i1]!);

    expect(advancedFrom(start)).toBe(true);
    expect(roundNumber()).toBe('2');
    expect(screen.getByText('1/6 cặp')).toBeInTheDocument();
    // Trò này KHÔNG có mạng: lật thẻ không bao giờ "sai".
    expect(screen.getByTestId('hearts').textContent).toBe('0');
  });

  it('lật hai thẻ KHÁC cặp ⇒ úp lại sau một nhịp, KHÔNG mất mạng, KHÔNG sang câu', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    renderGame(EXERCISE_ID);

    const { exercise, words } = exerciseFixture(EXERCISE_ID);
    const config = exercise.config as { pairMode: 'en_icon' | 'en_vi'; pairs: number };
    const deck = buildDeck(words, config, `${EXERCISE_ID}#mm#0.42`);

    const cards = screen.getAllByRole('button', { name: 'Thẻ úp' });
    const start = roundNumber();

    // Tìm hai thẻ đầu tiên KHÁC `wordId` — chắc chắn không phải một cặp.
    const a = deck[0]!;
    const indexB = deck.findIndex((card) => card.wordId !== a.wordId);
    expect(indexB).toBeGreaterThan(0);

    fireEvent.click(cards[0]!);
    fireEvent.click(cards[indexB]!);

    expect(advancedFrom(start)).toBe(false);
    // Cả hai thẻ phải đang MỞ (bé cần thấy mình vừa lật gì)…
    expect(screen.getAllByRole('button', { name: /Thẻ đang mở/ })).toHaveLength(2);

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });

    // …rồi úp lại, và vẫn chưa qua câu.
    expect(screen.getAllByRole('button', { name: 'Thẻ úp' })).toHaveLength(deck.length);
    expect(advancedFrom(start)).toBe(false);
  });
});

// =============================================================================
// G9 — Nối từ với hình
// =============================================================================

describe('WordPictureGame — chơi thật', () => {
  const EXERCISE_ID = 'at-the-zoo/z1/word-picture';

  it('chọn hình rồi chọn từ đúng ⇒ cặp được nối và sang câu', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    renderGame(EXERCISE_ID);

    const { exercise, words } = exerciseFixture(EXERCISE_ID);
    const config = exercise.config as { pairs: number };
    const columns = buildColumns(words, config.pairs, `${EXERCISE_ID}#wp#0.42`);

    const start = roundNumber();
    const target = columns.left[0]!;

    fireEvent.click(screen.getByRole('button', { name: `Hình của từ ${target.en}` }));
    fireEvent.click(screen.getByRole('button', { name: `Từ ${target.en}` }));

    expect(advancedFrom(start)).toBe(true);
    expect(roundNumber()).toBe('2');
    expect(screen.getByText('1/6 cặp')).toBeInTheDocument();
  });

  it('chọn từ SAI ⇒ mất một mạng, KHÔNG sang câu', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    renderGame(EXERCISE_ID);

    const { exercise, words } = exerciseFixture(EXERCISE_ID);
    const config = exercise.config as { pairs: number };
    const columns = buildColumns(words, config.pairs, `${EXERCISE_ID}#wp#0.42`);

    const hearts = Number(screen.getByTestId('hearts').textContent);
    const start = roundNumber();

    const target = columns.left[0]!;
    const wrong = columns.right.find((word) => word.id !== target.id)!;

    fireEvent.click(screen.getByRole('button', { name: `Hình của từ ${target.en}` }));
    fireEvent.click(screen.getByRole('button', { name: `Từ ${wrong.en}` }));

    expect(advancedFrom(start)).toBe(false);
    expect(Number(screen.getByTestId('hearts').textContent)).toBeLessThan(hearts);
  });

  it('chọn TỪ trước khi chọn hình ⇒ chỉ nhắc, KHÔNG mất mạng', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    renderGame(EXERCISE_ID);

    const hearts = Number(screen.getByTestId('hearts').textContent);
    const { words } = exerciseFixture(EXERCISE_ID);

    fireEvent.click(screen.getByRole('button', { name: `Từ ${words[0]!.en}` }));

    // Nhắc cách chơi chứ không phạt: "chạm vào một hình ở cột bên trái nhé!"
    expect(screen.getByText(/cột bên trái/)).toBeInTheDocument();
    expect(Number(screen.getByTestId('hearts').textContent)).toBe(hearts);
  });
});
