/**
 * RubyLingo — `LevelUpOverlay`: màn hình ăn mừng khi bé LÊN CẤP Nhà thám hiểm.
 *
 * ⭐ VÌ SAO ĐÂY LÀ MÀN HÌNH KHÔNG ĐƯỢC PHÉP NHANH:
 *   Một cấp XP cần nhiều ngày học mới đạt (cấp 2 ở 150 XP, cấp 3 ở 400 XP — xem
 *   `shared/content/xp-levels.json`). Đây là cột mốc dài hơi nhất mà bé có, nên nó KHÔNG tự
 *   tắt như `RewardBurst`: nó chờ bé bấm "Chạm để tiếp tục". Cùng lý do đã áp dụng cho
 *   `UnlockOverlay` — hai overlay này là anh em, không phải một cái dùng lại của cái kia:
 *     • `UnlockOverlay` mở khoá MỘT thứ (một chủ đề, một huy hiệu).
 *     • `LevelUpOverlay` mở khoá một CẤP — kèm danh hiệu mới và trọn gói quà của cấp đó.
 *
 * ⚠️⚠️ MỘT LƯỢT CHƠI CÓ THỂ NHẢY NHIỀU CẤP — ĐỌC KỸ TRƯỚC KHI SỬA.
 *   Nếu bé chơi lượt đầu sau nhiều ngày nghỉ, hoặc một lượt thắng lớn, XP có thể vượt qua hai
 *   (hoặc nhiều hơn) ngưỡng cấp cùng lúc. Vì vậy:
 *     • `rewards` là TỔNG quà của MỌI cấp đã vượt — KHÔNG phải quà của riêng cấp cuối. Hiện
 *       đúng tổng là điều kiện để con số ở đây khớp với mức tăng của ví trên thanh trên cùng.
 *     • Phải nói cho bé biết mình vừa vượt mấy cấp (xem `effects.levelsJumped`). Bé ở lại một
 *       mình trên "cấp 4" mà không hiểu vì sao bỏ qua cấp 3 sẽ thấy như app bị lỗi.
 *
 * ⚠️⚠️ HỢP ĐỒNG `levelUp === null` NGHĨA LÀ "ĐÓNG" — KHÔNG CÓ PROP `open` RIÊNG.
 *   Hai prop (`open: boolean` + `levelUp: T | null`) là hai nguồn sự thật cho cùng một câu hỏi,
 *   và chúng có thể MÂU THUẪN: `open = true` khi `levelUp = null` dẫn tới một hộp thoại rỗng
 *   hoặc một lần đọc `undefined.to`. Một prop duy nhất làm trạng thái mâu thuẫn trở thành
 *   KHÔNG BIỂU DIỄN ĐƯỢC — cùng tinh thần với `StarBurst` (nhận `burstKey: string | null`).
 */

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';

import { XP_LEVELS } from '@shared/content/levels.js';
import { getShopItem } from '@shared/content/shop.js';
import type { RewardGrant, XpLevelDefinition } from '@shared/types/reward.js';

import { cn } from '../../lib/cn.js';
import { BigButton } from '../common/BigButton.js';
import { StarBurst } from './StarBurst.js';

/**
 * Phần thưởng lên cấp, đúng hình dạng của `GameResultAward['levelUp']`.
 *
 * Khai báo lại thay vì import từ `shared/types/progress.ts` để component này dùng được cho cả
 * nguồn khác (báo cáo phụ huynh, hồi tưởng cấp) mà không kéo theo toàn bộ hợp đồng `game-result`.
 */
export interface LevelUpInfo {
  /** Cấp bé đang ở TRƯỚC lượt này. */
  from: number;
  /** Cấp bé đạt được. Có thể lớn hơn `from + 1` — xem ghi chú đầu file. */
  to: number;
  /** Quà của MỌI cấp đã vượt, đã gộp. */
  rewards: readonly RewardGrant[];
}

