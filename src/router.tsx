/**
 * RubyLingo — Bảng định tuyến.
 *
 * ⭐ CẤU TRÚC BA TẦNG, LỒNG NHAU — MỖI TẦNG MỘT NHIỆM VỤ:
 *
 *   Tầng 1 — CÔNG KHAI: `/login`, `/signup`, `/reset`
 *     Bọc trong `RedirectIfAuthenticated` để người đã đăng nhập không phải nhìn lại form.
 *
 *   Tầng 2 — CẦN ĐĂNG NHẬP, CHƯA CẦN BÉ: `/children/new`
 *     Bọc trong `RequireParent`. Đây là màn hình đầu tiên sau khi đăng ký.
 *
 *   Tầng 3 — CẦN ĐĂNG NHẬP VÀ ĐÃ CÓ BÉ: mọi màn hình học
 *     Bọc trong `RequireChild`, rồi lồng tiếp trong `AppShell` (thanh trên + thanh dưới).
 *
 * ⭐ VÌ SAO DÙNG ROUTE LỒNG (`<Outlet />`) CHỨ KHÔNG LẶP LẠI GUARD Ở TỪNG TRANG:
 *   Khai một lần cho cả nhóm nghĩa là THÊM TRANG MỚI VÀO NHÓM LÀ TỰ ĐƯỢC BẢO VỆ. Nếu mỗi trang
 *   tự khai guard, mỗi trang mới là một cơ hội để quên — và một trang quên guard sẽ hiện ra với
 *   người chưa đăng nhập, rồi nổ ở tầng API với một lỗi khó hiểu.
 *
 *   Lồng `AppShell` cũng có nghĩa khung chỉ được dựng MỘT LẦN và không bị tháo ra lắp lại khi
 *   bé chuyển màn hình — thanh trên cùng không nhấp nháy.
 *
 * ⚠️ GUARD Ở ĐÂY CHỈ LÀ RÀO CẢN GIAO DIỆN. Bảo mật thật nằm ở server — xem ghi chú đầu
 *    `src/lib/guards.tsx`.
 *
 * Thứ tự route không quan trọng: `react-router` v6 chọn theo độ cụ thể, không theo thứ tự khai
 * báo. `*` vì vậy luôn nằm cuối cho dễ đọc.
 */

import { Route, Routes } from 'react-router-dom';

import { AppShell } from './components/common/AppShell.js';
import { NotFoundPage } from './components/common/NotFoundPage.js';
import { RedirectIfAuthenticated, RequireChild, RequireParent } from './lib/guards.js';
import { FlashcardPage } from './pages/FlashcardPage.js';
import { GamePage } from './pages/GamePage.js';
import { JourneyMapPage } from './pages/JourneyMapPage.js';
import { ThemePage } from './pages/ThemePage.js';
import { ChildProfileSetupPage } from './pages/auth/ChildProfileSetupPage.js';
import { LoginPage } from './pages/auth/LoginPage.js';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage.js';
import { SignupPage } from './pages/auth/SignupPage.js';
import { ParentGatePage } from './pages/parent/ParentGatePage.js';
import { PetHousePage } from './pages/pet/PetHousePage.js';
import { ExplorerProfilePage } from './pages/profile/ExplorerProfilePage.js';
import { QuestsPage } from './pages/quests/QuestsPage.js';
import { CollectionPage } from './pages/rewards/CollectionPage.js';

