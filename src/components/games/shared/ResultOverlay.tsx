/**
 * RubyLingo — `ResultOverlay`: màn hình kết quả sau một lượt chơi.
 *
 * ⭐⭐ ĐÂY LÀ MÀN HÌNH QUAN TRỌNG NHẤT VỀ MẶT CẢM XÚC CỦA CẢ ỨNG DỤNG.
 *   Nó là thứ bé nhìn thấy sau khi vừa cố gắng. Mọi quyết định ở đây đều phải trả lời được
 *   câu hỏi: *"một đứa trẻ 7 tuổi vừa làm sai 6 câu sẽ cảm thấy gì khi đọc cái này?"*
 *
 * ⚠️⚠️ BỐN ĐIỀU TUYỆT ĐỐI KHÔNG ĐƯỢC CÓ Ở ĐÂY:
 *
 *   1. **KHÔNG CÓ SỐ CÂU SAI.** Chỉ hiện số câu ĐÚNG. "Bé làm đúng 4 câu" và "bé sai 6 câu"
 *      là cùng một thông tin, nhưng một câu khen và một câu phán xét. Nếu sau này ai cần con
 *      số lỗi để phân tích, nó nằm ở khu vực PHỤ HUYNH (Nhóm 10), không nằm ở đây.
 *   2. **KHÔNG CÓ CHỮ "THUA"/"THẤT BẠI"/"CHƯA ĐẠT".** Hết mạng ❤️ chỉ đổi CÂU KHEN, không đổi
 *      bản chất: bé vẫn nhận sao, vẫn thấy pháo hoa.
 *   3. **KHÔNG BAO GIỜ 0 SAO.** `StarRating` của `shared/game-scoring.ts` không có giá trị 0 —
 *      ràng buộc này được cài vào KIỂU DỮ LIỆU, nên không thể lỡ tay vi phạm.
 *   4. **KHÔNG SO SÁNH VỚI AI KHÁC.** "Kỷ lục của bé" là so với CHÍNH BÉ hôm trước.
 *
 * ⭐ VÌ SAO BA SAO LUÔN HIỆN ĐỦ BA Ô (sao chưa đạt là ô mờ):
 *   Bé thấy ngay "còn hai sao nữa để lấy" — đó là lời mời chơi lại, không phải lời phê bình.
 *   Nếu chỉ hiện đúng số sao đã đạt, bé không biết mình còn gì để phấn đấu.
 *
 * ⚠️ `role="dialog"` + `aria-modal` KHÔNG kèm bẫy tiêu điểm (focus trap) tự viết:
 *   Overlay này không có gì để đóng ngoài hai nút hành động, và cả hai đều nằm trong nó. Tự
 *   viết focus trap ở đây chỉ thêm chỗ để sai; Radix `Dialog` thì quá nặng cho một màn hình
 *   không bao giờ bị đóng bằng Esc (bé 7 tuổi không dùng Esc).
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { GameRunResult } from '@shared/game-scoring.js';
import type { GameResultAward } from '@shared/types/progress.js';

import { cn } from '../../../lib/cn.js';
import { BigButton } from '../../common/BigButton.js';
import { StarBurst } from '../../effects/StarBurst.js';

/**
 * Ba khoá i18n của khối phần thưởng.
 *
 * Khai thành union chuỗi chứ KHÔNG ghép chuỗi ở chỗ gọi: một khoá ghép sai (ví dụ `game.rewardXP`
 * thay vì `game.rewardXp`) không gây lỗi nào — i18next trả về chính chuỗi khoá, và bé sẽ đọc thấy
 * "game.rewardXP" trên màn hình. Union này biến nó thành lỗi biên dịch.
 */
type RewardLabelKey = 'game.rewardStars' | 'game.rewardAcorns' | 'game.rewardXp';