export interface LevelUpOverlayProps {
  /** `null` = không có gì để ăn mừng (đóng). Xem ghi chú đầu file. */
  levelUp: LevelUpInfo | null;
  /** Gọi khi bé bấm nút, bấm Esc, hoặc bấm ra ngoài. */
  onClose: () => void;
}

/** Một khoản quà để vẽ: icon, số lượng, và nhãn ĐỌC ĐƯỢC cho trình đọc màn hình. */
interface RewardChip {
  /**
   * Khoá React. ⚠️ Phải bao gồm cả `refId` chứ không chỉ `kind`: một lượt nhảy nhiều cấp có
   * thể tặng hai huy hiệu khác nhau, và hai chip cùng `key` sẽ làm React bỏ mất một cái.
   */
  key: string;
  icon: string;
  amount: number;
  /** Nhãn đầy đủ — phần nhìn chỉ có icon + số, nên thiếu nhãn này thì bé khiếm thị mất thông tin. */
  ariaLabel: string;
}

/** Tra cấp theo SỐ cấp. `XP_LEVELS` đã sắp theo `xpRequired` tăng dần (tức theo cấp). */
function findLevel(level: number): XpLevelDefinition | undefined {
  return XP_LEVELS.find((entry) => entry.level === level);
}

/**
 * Icon cho một huy hiệu / nhãn dán nhận được ở màn lên cấp.
 *
 * ⭐ VÌ SAO TRA NGƯỢC VỀ CẤP THAY VÌ ĐỌC THẲNG TỪ `badges.json`:
 *   `levelUp.rewards` chỉ mang `refId` (ví dụ `badge-forest-friend`). Màn này KHÔNG có danh mục
 *   huy hiệu — danh mục đó thuộc Nhóm 9 (Huy hiệu & sưu tầm). Nhưng nội dung đã quy định một
 *   luật đủ để tra ra icon mà không cần danh mục: *huy hiệu gắn với cấp XP dùng ĐÚNG icon của
 *   cấp đó* (xem ghi chú `QUY TẮC ICON` trong `badges.json`). Vậy cấp nào định nghĩa món quà
 *   này thì cấp đó là nguồn icon — tra bằng chính `XP_LEVELS`, không bịa thêm gì.
 *
 * ⚠️ Không tra được (id lạ) ⇒ dùng icon của cấp MỚI. Đây là phương án dự phòng, không phải
 *    đường chính: nó không bịa ra một icon mới, chỉ dùng icon bé vừa nhìn thấy ở giữa màn hình.
 */
function collectibleIcon(grant: RewardGrant, newLevelIcon: string): string {
  const refId = grant.refId;
  if (!refId) return newLevelIcon;

  const owner = XP_LEVELS.find((level) =>
    level.rewards.some((reward) => reward.kind === grant.kind && reward.refId === refId),
  );
  return owner?.icon ?? newLevelIcon;
}

/** Cộng dồn `amount` của mọi khoản quà cùng loại. Thiếu `amount` coi như 1 món. */
function sumAmount(rewards: readonly RewardGrant[], kind: RewardGrant['kind']): number {
  return rewards
    .filter((reward) => reward.kind === kind)
    .reduce((total, reward) => total + (reward.amount ?? 1), 0);
}