export function AppRoutes() {
  return (
    <Routes>
      {/* ---------- Tầng 1: công khai ---------- */}
      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <LoginPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/signup"
        element={
          <RedirectIfAuthenticated>
            <SignupPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/reset"
        element={
          <RedirectIfAuthenticated>
            <ResetPasswordPage />
          </RedirectIfAuthenticated>
        }
      />

      {/* ---------- Tầng 2: đã đăng nhập, chưa cần bé ---------- */}
      <Route element={<RequireParent />}>
        <Route path="/children/new" element={<ChildProfileSetupPage />} />
      </Route>

      {/* ---------- Tầng 3: đã đăng nhập VÀ đã có bé ---------- */}
      <Route element={<RequireChild />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<JourneyMapPage />} />

          {/*
            ⭐ BỐN TẦNG ĐI XUỐNG CỦA VIỆC HỌC — mỗi tầng là một bước bé tự quyết định:
              `/`                                      chọn chủ đề  (bản đồ hành trình)
              `/theme/:themeId`                        chọn bài     (danh sách bài của chủ đề)
              `/lesson/:lessonId/flashcards`           học từ       (thẻ từ vựng)
              `/lesson/:lessonId/game/:exerciseSlug`   chơi game    (một bài tập cụ thể)

            `:themeId` và `:lessonId` là id NỘI DUNG ("at-the-zoo", "at-the-zoo/z1"), không phải
            chỉ số. Nhờ vậy URL dùng lại được, chia sẻ được, và thêm chủ đề mới không làm URL cũ
            trỏ sai chỗ.

            ⚠️ `/lesson/:lessonId/flashcards` có hậu tố `/flashcards` là CÓ CHỦ ĐÍCH: nếu thẻ từ
            chiếm mất `/lesson/:lessonId`, thì mọi đường dẫn game phải nằm dưới nó — và tầng "bài
            học" sẽ vô tình trở thành một trang thẻ từ. Nay route game nằm NGANG HÀNG, đúng như
            đã dự tính ở Nhóm 4.

            ⚠️⚠️ `:exerciseSlug` CHỈ LÀ PHẦN CUỐI của `exercise.id`, không phải cả id.
              `exercise.id` là `"at-the-zoo/z1/listen-tap"` — đã chứa `lessonId` bên trong. Đưa
              nguyên vào URL sẽ thành:
                /lesson/at-the-zoo%2Fz1/game/at-the-zoo%2Fz1%2Flisten-tap
              lessonId lặp hai lần, URL dài gấp đôi, đầy `%2F` không ai đọc được. Nên URL chỉ
              mang `listen-tap`, và `GamePage` ghép lại id đầy đủ từ `lessonId + '/' + slug`.
          */}
          <Route path="/theme/:themeId" element={<ThemePage />} />
          <Route path="/lesson/:lessonId/flashcards" element={<FlashcardPage />} />
          <Route path="/lesson/:lessonId/game/:exerciseSlug" element={<GamePage />} />

          {/*
            Bảng nhiệm vụ (M9). Nằm NGANG HÀNG với ba tầng đi xuống ở trên, không nằm dưới chúng:
            đây không phải một bước trong việc học, mà là một màn hình bé ghé qua giữa hai bài.

            Mục "📋 Nhiệm vụ" ở `BottomNav` trỏ tới đây — xem ghi chú đầu file đó về lý do nó là
            mục thứ năm và vì sao "Cửa hàng" thì không.
          */}
          <Route path="/quests" element={<QuestsPage />} />

          {/*
            Nhà thú cưng (M6) — Momo, cửa hàng và (T065) cho ăn / mặc phụ kiện.
            Cửa hàng nằm BÊN TRONG màn hình này chứ không phải một mục ở `BottomNav`: bé mua đồ
            xong phải thấy ngay Momo đổi — xem ghi chú đầu `PetHousePage.tsx`.

            ⚠️ Trang này ĐỌC ví/túi/linh vật từ `rewardStore`, mà `rewardStore` được nạp MỘT LẦN ở
               `AppShell` (`useRewardsLifecycle`) — không nạp lại ở đây.
          */}
          <Route path="/pet" element={<PetHousePage />} />

          {/*
            Hồ sơ nhà thám hiểm (M13) — thanh XP, tiến hoá linh vật, huy hiệu, thành tích (T071).

            ⚠️ ĐIỂM VÀO NẰM Ở `TopBar` (nút `profileTo="/profile"`), KHÔNG ở `BottomNav`:
               5 mục của `BottomNav` là TRẦN của dự án — xem chú thích đầu tệp đó.

            ⚠️ Trang này ĐỌC ví/huy hiệu từ `rewardStore` và tiến độ từ `progressStore`; cả hai
               đều đã được nạp MỘT LẦN ở `AppShell` — không nạp lại ở đây.
          */}
          <Route path="/profile" element={<ExplorerProfilePage />} />

          {/*
            Bộ sưu tập (M9) — hai tab Huy hiệu / Sticker (T070).
            ⚠️ Đã THAY `ComingSoonPage` tạm (Nhóm 9) bằng trang thật.
          */}
          <Route path="/collection" element={<CollectionPage />} />

          {/*
            Khu vực phụ huynh (Nhóm 11) — CỔNG PIN (T072).

            ⚠️ Đã THAY `ComingSoonPage` tạm ở đây bằng `ParentGatePage`. Sau lần thay này
               `ComingSoonPage` KHÔNG còn nơi nào dùng — đã báo team-lead, ĐỪNG tự xoá tệp đó.

            Khu vực phụ huynh đầy đủ (báo cáo, cài đặt — T073/T074) sẽ nằm SAU cổng này.
          */}
          <Route path="/parent" element={<ParentGatePage />} />
        </Route>
      </Route>

      {/* ---------- Không khớp gì cả ---------- */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