/**
 * Một khoản thưởng để vẽ: icon, số lượng, và khoá i18n mô tả nó.
 *
 * ⚠️ Tách khỏi chỗ `filter` (hai bước, không viết `[...].filter(...)` một hơi): `.filter()` chặn
 *    suy kiểu theo ngữ cảnh, làm `labelKey` nới thành `string` và mất luôn tác dụng của union ở
 *    trên. Gán vào một biến có kiểu trước rồi mới lọc thì giữ được.
 */
interface RewardRow {
  icon: string;
  amount: number;
  labelKey: RewardLabelKey;
}

export interface ResultOverlayProps {
  result: GameRunResult;
  /** Tên bài học — bé thấy mình vừa học xong phần nào. */
  lessonName: string;
  /**
   * Kỷ lục điểm của bé ở bài này theo HIỂU BIẾT TRONG MÁY, hoặc `null` nếu chưa biết.
   *
   * ⚠️ Chỉ dùng làm phương án dự phòng khi CHƯA có phản hồi từ server (`serverAward` rỗng).
   *    Xem ghi chú ở `serverAward` để hiểu vì sao con số này KHÔNG đáng tin ngay sau một lượt
   *    chơi vừa kết thúc.
   */
  previousBestScore: number | null;
  /** Số sao cao nhất bé từng đạt ở bài này theo hiểu biết trong máy. */
  previousBestStars: 0 | 1 | 2 | 3;
  /**
   * Phần thưởng SERVER chấm cho lượt chơi này. `null`/`undefined` = CHƯA BIẾT (lượt chơi còn
   * nằm trong hàng đợi vì mất mạng) — KHÁC HẲN "không có thưởng".
   *
   * ⭐ VÌ SAO PHẢI LÀ SERVER, KHÔNG TỰ TÍNH Ở ĐÂY:
   *   Điểm và sao mà bé thấy bên trên do engine chấm ngay ở máy để hiện TỨC THÌ. Nhưng số ⭐/🌰/XP
   *   cộng vào ví thì chỉ server biết — ví là CỘNG DỒN và chỉ server được cộng. Tự cộng ở đây sẽ
   *   tạo ra một con số thứ hai, lệch dần với ví thật mà không có gì đối chiếu.
   *
   * ⭐ VÀ VÌ SAO KỶ LỤC CŨNG LẤY TỪ ĐÂY:
   *   Kỷ lục bài học là việc của server (`LessonProgress.bestScore`, không bao giờ giảm). Bản
   *   trong máy chỉ được cập nhật khi có lần ĐỒNG BỘ với server, mà một lượt chơi vừa xong thì
   *   không tạo ra lần đồng bộ nào. Nên ngay sau lượt thứ hai, `previousBestScore` vẫn là kỷ lục
   *   của lượt thứ nhất — dùng nó để so kỷ lục là so với số cũ. Khi award đã về, `isNewRecord`
   *   và `bestScore` của server là sự thật cuối cùng.
   */
  serverAward?: GameResultAward | null;
  onPlayAgain: () => void;
  /** Đường về khi bé bấm "Về bài học". */
  exitTo: string;
}

