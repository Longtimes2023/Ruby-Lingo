/**
 * RubyLingo — Hook truy cập nội dung học.
 *
 * Component KHÔNG gọi `contentRepository` trực tiếp mà đi qua các hook này, để:
 *   - mọi nơi dùng CÙNG một khoá cache,
 *   - sau này nội dung chuyển sang nạp qua mạng (Movers/Flyers tải lười) thì chỉ phải
 *     sửa file này, không phải sửa từng màn hình.
 *
 * ⚠️ VÌ SAO `initialData` ĐƯỢC TRUYỀN VÀO MỌI `useQuery` Ở ĐÂY:
 *    Nội dung nằm trong bundle (Vite nhúng JSON lúc build) nên đọc được NGAY, đồng bộ.
 *    Không truyền `initialData` thì TanStack Query sẽ trả `isPending: true` ở lần render
 *    đầu ⇒ mọi màn hình phải xử lý trạng thái "đang tải" cho dữ liệu vốn đã có sẵn, và
 *    bé sẽ thấy nháy màn hình chờ vô ích. `staleTime: Infinity` bảo đảm không bao giờ
 *    nạp lại vì nội dung là BẤT BIẾN trong suốt phiên.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { contentRepository } from '../services/ContentRepository.js';
import type { DistractorMode, GameRuntime } from '../services/ContentRepository.js';
import { detectGameRuntime } from '../services/SpeechCapability.js';
import { DEFAULT_LEVEL_ID } from '../data/index.js';
import type {
  Exercise,
  GlobalSceneAsset,
  Lesson,
  LevelBundle,
  ThemeBundle,
  ThemeMapItem,
  Word,
} from '@shared/types/content.js';

/** Nội dung là bất biến ⇒ không bao giờ coi là "cũ". */
const CONTENT_STALE_TIME = Number.POSITIVE_INFINITY;

/** Toàn bộ nội dung một level, đã lập chỉ mục. */
export function useLevel(levelId: string = DEFAULT_LEVEL_ID): LevelBundle {
  return useQuery({
    queryKey: ['content', 'level', levelId],
    queryFn: () => contentRepository.loadLevel(levelId),
    initialData: () => contentRepository.loadLevel(levelId),
    staleTime: CONTENT_STALE_TIME,
  }).data;
}

/** Thẻ chủ đề cho bản đồ hành trình, theo đúng thứ tự `level.themeIds`. */
export function useThemeMap(levelId: string = DEFAULT_LEVEL_ID): ThemeMapItem[] {
  return useQuery({
    queryKey: ['content', 'theme-map', levelId],
    queryFn: () => contentRepository.getThemesForMap(levelId),
    initialData: () => contentRepository.getThemesForMap(levelId),
    staleTime: CONTENT_STALE_TIME,
  }).data;
}

/** Gói nội dung một chủ đề. `null` khi id không tồn tại. */
export function useThemeBundle(themeId: string): ThemeBundle | null {
  return useQuery({
    queryKey: ['content', 'theme', themeId],
    queryFn: () => contentRepository.getThemeBundle(themeId),
    initialData: () => contentRepository.getThemeBundle(themeId),
    staleTime: CONTENT_STALE_TIME,
  }).data;
}

export function useLesson(lessonId: string): Lesson | null {
  return useQuery({
    queryKey: ['content', 'lesson', lessonId],
    queryFn: () => contentRepository.getLesson(lessonId),
    initialData: () => contentRepository.getLesson(lessonId),
    staleTime: CONTENT_STALE_TIME,
  }).data;
}

/** Từ của một bài, đúng thứ tự trong `lesson.wordIds`. */
export function useWordsForLesson(lessonId: string): Word[] {
  return useQuery({
    queryKey: ['content', 'lesson-words', lessonId],
    queryFn: () => contentRepository.getWordsForLesson(lessonId),
    initialData: () => contentRepository.getWordsForLesson(lessonId),
    staleTime: CONTENT_STALE_TIME,
  }).data;
}

/**
 * Một bài tập theo id — `GamePage` dùng để biết phải dựng game nào.
 *
 * ⚠️ KHÔNG lọc theo khả năng trình duyệt ở đây (khác `useExercisesForLesson`). Lý do: URL là
 *   thứ gõ được, nên `GamePage` phải TỰ kiểm tra `gameType` có chạy được không rồi hiện thông
 *   báo tử tế. Nếu hook này trả `null` cho game không hỗ trợ, màn hình sẽ nói "không tìm thấy
 *   bài tập" — sai sự thật, và bé/phụ huynh không hiểu vì sao.
 */
export function useExercise(exerciseId: string): Exercise | null {
  return useQuery({
    queryKey: ['content', 'exercise', exerciseId],
    queryFn: () => contentRepository.getExercise(exerciseId),
    initialData: () => contentRepository.getExercise(exerciseId),
    staleTime: CONTENT_STALE_TIME,
  }).data;
}

/** Nhiều từ theo danh sách id, giữ đúng thứ tự truyền vào. Bỏ qua id không tìm thấy. */
export function useWordsByIds(wordIds: readonly string[]): Word[] {
  const level = useLevel();
  return useMemo(() => {
    const out: Word[] = [];
    for (const id of wordIds) {
      const word = level.wordById.get(id);
      if (word) out.push(word);
    }
    return out;
  }, [wordIds, level]);
}

/**
 * Khả năng trình duyệt — dò MỘT LẦN cho cả phiên.
 * Không phụ thuộc dữ liệu nên không cần TanStack Query.
 */
export function useGameRuntime(): GameRuntime {
  return useMemo(() => detectGameRuntime(), []);
}

/** Bài tập của một bài, đã lọc theo khả năng trình duyệt (ẩn `say_it` trên Safari/iOS). */
export function useExercisesForLesson(lessonId: string, runtime?: GameRuntime): Exercise[] {
  const detected = useGameRuntime();
  const effective = runtime ?? detected;
  return useQuery({
    queryKey: ['content', 'lesson-exercises', lessonId, effective.hasSpeechRecognition],
    queryFn: () => contentRepository.getExercisesForLesson(lessonId, effective),
    initialData: () => contentRepository.getExercisesForLesson(lessonId, effective),
    staleTime: CONTENT_STALE_TIME,
  }).data;
}

/** Tranh cảnh toàn cục (VD: `homeSceneImage` cho màn hình M6). */
export function useGlobalScene(key: string): GlobalSceneAsset | null {
  return useQuery({
    queryKey: ['content', 'global-scene', key],
    queryFn: () => contentRepository.getGlobalScene(key),
    initialData: () => contentRepository.getGlobalScene(key),
    staleTime: CONTENT_STALE_TIME,
  }).data;
}

/**
 * Chọn từ gây nhiễu cho game dạng hình.
 *
 * `seed` nên đổi theo từng câu hỏi để các câu không dùng lại cùng bộ nhiễu, nhưng phải
 * ỔN ĐỊNH trong một câu — nếu không, mỗi lần React render lại là các ô đổi chỗ và bé
 * bấm nhầm. Xem `src/lib/random.ts`.
 */
export function useDistractors(
  wordId: string,
  count: number,
  mode: DistractorMode,
  seed?: number | string,
): Word[] {
  return useMemo(
    () => contentRepository.pickDistractors(wordId, count, mode, seed),
    [wordId, count, mode, seed],
  );
}
