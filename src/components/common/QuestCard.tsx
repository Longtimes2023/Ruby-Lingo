/**
 * RubyLingo — `QuestCard`: MỘT nhiệm vụ trên màn Nhiệm vụ (M9).
 *
 * ⭐ ĐÚNG BỐN THỨ TRÊN THẺ — VÀ CỐ Ý KHÔNG THÊM GÌ: icon · mô tả · thanh tiến độ · nút
 *   "Nhận thưởng". Đây là đặc tả `GAME-REWARD-DESIGN.md` §6.5.
 *
 * ⭐ VÌ SAO **KHÔNG** LIỆT KÊ PHẦN THƯỞNG TRÊN THẺ (`10 ⭐ · 20 XP`):
 *   Không phải để cho gọn. Cả trải nghiệm nhận quà của màn này được thiết kế quanh một **túi quà
 *   bí mật**: §6.5 ghi rõ *"khi bấm: animation mở túi quà 🎁 → sao/hạt dẻ bay vào quầy → linh vật
 *   nhảy mừng"*. In sẵn danh sách quà lên thẻ là mở túi quà TRƯỚC khi bé bấm, và phần bất ngờ —
 *   thứ duy nhất khiến khoảnh khắc đó đáng nhớ — biến mất. Quà được NÓI RA ở `RewardBurst`, đúng
 *   lúc bé tự tay mở. (Ngoài ra: 10 nhiệm vụ × 2–3 khoản quà = 25 viên chip trang trí chen giữa
 *   nội dung, biến bảng nhiệm vụ thành một bảng giá.)
 *
 * ⚠️⚠️ NÚT "NHẬN THƯỞNG" LÀ CẢ CƠ CHẾ CẢM XÚC CỦA MÀN NÀY — ĐỌC TRƯỚC KHI "TỰ ĐỘNG HOÁ":
 *   §6.5: *"Nút 'Nhận thưởng' chỉ sáng lên khi nhiệm vụ xong → bé phải tự bấm ⇒ cảm giác phần
 *   thưởng thuộc về bé, không tự động."* Nghĩa là:
 *     • Chưa xong ⇒ nút **MỜ** (khoá), nhưng vẫn **TRUNG TÍNH**: nền/viền thường, KHÔNG tô đỏ,
 *       KHÔNG dấu ✗, KHÔNG chữ nào mang tính trách móc. Cùng luật "chưa xong hiển thị trung tính".
 *     • Xong ⇒ nút **SÁNG** (`success`) — đây là thứ duy nhất trên màn hình đổi màu khi bé làm
 *       xong việc, nên nó phải là một tín hiệu rõ.
 *     • Đã nhận ⇒ nút mờ + "Đã nhận". Không mất quà, không mất gì — chỉ là việc này xong rồi.
 *
 * ⚠️ KHÔNG TỰ GỌI `claim` KHI NHIỆM VỤ VỪA XONG. Thấy nút sáng rồi tự bấm hộ là lấy mất đúng
 *    khoảnh khắc mà cả màn hình này tồn tại để trao cho bé.
 */

import { useTranslation } from 'react-i18next';

import { isQuestProgressCountable } from '@shared/content/quests.js';
import type { QuestWithProgress } from '@shared/types/reward.js';

import { cn } from '../../lib/cn.js';
import { BigButton } from './BigButton.js';
import { ProgressBar } from './ProgressBar.js';

export interface QuestCardProps {
  /** Nhiệm vụ kèm tiến độ, đúng như `GET /api/children/:id/quests` trả về. */
  quest: QuestWithProgress;
  /** Bé bấm "Nhận thưởng". KHÔNG được gọi khi nhiệm vụ chưa xong — nút đã tự khoá. */
  onClaim: () => void;
  /** Đang gửi yêu cầu nhận thưởng cho nhiệm vụ NÀY (khoá nút, hiện vòng xoay). */
  claiming?: boolean;
  className?: string;
}