export function LevelUpOverlay({ levelUp, onClose }: LevelUpOverlayProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();

  const open = levelUp !== null;
  const newLevel = levelUp ? findLevel(levelUp.to) : undefined;

  /**
   * Danh sách quà để vẽ.
   *
   * ⚠️ BỎ QUA khoản `kind: 'xp'`. Cấp được tính TỪ XP, nên tặng XP để lên cấp là vòng lặp;
   *    `scripts/validate-content.ts` (luật V16c) cấm nội dung chứa quà `xp`, và phía server
   *    (`XpService.levelRewardsToBundle`) cũng gỡ nó ra kèm cảnh báo. Nếu nội dung có lọt một
   *    khoản như vậy, nó cũng không được hiện ở đây — nếu không bé sẽ thấy một món quà không
   *    bao giờ tới tay mình.
   */
  const chips: RewardChip[] = [];
  if (levelUp) {
    const stars = sumAmount(levelUp.rewards, 'stars');
    const acorns = sumAmount(levelUp.rewards, 'acorns');
    if (stars > 0) {
      chips.push({
        key: 'stars',
        icon: '⭐',
        amount: stars,
        ariaLabel: t('game.rewardStars', { count: stars }),
      });
    }
    if (acorns > 0) {
      chips.push({
        key: 'acorns',
        icon: '🌰',
        amount: acorns,
        ariaLabel: t('game.rewardAcorns', { count: acorns }),
      });
    }

    const icon = newLevel?.icon ?? '🏅';
    for (const grant of levelUp.rewards) {
      if (grant.kind === 'item') {
        const item = grant.refId ? getShopItem(grant.refId) : undefined;
        if (!item) continue;
        chips.push({
          key: `item:${grant.refId}`,
          icon: item.icon,
          amount: grant.amount ?? 1,
          ariaLabel: t('effects.gotItem', { name: item.name_vi }),
        });
      } else if (grant.kind === 'badge') {
        chips.push({
          key: `badge:${grant.refId}`,
          icon: collectibleIcon(grant, icon),
          amount: grant.amount ?? 1,
          ariaLabel: t('effects.gotBadge'),
        });
      } else if (grant.kind === 'sticker') {
        chips.push({
          key: `sticker:${grant.refId}`,
          icon: collectibleIcon(grant, icon),
          amount: grant.amount ?? 1,
          ariaLabel: t('effects.gotSticker'),
        });
      }
    }
  }

  /** Số cấp bé vượt trong lượt này. `> 1` mới cần nói ra — xem ghi chú đầu file. */
  const levelsJumped = levelUp ? levelUp.to - levelUp.from : 0;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <AnimatePresence>
        {levelUp && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
                className="fixed inset-0 z-overlay bg-scrim backdrop-blur-sm"
              />
            </Dialog.Overlay>

            {/*
              ⚠️⚠️ CĂN GIỮA BẰNG BỐ CỤC, KHÔNG BẰNG `transform` — ĐỌC TRƯỚC KHI "GỘP LẠI CHO GỌN".

              Bản đầu của màn này đặt hộp thoại bằng `fixed left-1/2 top-1/2 -translate-x-1/2
              -translate-y-1/2` NGAY TRÊN chính `motion.div` đang được animate. Nó hỏng, và hỏng
              IM LẶNG:

                • Framer Motion chạy hiệu ứng bằng cách ghi `transform` vào `style` INLINE của
                  phần tử. Ở trạng thái nghỉ (scale = 1, y = 0) nó ghi `transform: none`.
                • Style inline LUÔN thắng lớp CSS. Nên `transform` của Tailwind
                  (`translate(-50%, -50%)`) không bao giờ được áp — chỉ còn `left/top: 50%`.
                • Kết quả đo trên máy 430×932: thẻ rộng 396 nằm ở `left: 215, right: 611`, tức
                  LỆCH ĐÚNG 198px = một nửa chiều rộng, và tràn 181px ra ngoài mép phải. Bé chỉ
                  thấy một nửa lời chúc mừng, và nút "Chạm để tiếp tục" bị cắt.

              ⚠️ KHÔNG CỔNG KIỂM TĨNH NÀO BẮT ĐƯỢC LỖI NÀY: `tsc`, `eslint`, `vite build` và mọi
                 test jsdom đều XANH — jsdom không áp CSS, nên nó không có ý kiến gì về việc hai
                 lớp translate có tác dụng hay không. Chỉ ảnh chụp render THẬT mới lộ ra.

              ⇒ Nên: lớp ngoài chỉ lo CĂN GIỮA bằng grid (`place-items-center`) và TUYỆT ĐỐI
                không mang `transform`; lớp trong chỉ lo ANIMATION. Hai việc, hai phần tử —
                cùng tinh thần với "một cột chỉ có một chủ" ở tầng dữ liệu.

              `pointer-events-none` ở lớp ngoài + `pointer-events-auto` ở thẻ: giữ nguyên hành vi
              "bấm ra ngoài để đóng". Nếu lớp ngoài nhận chuột thì vùng đệm quanh thẻ bị coi là
              BÊN TRONG hộp thoại, và bé bấm ra ngoài sẽ không đóng được gì.
            */}
            <div className="pointer-events-none fixed inset-0 z-overlay grid place-items-center p-4">
              <Dialog.Content asChild forceMount>
                <motion.div
                  initial={reduceMotion ? false : { scale: 0.8, y: 40, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { scale: 0.9, y: 20, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                  className={cn(
                    'pointer-events-auto w-[min(92vw,460px)]',
                    'rounded-kid border-4 border-star bg-surface p-6 text-center shadow-pop',
                    // Hộp thoại tự nhận tiêu điểm khi mở; vòng viền focus quanh cả hộp trông như
                    // lỗi. Nút bên trong VẪN có vòng focus riêng.
                    'focus:outline-none',
                  )}
                >
                  {/* Icon cấp mới + chùm hạt. Cần cha `relative` nên bọc trong một lớp. */}
                  <div className="relative mx-auto flex size-[148px] items-center justify-center">
                    <StarBurst burstKey={`level-up-${levelUp.to}`} count={20} />
                    <motion.span
                      aria-hidden="true"
                      // Cấp mới "nảy" lên một nhịp — khoảnh khắc đáng nhớ nhất của màn này.
                      initial={reduceMotion ? false : { scale: 0.4 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.06 }}
                      className="text-[104px] leading-none"
                    >
                      {newLevel?.icon ?? '🏅'}
                    </motion.span>
                  </div>

                  {/*
                  `Dialog.Title` là BẮT BUỘC về mặt kỹ thuật: Radix cảnh báo và trình đọc màn
                  hình mất ngữ cảnh nếu hộp thoại không có tiêu đề.
                */}
                  <Dialog.Title className="mt-2 text-kid-xl leading-tight text-brand">
                    {t('effects.levelUp', { level: levelUp.to })}
                  </Dialog.Title>

                  {newLevel && (
                    <Dialog.Description className="mt-1 text-kid-md font-bold text-ink">
                      {t('effects.newRank', { title: newLevel.title_vi })}
                    </Dialog.Description>
                  )}

                  {levelsJumped > 1 && (
                    <p className="mt-2 rounded-kid bg-star-soft px-3 py-2 text-kid-sm font-bold text-ink">
                      🚀 {t('effects.levelsJumped', { count: levelsJumped })}
                    </p>
                  )}

                  {chips.length > 0 && (
                    <div className="mt-4 flex flex-col items-center gap-2 rounded-kid border-2 border-star bg-star-soft p-3">
                      <span className="text-kid-xs font-bold text-ink-soft">
                        {t('effects.levelUpRewards')}
                      </span>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {chips.map((chip) => (
                          <span
                            key={chip.key}
                            /*
                            ⚠️ Nhãn đọc đầy đủ nằm ở `aria-label`; phần nhìn chỉ có icon + số.
                            Nếu để trình đọc màn hình đọc "Cúp vàng cộng một" thì bé khiếm thị
                            không biết đó là HUY HIỆU hay ĐIỂM KINH NGHIỆM.
                          */
                            aria-label={chip.ariaLabel}
                            className="flex items-center gap-1.5 rounded-kid bg-surface px-3 py-1.5"
                          >
                            <span aria-hidden="true" className="text-[24px] leading-none">
                              {chip.icon}
                            </span>
                            <span
                              aria-hidden="true"
                              className="text-kid-sm font-bold tabular-nums text-ink"
                            >
                              +{chip.amount}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <Dialog.Close asChild>
                    <BigButton variant="primary" size="lg" className="mt-5">
                      {t('effects.tapToContinue')}
                    </BigButton>
                  </Dialog.Close>
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