export function ResultOverlay({
  result,
  lessonName,
  previousBestScore,
  previousBestStars,
  serverAward,
  onPlayAgain,
  exitTo,
}: ResultOverlayProps) {
  const { t } = useTranslation();

  /**
   * Phá kỷ lục ĐIỂM hoặc kỷ lục SAO đều tính là kỷ lục mới.
   *
   * ⚠️ Phải xét CẢ HAI: một bé đạt 3 sao với điểm thấp hơn lần trước (vì lần trước có chuỗi
   *   dài hơn) vẫn đang tiến bộ ở thứ quan trọng hơn. Chỉ xét điểm sẽ bỏ sót đúng cái đó.
   *
   * ⚠️ Khi server đã trả lời thì LẤY THẲNG `isNewRecord` CỦA SERVER, không tự so lại. Tự so
   *   với `previousBestScore` (số cũ trong máy) sẽ nói "kỷ lục mới" ở lượt thứ hai của cùng
   *   một bé — một lời khen SAI, và bé thì nhớ chính xác lần trước mình được mấy điểm.
   */
  const isNewRecord = serverAward
    ? serverAward.isNewRecord
    : previousBestScore === null ||
      result.score > previousBestScore ||
      result.stars > previousBestStars;

  /**
   * Điểm kỷ lục TRƯỚC lượt này — để vẽ dòng "Kỷ lục trước".
   *
   * ⚠️ Khi award đã về VÀ lượt này KHÔNG phá kỷ lục thì `serverAward.bestScore` CHÍNH LÀ kỷ lục
   *   cũ: `bestScore` giữ `Math.max` và lượt này không vượt được nó. Còn khi CÓ phá kỷ lục thì
   *   dòng này không được vẽ, nên giá trị không quan trọng — trả `null` cho rõ ý.
   */
  const bestBefore = serverAward
    ? serverAward.isNewRecord
      ? null
      : serverAward.bestScore
    : previousBestScore;

  /**
   * Các khoản bé THỰC SỰ nhận được ở lượt này.
   *
   * ⚠️ CHỈ hiện khoản LỚN HƠN 0. Hiện "⭐ +0" là kể cho bé nghe về thứ bé KHÔNG có — trong khi
   *    điều bé cần thấy là mình đã chơi xong. Và khi server báo `duplicate` (lượt này đã được ghi
   *    từ trước), mọi khoản đều bằng 0 nên màn hình tự nhiên không có khối thưởng nào.
   *
   * ⚠️ `starsGained`/`acornsGained` ĐÃ GỘP cả quà lên cấp. Đó là con số ĐÚNG để hiện: nó khớp
   *    với mức tăng của ví trên thanh trên cùng. Xem ghi chú ở `GameResultAward`.
   */
  const earned: RewardRow[] = serverAward
    ? [
        { icon: '⭐', amount: serverAward.starsGained, labelKey: 'game.rewardStars' },
        { icon: '🌰', amount: serverAward.acornsGained, labelKey: 'game.rewardAcorns' },
        { icon: '✨', amount: serverAward.xpGained, labelKey: 'game.rewardXp' },
      ]
    : [];
  const rewards = earned.filter((reward) => reward.amount > 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-title"
      className={cn(
        'relative mx-auto flex w-full max-w-[520px] flex-col items-center gap-4',
        'rounded-kid border-4 border-star bg-surface p-6 text-center shadow-pop',
      )}
    >
      {/* Pháo hoa luôn chạy — kể cả khi bé chỉ được 1 sao. Hoàn thành là đáng ăn mừng. */}
      <StarBurst burstKey={`result-${result.stars}`} count={result.stars * 6} />

      <span aria-hidden="true" className="text-[72px] leading-none">
        {result.stars === 3 ? '🏆' : result.stars === 2 ? '🎉' : '🌟'}
      </span>

      {/* --- Ba ô sao ------------------------------------------------------ */}
      <div
        className="flex items-center gap-2"
        aria-label={t('game.starsEarned', { count: result.stars })}
      >
        {[1, 2, 3].map((slot) => (
          <span
            key={slot}
            aria-hidden="true"
            className={cn(
              'text-[44px] leading-none transition-transform duration-kid',
              slot <= result.stars ? 'scale-100' : 'scale-90 opacity-25 grayscale',
            )}
          >
            ⭐
          </span>
        ))}
      </div>

      {/*
        ⚠️ CÂU KHEN PHỤ THUỘC SỐ SAO, KHÔNG PHỤ THUỘC `completed`.
          Bé hết mạng mà vẫn đúng 4/4 câu đã đi qua thì được 3 sao và được khen như 3 sao.
          Chỉ khi hết mạng VÀ ít sao thì mới dùng câu động viên riêng.
      */}
      <h2 id="result-title" className="text-kid-xl leading-tight text-brand">
        {result.stars === 3
          ? t('game.praiseThree')
          : result.stars === 2
            ? t('game.praiseTwo')
            : t('game.praiseOne')}
      </h2>

      {/*
        ⭐ CHỈ NÓI SỐ CÂU ĐÚNG. Không có chỗ nào trên màn hình này nói số câu sai.
      */}
      <p className="text-kid-sm text-ink-soft">
        {t('game.correctCount', { count: result.correctFirstTry, total: result.answered })}
      </p>

      <p className="text-kid-xs text-ink-faint">{lessonName}</p>

      {/* --- Điểm + kỷ lục ------------------------------------------------- */}
      <div className="flex w-full flex-col gap-2 rounded-kid bg-surface-raised p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-kid-xs text-ink-soft">{t('game.scoreLabel')}</span>
          <span className="text-kid-lg font-bold tabular-nums text-ink">{result.score}</span>
        </div>

        {/* Thưởng chuỗi chỉ hiện khi CÓ — hiện "+0" là nhắc bé rằng nó không có gì. */}
        {result.streakBonus > 0 && (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-kid-xs text-ink-soft">
              🔥 {t('game.streakBonusLabel', { count: result.longestStreak })}
            </span>
            <span className="text-kid-sm font-bold tabular-nums text-warn">
              +{result.streakBonus}
            </span>
          </div>
        )}

        {isNewRecord ? (
          <p className="mt-1 rounded-kid bg-star-soft px-3 py-2 text-kid-sm font-bold text-ink">
            🎊 {t('game.newRecord')}
          </p>
        ) : (
          bestBefore !== null && (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-kid-xs text-ink-faint">{t('game.bestLabel')}</span>
              <span className="text-kid-sm tabular-nums text-ink-faint">{bestBefore}</span>
            </div>
          )
        )}
      </div>

      {/*
        --- Phần thưởng server trả về ---------------------------------------
        Không có khối này khi: lượt chơi chưa tới được server (mất mạng), hoặc lượt này đã được
        ghi từ trước (`duplicate` ⇒ mọi khoản bằng 0). Cả hai đều KHÔNG phải lỗi.

        Đặt SAU khối điểm và TRƯỚC hai nút: bé đọc theo thứ tự "mình làm được gì" → "mình nhận
        được gì" → "giờ làm gì tiếp".
      */}
      {rewards.length > 0 && (
        <div className="flex w-full flex-col items-center gap-2 rounded-kid border-2 border-star bg-star-soft p-3">
          <span className="text-kid-xs font-bold text-ink-soft">{t('game.rewardsTitle')}</span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {rewards.map((reward) => (
              <span
                key={reward.labelKey}
                /*
                  ⚠️ Nhãn đọc đầy đủ nằm ở `aria-label`; phần nhìn chỉ là icon + số. Nếu để
                  trình đọc màn hình đọc "ngôi sao cộng năm" thì bé khiếm thị không biết đó là
                  SAO hay HẠT DẺ hay ĐIỂM KINH NGHIỆM.
                */
                aria-label={t(reward.labelKey, { count: reward.amount })}
                className="flex items-center gap-1.5 rounded-kid bg-surface px-3 py-1.5"
              >
                <span aria-hidden="true" className="text-[24px] leading-none">
                  {reward.icon}
                </span>
                <span aria-hidden="true" className="text-kid-sm font-bold tabular-nums text-ink">
                  +{reward.amount}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* --- Hai hành động ------------------------------------------------- */}
      <div className="mt-1 flex w-full flex-col gap-3">
        <BigButton variant="primary" icon="🔄" onClick={onPlayAgain}>
          {t('kid.playAgain')}
        </BigButton>

        <Link
          to={exitTo}
          className={cn(
            'inline-flex min-h-touch w-full items-center justify-center gap-3 rounded-kid',
            'border-2 border-line bg-surface px-6 text-kid-md font-bold text-ink-soft',
            'select-none',
          )}
        >
          {t('game.backToLesson')}
        </Link>
      </div>
    </div>
  );
}