export function QuestCard({ quest, onClaim, claiming = false, className }: QuestCardProps) {
  const { t } = useTranslation();

  const { target } = quest;
  /**
   * ⚠️ PHẢI KẸP `progress` THEO `target` Ở ĐÂY, KHÔNG CHỈ DỰA VÀO THANH TIẾN ĐỘ.
   *   Có tiêu chí mà server suy ra một số LỚN HƠN `target`: `unlock_theme` đếm số chủ đề đã mở,
   *   nên một bé đã mở 4 chủ đề cho nhiệm vụ đòi 1 sẽ nhận `progress = 4, target = 1`. `ProgressBar`
   *   tự kẹp nên thanh vẫn đúng, nhưng nếu chữ không kẹp theo thì thẻ hiện **"4/1"** — một con số
   *   vô nghĩa với bé, và mâu thuẫn với chính thanh bên cạnh nó.
   */
  const value = Math.min(quest.progress, target);
  const kind = quest.criteria.kind;

  /**
   * Chữ hiện cạnh thanh tiến độ — `null` nghĩa là chỉ có thanh, không có chữ.
   *
   * ⚠️⚠️ BA LOẠI TIÊU CHÍ, BA CÁCH NÓI — VÀ ĐÂY LÀ CHỖ DỄ NÓI SAI NHẤT:
   *
   *   • ĐẾM được (`Học 5 bài`, `Chơi 3 game`, `Sưu tầm 6 sticker`…): **"2/3"**. Chữ và thanh
   *     cùng đo một đại lượng, cùng đơn vị, nên chúng khớp nhau và cùng nghĩa.
   *
   *   • `reach_level` (`Nhà thám hiểm — đạt cấp 3`): **"Cấp 3"**, TUYỆT ĐỐI KHÔNG "1/3".
   *     Với tiêu chí cấp bậc, `progress` là CẤP HIỆN TẠI và `target` là cấp CẦN ĐẠT (xem
   *     `questTarget` trong `shared/content/quests.ts`). Bé đang ở cấp 1 đọc "1/3" sẽ hiểu thành
   *     *"con mới làm được một phần ba"* — trong khi sự thật là bé đã lên cấp 1 và còn phải lên
   *     cấp 3. Hai chuyện khác hẳn nhau, và cách nói thứ hai làm bé thấy mình đang ở vạch xuất
   *     phát dù không phải vậy. Nên `isQuestProgressCountable()` trả `false` cho loại này, và ta
   *     nói ra ĐÍCH thay vì nói ra tỉ lệ.
   *
   *   • MỘT-VIỆC (`Bước đầu tiên`, `Bạn của sở thú` — xong một bài cụ thể / cả một chủ đề):
   *     không có con số nào trung thực để hiện. `0/1` chỉ là cách viết khác của "chưa xong",
   *     và nó đứng đó ngay từ ngày đầu nên trông như thể bé đang thiếu một thứ gì. Chỉ khi XONG
   *     mới có chữ ("Xong rồi!"); chưa xong thì chỉ một thanh rỗng — trung tính tuyệt đối, đúng
   *     luật "chưa xong hiển thị trung tính (không tô đỏ, không dấu X)".
   */
  let statusText: string | null = null;
  if (kind === 'reach_level') {
    statusText = t('quest.reachLevel', { level: target });
  } else if (isQuestProgressCountable(quest.criteria)) {
    statusText = t('quest.progress', { current: value, target });
  } else if (quest.completed) {
    statusText = t('quest.barDone');
  }

  /**
   * Nhãn cho trình đọc màn hình của thanh tiến độ.
   *
   * ⚠️ BẮT BUỘC phải ghép với `description_vi`: màn hình có tới 10 thanh giống hệt nhau, và
   *    `ProgressBar` tự nó chỉ đọc được "tiến độ, 43 phần trăm" — bé khiếm thị nghe mười lần một
   *    câu như thế mà không biết thanh nào của việc gì.
   */
  const barLabel = statusText ? `${quest.description_vi} — ${statusText}` : quest.description_vi;

  const buttonLabel = quest.claimed ? t('quest.claimed') : t('quest.claim');
  const ready = quest.completed && !quest.claimed;

  return (
    <article
      className={cn(
        'rounded-card border-2 p-4 transition-colors duration-kid',
        // Xong-mà-chưa-nhận: đây là trạng thái DUY NHẤT mời bé hành động, nên nó có viền xanh.
        ready && 'border-success bg-surface shadow-kid',
        // Đã nhận: lùi về sau một bậc — việc này xong rồi, không cần tranh sự chú ý nữa.
        quest.claimed && 'border-line bg-surface-raised',
        // Chưa xong: trung tính. Cùng một lớp như mọi thẻ bình thường khác.
        !ready && !quest.claimed && 'border-line bg-surface',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="shrink-0 text-[40px] leading-none">
          {quest.icon}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="text-kid-md font-bold text-ink">{quest.description_vi}</h3>

          <div className="mt-2 flex items-center gap-3">
            <ProgressBar
              className="flex-1"
              value={value}
              total={target}
              label={barLabel}
              // Xong ⇒ hổ phách (màu phần thưởng); chưa xong ⇒ hồng thương hiệu (màu tiến độ học).
              tone={quest.completed ? 'star' : 'brand'}
            />
            {statusText !== null && (
              <span className="shrink-0 text-kid-sm font-bold tabular-nums text-ink-soft">
                {statusText}
              </span>
            )}
          </div>
        </div>
      </div>

      <BigButton
        className="mt-3"
        // Sáng lên CHỈ khi xong — xem ghi chú đầu file.
        variant={ready ? 'success' : 'secondary'}
        icon={quest.claimed ? '✅' : '🎁'}
        // `claiming` tự khoá nút và thay icon bằng vòng xoay (xem `BigButton`). Truyền thêm
        // `disabled` cho hai trạng thái còn lại: chưa xong, và đã nhận.
        loading={claiming}
        disabled={!ready}
        onClick={onClaim}
        /**
         * ⚠️ NHÃN ĐỌC PHẢI KÈM TÊN NHIỆM VỤ. Mười nút trên cùng một màn hình đều đọc "Nhận
         *    thưởng"; bé dùng trình đọc màn hình sẽ nghe mười lần một câu và không biết mình
         *    đang đứng ở nút nào. Chữ HIỂN THỊ vẫn ngắn (nút không đủ chỗ), nên nhãn đầy đủ đi
         *    vào `aria-label`.
         */
        aria-label={`${buttonLabel}: ${quest.description_vi}`}
      >
        {buttonLabel}
      </BigButton>
    </article>
  );
}
