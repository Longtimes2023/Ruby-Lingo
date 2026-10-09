/**
 * RubyLingo — Chuỗi giao diện tiếng Việt.
 *
 * Nguyên tắc ngôn ngữ (quan trọng — đây là app cho trẻ 7 tuổi):
 *   • KHÔNG BAO GIỜ dùng từ mang tính phán xét: "sai", "kém", "chưa đạt", "thất bại".
 *   • Trả lời sai ⇒ "Bé thử lại nhé!" chứ không phải "Sai rồi".
 *   • Khen cụ thể theo hành vi ("Con nghe giỏi lắm!") chứ không khen chung chung.
 *   • Câu ngắn, dễ đọc, xưng "bé" / "con" và gọi người lớn là "bố mẹ".
 */

export const vi = {
  // --- Chung ------------------------------------------------------------
  app: {
    name: 'RubyLingo',
    tagline: 'Nhà Vườn Thú Của Bé',
    loading: 'Đang chuẩn bị...',
    retry: 'Thử lại',
    back: 'Quay lại',
    next: 'Tiếp',
    skip: 'Bỏ qua',
    close: 'Đóng',
    cancel: 'Huỷ',
    confirm: 'Đồng ý',
    save: 'Lưu',
    done: 'Xong rồi!',
  },

  // --- Trẻ em -----------------------------------------------------------
  kid: {
    /** Lời chào ở trang chủ. Xưng "con" và gọi tên bé — nghe thân mật hơn "Chào mừng". */
    hello: 'Chào {{name}}!',

    /** Câu khen khi trả lời đúng — xoay vòng để bé không thấy nhàm. */
    praise: [
      'Giỏi quá!',
      'Bé làm tốt lắm!',
      'Tuyệt vời!',
      'Đúng rồi!',
      'Bé siêu thật!',
      'Wow, chính xác!',
      'Bông thấy bé giỏi ghê!',
      'Momo tự hào về bé!',
    ],
    /** Câu động viên khi trả lời chưa đúng — KHÔNG có từ "sai". */
    encourage: [
      'Bé thử lại nhé!',
      'Gần đúng rồi, thử lại nào!',
      'Không sao đâu, mình thử lần nữa nhé!',
      'Bé nghe lại rồi chọn lại nhé!',
      'Cố lên, bé làm được mà!',
    ],
    playAgain: 'Chơi lại',
    nextQuestion: 'Câu tiếp theo',
    listenAgain: 'Nghe lại',
    hint: 'Gợi ý cho bé',
    newRecord: 'Kỷ lục mới!',
    yourBest: 'Điểm cao nhất của bé',
    stars: 'Sao',
    /** Tiền tệ hiếm — hiển thị riêng, không gộp vào sao. */
    acorns: 'Hạt dẻ',
    level: 'Cấp',
    xp: 'Điểm kinh nghiệm',
    streak: 'Chuỗi ngày học',
    /** Đơn vị ngày, dùng ghép số: "5 ngày". */
    days: 'ngày',
    /**
     * Câu hiện khi chuỗi ngày = 0.
     * ⭐ KHÔNG BAO GIỜ hiển thị "0" hay bất kỳ câu nào mang ý trách: bé vừa nghỉ học về, câu
     *   đầu tiên bé đọc phải là một lời mời, không phải một lời nhắc lỗi.
     */
    streakStart: 'Học hôm nay để bắt đầu chuỗi nhé!',
    happiness: 'Vui vẻ',
    comingSoon: 'Sắp mở',
    locked: 'Chưa mở',
  },

  // --- Nhiệm vụ & thưởng -------------------------------------------------
  quest: {
    title: 'Nhiệm vụ',
    daily: 'Nhiệm vụ hôm nay',
    weekly: 'Nhiệm vụ tuần này',
    milestone: 'Cột mốc',
    claim: 'Nhận thưởng',
    claimed: 'Đã nhận',
    /** Tiến độ dạng "2/3". Chỉ dùng cho tiêu chí ĐẾM được — xem `QuestCard`. */
    progress: '{{current}}/{{target}}',
    allDone: 'Bé đã hoàn thành hết nhiệm vụ hôm nay!',
    resetHint: 'Nhiệm vụ mới sẽ có vào ngày mai',

    /** Một câu mời ở đầu màn hình. Không nhắc tới "phải", "cần" — chỉ là một lời rủ rê. */
    intro: 'Làm xong nhiệm vụ, mình mở túi quà nhé!',
    /**
     * `reach_level` — nhiệm vụ kiểu "đạt cấp N". Nói ra ĐÍCH, KHÔNG nói tỉ lệ: bé đang ở cấp 1 mà
     * thấy "1/3" sẽ tưởng mình mới làm được một phần ba. Xem ghi chú dài ở `QuestCard`.
     */
    reachLevel: 'Cấp {{level}}',
    /** Nhiệm vụ MỘT-VIỆC (xong một bài / cả chủ đề) chỉ có chữ khi đã XONG — xem `QuestCard`. */
    barDone: 'Xong rồi!',
    /** Tiêu đề lớp túi quà, mở ra khi bé bấm "Nhận thưởng". */
    claimTitle: 'Bé mở túi quà!',

    /** Trạng thái "chưa đọc được danh sách" — khác hẳn "đọc rồi và không có gì". */
    loadingHint: 'Đang lấy danh sách nhiệm vụ cho bé...',
    loadErrorTitle: 'Chưa mở được nhiệm vụ',
    loadErrorHint: 'Có vẻ mạng đang chậm. Bé thử lại nhé!',
    emptyTitle: 'Chưa có nhiệm vụ nào',
    emptyHint: 'Nhiệm vụ mới sẽ có sớm thôi. Bé cứ học bài đã nhé!',
  },

  reward: {
    levelUp: 'Lên cấp rồi!',
    newBadge: 'Huy hiệu mới!',
    newSticker: 'Sticker mới!',
    /**
     * Nhãn của MỘT sticker vừa mở trong túi quà (T069.2): "Sticker mới: Voi con".
     * ⚠️ Tên sticker lấy từ DỮ LIỆU (`stickers.json`) qua `getSticker`, KHÔNG khai lại ở đây.
     *    Câu này nói rõ "mở được sticker" (không chỉ tên trơ) để bé — và trình đọc màn hình —
     *    hiểu đây là phần thưởng sưu tầm vừa mở, không phải một vật phẩm bé đã có.
     */
    gotStickerName: 'Sticker mới: {{name}}',
    collection: 'Bộ sưu tập',
    badges: 'Huy hiệu',
    stickers: 'Sticker',
    notYet: 'Chưa có',
    earnedOn: 'Nhận ngày {{date}}',

    // --- Màn Bộ sưu tập (T070) -------------------------------------------
    /** Câu mời ở đầu màn hình. Không nhắc "phải", "cần" — chỉ là một lời rủ rê. */
    collectionIntro: 'Bé ngắm lại những thứ mình đã kiếm được nhé!',
    /**
     * Nhãn đọc của một ô ĐÃ có. Đặt cạnh tên huy hiệu/sticker: "Bước đầu tiên: đã đạt".
     * ⚠️ Câu này là một LỜI KHEN (bé đã kiếm được), nên nó được phép nói "đã đạt".
     */
    earned: 'đã đạt',
    /**
     * Chữ trên ô CHƯA có — TRUNG TÍNH và HƯỚNG TƯƠNG LAI.
     * ⚠️ LUẬT SỐ 1: KHÔNG BAO GIỜ MẮNG TRẺ. Tuyệt đối không dùng "chưa đạt"/"kém"/"sai". Ô trống
     *    là một lời hẹn ("Sắp có rồi!"), không phải một lời chê. Có test chống hồi quy quét DOM
     *    thật — xem `tests/unit/client/collection-page.test.tsx`.
     */
    upcoming: 'Sắp có rồi!',
    /** Nhãn đọc gộp của một ô: tên + trạng thái ("Voi con: Sắp có rồi!"). */
    itemAria: '{{name}}: {{status}}',
    /** Tiến độ sưu tầm của tab đang mở: "3/6 đã sưu tầm". */
    collected: '{{done}}/{{total}} đã sưu tầm',
    /** Nhánh rỗng của tab Huy hiệu (thực tế không xảy ra) — vẫn phải tử tế nếu có. */
    badgesEmptyTitle: 'Bé sẽ mở được huy hiệu sớm thôi!',
    badgesEmptyHint: 'Momo giữ huy hiệu cho bé, học xong là có ngay nhé!',
    /** Nhánh rỗng của tab Sticker. */
    stickersEmptyTitle: 'Bé sẽ mở được sticker sớm thôi!',
    stickersEmptyHint: 'Mỗi bài học xong, Momo tặng bé một sticker nhé!',
    /** Không đọc được bộ sưu tập từ server. Bé không làm gì sai — chỉ là mạng chậm. */
    loadErrorTitle: 'Chưa mở được bộ sưu tập',
    loadErrorHint: 'Có vẻ mạng đang chậm. Bé thử lại nhé!',
  },

  shop: {
    title: 'Cửa hàng',
    food: 'Đồ ăn',
    accessory: 'Phụ kiện',
    decoration: 'Trang trí',
    buy: 'Mua',
    owned: 'Đã có',
    equipped: 'Đang dùng',
    equip: 'Dùng ngay',
    unequip: 'Bỏ ra',
    feed: 'Cho ăn',
    notEnough: 'Mình cùng học thêm nhé!',
    buySuccess: 'Bé vừa mua được {{item}}!',
    feedSuccess: '{{pet}} ăn ngon quá!',
    /**
     * ⚠️ CÂU NÀY KHÁC `feedSuccess`, VÀ SỰ KHÁC NHAU LÀ CẢ MỘT LUẬT CỦA DỰ ÁN.
     *   Khi Momo đã no, server trả 200 và KHÔNG tiêu món ăn của bé (xem `ShopNotice.kind =
     *   'full'`). Nếu vẫn nói "ăn ngon quá!" thì đó là một lời NÓI DỐI: bé vừa đưa một quả chuối
     *   mà Momo không hề ăn. Dự án cấm mắng trẻ — và cấm nói dối trẻ cũng là cùng một luật.
     */
    petFull: '{{pet}} đang no lắm rồi!',
    /** Gợi ý nhẹ khi bé CHƯA có món ăn nào trong túi. Không trách, chỉ mời. */
    noFoodYet: 'Bé chưa có món ăn nào. Mua một món cho {{pet}} nhé!',
    /** Số lượng một món đồ ăn bé đang có trong túi. */
    ownedCount: 'Đang có {{count}}',
    loadErrorTitle: 'Chưa mở được cửa hàng',
    loadErrorHint: 'Mạng đang chậm một chút. Bé thử lại nhé!',
    /**
     * ⚠️ KHÔNG CÓ `priceStars`/`priceAcorns` Ở ĐÂY, VÀ ĐÓ LÀ CHỦ Ý.
     *   Tên và biểu tượng hai loại tiền tệ (⭐ Sao, 🌰 Hạt dẻ) nằm trong
     *   `shared/content/shop-items.json` và được đọc qua `SHOP_CURRENCIES`. Khai lại chúng ở đây
     *   là tạo nguồn sự thật THỨ HAI cho cùng một thứ — và tới ngày ai đó đổi tên tiền tệ trong
     *   JSON, nhãn giá trên màn hình sẽ nói một đằng, danh mục nói một nẻo, không có gì báo lỗi.
     */
  },

  pet: {
    /** Tên linh vật. Một chỗ duy nhất để đổi tên bạn ấy trong toàn bộ giao diện. */
    name: 'Momo',
    title: 'Nhà thú cưng',
    feed: 'Cho ăn',
    happiness: 'Mức vui vẻ',
    evolution: 'Lớn lên',
    nextStage: 'Còn {{count}} từ nữa để lớn hơn',
    maxStage: 'Bạn ấy đã lớn nhất rồi!',
    /**
     * Nhãn ĐỌC LÊN của `PetAvatar` (T065). Cả khung cảnh là emoji đã `aria-hidden`, nên nếu
     * không có mấy câu này thì bé khiếm thị không nghe được gì khi bé vừa mua cho Momo một món.
     */
    sceneWearing: '{{pet}} đang dùng: {{items}}',
    sceneScenery: 'Quanh nhà có {{items}}',
    sceneBare: '{{pet}} đang chơi trong nhà',
  },

  /**
   * --- Hồ sơ nhà thám hiểm (M13, T071) -----------------------------------
   *
   * ⚠️ LUẬT SỐ 1 — KHÔNG BAO GIỜ MẮNG TRẺ. Không một chuỗi nào ở đây (kể cả trong trạng thái
   *    rỗng và trạng thái lỗi) được dùng "sai"/"kém"/"chưa đạt"/"thất bại". Chỗ chưa có gì phải
   *    là một LỜI HẸN hướng tương lai, không phải một lời chê. Có test chống hồi quy quét cả DOM
   *    lẫn `aria-label` — xem `tests/unit/client/explorer-profile-page.test.tsx`.
   */
  profile: {
    title: 'Hồ sơ nhà thám hiểm',
    /** Tiêu đề khối thanh XP — nói rõ đây là CẤP của bé, tách khỏi khối lớn lên của linh vật. */
    xpSection: 'Cấp nhà thám hiểm',
    /**
     * Tiêu đề khối tiến hoá linh vật. Có `{{pet}}` để câu tự nhiên ("Momo lớn lên") — tên linh
     * vật lấy từ `pet.name`, không chép lại ở đây (một chỗ đổi tên, cả app đổi theo).
     */
    petSection: '{{pet}} lớn lên',
    /**
     * ⚠️ ĐÂY LÀ NHÃN, KHÔNG PHẢI CÂU HOÀN CHỈNH. Nó đứng trước tên giai đoạn kế tiếp của Momo
     *   ("Tiếp theo: 🐣 Nhóc con"), ghép trong `ExplorerProfilePage`. Tên giai đoạn lấy từ DỮ
     *   LIỆU (`xp-levels.json`), KHÔNG khai lại ở đây.
     */
    petNextLabel: 'Tiếp theo:',
    /** Tiêu đề khối huy hiệu. */
    badgesSection: 'Huy hiệu của bé',
    /** Số huy hiệu bé đã kiếm trong bảng đang hiện. */
    badgesCount: '{{done}}/{{total}} huy hiệu',
    /** Chưa có huy hiệu nào — lời hẹn nhẹ, không trách. */
    badgesEmpty: 'Bé sẽ sưu tầm được nhiều huy hiệu nhé!',
    /** Tiêu đề khối thống kê. */
    statsSection: 'Thành tích của bé',
    statBadges: 'Huy hiệu đã kiếm',
    statStickers: 'Sticker đã kiếm',
    statLessons: 'Bài đã xong',
    statWords: 'Từ đã học',
    statMastered: 'Từ đã nhớ chắc',
    statStreak: 'Chuỗi ngày học',
    /**
     * Dấu "CHƯA BIẾT" cho một con số chưa đọc được (tiến độ trong máy chưa nạp xong).
     * ⚠️ KHÔNG hiện số 0 thay cho nó: 0 là một LỜI NÓI DỐI CỤ THỂ (bé tưởng mình mất hết), còn
     *    "—" chỉ nói "chưa biết". Cùng luật với `TopBar`.
     */
    unknown: '—',
    /** Không đọc được hồ sơ từ server. Bé không làm gì sai — chỉ là mạng chậm. */
    loadErrorTitle: 'Chưa mở được hồ sơ',
    loadErrorHint: 'Có vẻ mạng đang chậm. Bé thử lại nhé!',
  },

  // --- Bản đồ & bài học --------------------------------------------------
  map: {
    title: 'Bản đồ hành trình',
    chooseTheme: 'Bé muốn học chủ đề nào?',
    lessonsDone: '{{done}}/{{total}} bài',
    starsInTheme: '{{stars}} sao',
    /** Số chủ đề của cả cấp học. Dùng `{{count}}` để i18next tự chọn dạng số nhiều. */
    themeCount: '{{count}} chủ đề',
    /** Số từ và số bài của một chủ đề, hiện trên thẻ chủ đề. */
    wordAndLessonCount: '{{words}} từ · {{lessons}} bài',

    /**
     * Dải tóm tắt phía trên bản đồ.
     *
     * ⭐ Cố ý đếm TỪ chứ không đếm SAO: ở giai đoạn này phần lớn chủ đề chưa có game nên chưa
     *   có sao nào để kiếm. Đếm từ là thứ bé luôn tiến bộ được, ở mọi chủ đề.
     */
    summary: 'Bé đã học {{done}}/{{total}} từ',
    /** Tiến độ sao của một chủ đề CÓ game: "3/9 ⭐". */
    starsOfMax: '{{stars}}/{{max}} ⭐',
    /** Tiến độ từ của một chủ đề CHƯA có game: "5/13 từ". */
    wordsOfMax: '{{done}}/{{total}} từ',
    /** Nhãn hành động trên thẻ chủ đề có game. */
    play: 'Chơi game',
    /** Nhãn hành động trên thẻ chủ đề chỉ có thẻ từ. */
    study: 'Thẻ từ vựng',
    locked: 'Chưa mở',
    comingSoon: 'Sắp mở',
    /** Còn thiếu gì để mở khoá — hiện ngay trên thẻ, không giấu sau một cú bấm. */
    lockedByPrevious: 'Học xong “{{theme}}” để mở nhé!',
    lockedByStars: 'Cần {{stars}} ⭐, bé đang có {{have}}',
    /** Nhãn đọc của screen reader cho thẻ chủ đề đã mở. */
    openTheme: 'Vào chủ đề {{theme}}',
    notFoundTitle: 'Không tìm thấy chủ đề này',
    notFoundHint: 'Bé quay lại bản đồ và chọn lại nhé!',
    /** Chủ đề có trong bản đồ nhưng chưa có từ nào — khác hẳn "chưa có game". */
    noContent: 'Chủ đề này chưa có nội dung',
  },

  /** Màn hình một chủ đề: danh sách bài học và trò chơi. */
  theme: {
    lessonsTitle: 'Các bài học',
    /** Số từ bé đã học trong một bài. */
    wordsLearnedOf: 'Đã học {{done}}/{{total}} từ',
    gamesTitle: 'Trò chơi',
    /**
     * Tiêu đề nhỏ của khối trò chơi NẰM TRONG một dòng bài học.
     * ⚠️ Phải nói "của bài này": khối này nằm giữa các khối khác bên trong thẻ của MỘT bài, nên
     *   nếu chỉ ghi "Trò chơi" thì bé không biết đó là trò của bài nào.
     */
    gamesInLesson: 'Trò chơi của bài này',
    /** Nhãn đọc của một chip trò chơi — nói rõ đây là HÀNH ĐỘNG, không phải tên một đồ vật. */
    playGame: 'Chơi trò {{game}}',
    /**
     * Số trò CÒN ĐANG LÀM của một bài — gộp thành MỘT DÒNG CHỮ, không phải một rừng chip xám.
     * ⭐ Bé đọc ra "còn nữa, nhưng chưa có" — chứ không đọc ra "hỏng rồi" (một khoảng trắng) hay
     *   "con không bấm được" (một chip xám bấm không ra gì).
     */
    gamesPending: '{{count}} trò chơi khác đang được làm',
    /**
     * Câu thay chỗ danh sách game khi chủ đề CHƯA CÓ bài tập nào.
     * ⭐ Nói rõ ĐANG LÀM, không nói "không có" — bé vừa học xong mà đọc "không có gì" thì
     *   giống như bị từ chối.
     */
    gamesSoon: 'Trò chơi của chủ đề này đang được làm. Bé học thẻ từ trước nhé!',
    allLessonsDone: 'Bé đã học hết các bài của chủ đề này!',
  },

  /** Màn hình thẻ từ vựng. */
  flashcard: {
    title: 'Thẻ từ vựng',
    /** Nhãn đọc của thanh tiến độ: "Thẻ 2 trên 7". */
    progressLabel: 'Thẻ {{current}} trên {{total}}',
    /** Gợi ý ở dưới thẻ. Nhắc CẢ hai cách nghe, vì bàn phím không chạm được vào thẻ. */
    hint: 'Chạm vào thẻ hoặc bấm loa để nghe từ tiếng Anh',
    /** Nhãn đọc của nút loa. */
    hear: 'Nghe từ {{word}}',
    /**
     * ⭐ Nhãn nút NGẮN CÓ CHỦ ĐÍCH.
     *
     *   Bản đầu dùng "Thẻ trước" / "Thẻ tiếp". Trên khung 360px, hai nút chia đôi bề rộng nên mỗi
     *   nút còn ~150px — vừa đủ cho 5 chữ ở cỡ 24px, KHÔNG đủ cho 9 chữ. Kết quả đo được trên ảnh
     *   render thật: cả hai nút bị ngắt thành hai dòng ("Thẻ" / "trước"), và nút bị cao gấp đôi
     *   so với thiết kế.
     *
     *   "Trước" / "Tiếp" chỉ có 4–5 chữ, vẫn rõ nghĩa với bé 7 tuổi (mũi tên ← → đã nói hướng),
     *   và vừa đúng một dòng ở mọi cỡ màn hình.
     */
    prev: 'Trước',
    next: 'Tiếp',
    finish: 'Xong rồi!',
    doneTitle: 'Bé học xong bài rồi!',
    doneHint: 'Momo đã ghi nhận bài này vào sổ của bé.',
    backToTheme: 'Về chủ đề',
    noWords: 'Bài này chưa có từ nào',
  },

  lesson: {
    flashcards: 'Thẻ từ vựng',
    wordsInLesson: 'Bài này có {{count}} từ',
    completed: 'Bé đã học xong bài này!',
    /** Nút vào một trò chơi cụ thể trên màn chủ đề. */
    playGame: 'Chơi',
  },

  /**
   * --- Màn hình chơi game -------------------------------------------------
   *
   * ⚠️⚠️ TOÀN BỘ KHỐI NÀY PHẢI ĐỌC ĐƯỢC BỞI MỘT ĐỨA TRẺ 7 TUỔI VỪA LÀM SAI 6 CÂU.
   *
   *   Không có chữ nào trong khối này được phép:
   *     • nói số câu SAI (chỉ nói số câu ĐÚNG — cùng thông tin, khác cảm giác),
   *     • dùng từ "thua", "thất bại", "chưa đạt", "kém", "sai",
   *     • so sánh bé với bất kỳ ai khác.
   *
   *   Khi thêm chuỗi mới vào đây, đọc to nó lên và tự hỏi: *"nếu con mình vừa cố gắng hết sức
   *   mà chỉ được 1 sao, câu này làm con vui hay làm con xấu hổ?"*
   */
  game: {
    /** Nhãn đọc của nút thoát game. */
    exit: 'Thoát trò chơi',
    /** "Câu 3 / 10" — số thứ tự câu đang chơi. */
    roundOf: 'Câu {{current}} / {{total}}',
    /** Nhãn đọc của huy hiệu chuỗi 🔥. */
    streakLabel: 'Chuỗi {{count}} câu đúng liền nhau',
    /**
     * Hiện thay cho dãy ❤️ ở game không có khái niệm "trả lời sai" (`memory_match`).
     *
     * ⚠️ Nói rõ "chơi thoải mái" thay vì để trống: một khoảng trắng ở chỗ đáng lẽ có mạng sẽ
     *   làm bé tưởng màn hình bị lỗi.
     */
    noHearts: '💛 Chơi thoải mái nhé!',

    /** Nút nghe chính của game Nghe & Chạm. */
    listen: 'Nghe',
    listenAgain: 'Nghe lại',
    /** Gợi ý hiện sau 2 lần chạm chưa đúng. */
    hintTapGlowing: 'Chạm vào ô đang sáng nhé!',
    /** Khi dữ liệu không đủ từ để làm đủ số ô — xem ghi chú ở `pickDistractors`. */
    fewerOptions: 'Câu này có {{count}} lựa chọn',

    // --- G3 Điền chữ cái còn thiếu ---------------------------------------
    /** Nhãn đọc của cả từ đang điền dở — gộp lại để screen reader đọc MỘT lần, không đọc từng chữ. */
    wordWithBlanks: 'Từ còn chỗ trống',
    /**
     * Nhãn đọc của một phím chữ cái.
     * ⚠️ Phải là "chữ t", không phải "t": screen reader đọc một ký tự trơ ra thành một tiếng vô
     *   nghĩa, còn "chữ t" mới nói rõ đây là một phím bé bấm được.
     */
    letterName: 'chữ {{letter}}',
    /** Gợi ý ở game Điền chữ cái (hiện sau 2 lần chạm chưa đúng). */
    hintLetterGlowing: 'Chữ đang sáng là chữ bé cần điền đó!',
    hearWord: 'Nghe từ',

    // --- G4 Thú cưng trốn ở đâu? -----------------------------------------
    /** Nút đọc cả câu — CHỈ tiếng Anh. */
    hearSentence: 'Nghe câu',
    /** Nhắc bé phải chạm vào HÌNH, không phải chạm vào chữ giới từ. */
    tapTheRightPicture: 'Chạm vào hình đúng nhé!',
    /**
     * Nhãn đọc của bốn khung cảnh — CHỈ dùng cho `aria-label`, KHÔNG hiện trên màn hình.
     *
     * ⚠️ Không được vẽ bốn nhãn này ra thành chữ: làm vậy là biến trò "nghe và hiểu vị trí" thành
     *   trò "đọc chữ tiếng Việt rồi đối chiếu hình", và phần NGHE mất hẳn. Nhưng bé khiếm thị thì
     *   chỉ có kênh này để biết mỗi nút là gì, nên vẫn phải có.
     */
    position: {
      in: 'trong hộp',
      on: 'trên nắp hộp',
      under: 'dưới hộp',
      behind: 'sau hộp',
      nextTo: 'bên cạnh hộp',
      between: 'giữa hai hộp',
      inFrontOf: 'trước hộp',
    },
    /** Câu xác nhận sau khi bé chọn đúng — nói ra giới từ để bé gắn âm vừa nghe với chữ. */
    petIsHere: 'Đúng rồi! Con vật đang ở {{preposition}} cơ đấy!',

    // --- G7 Lật thẻ ghi nhớ ----------------------------------------------
    /** Nhãn đọc của một thẻ còn úp — bé khiếm thị cần biết đó là thẻ chưa lật, không phải thẻ trống. */
    cardFaceDown: 'Thẻ úp',
    /** Nhãn đọc của thẻ đã lật, kèm nội dung — nếu không, thẻ lật ra vẫn là "thẻ trống" với bé. */
    cardFaceUp: 'Thẻ đang mở: {{content}}',
    /** Số lượt lật đã dùng — hiện để bé thấy mình đang tiến bộ, KHÔNG phải để tính giờ. */
    flipCount: '{{count}} lượt lật',
    /** Lời nhắc ngắn ở đầu bàn: bé phải làm gì. */
    matchThePairs: 'Lật hai thẻ để tìm cặp giống nhau nhé!',
    /** "3/6 cặp" — tiến độ của lượt chơi. */
    pairsDone: '{{done}}/{{total}} cặp',

    // --- G9 Nối từ với hình ----------------------------------------------
    /** Bước 1: bé phải chọn một hình trước. */
    tapPictureFirst: 'Chạm vào một hình ở cột bên trái nhé!',
    /** Bước 2: sau khi đã chọn hình, bé chạm vào từ tương ứng. */
    nowTapWord: 'Giỏi lắm! Giờ chạm vào từ đúng ở cột bên phải',
    /**
     * Nhãn đọc của ô hình.
     * ⚠️ Nói ra TỪ tiếng Anh của hình: bé khiếm thị không thấy emoji, nên nếu chỉ đọc "hình" thì
     *   bé không có cách nào phân biệt sáu ô với nhau và trò chơi thành đoán mò.
     */
    pictureOf: 'Hình của từ {{word}}',
    /** Nhãn đọc của ô từ. */
    wordOf: 'Từ {{word}}',
    /** Hiện khi bé đã nối hết. */
    allPairsDone: 'Bé nối hết rồi! Giỏi quá!',
    /** Gợi ý sau vài lần nối chưa đúng — nhắc lại CÁCH chơi, không chỉ ra đáp án. */
    connectHint: 'Bé chạm một hình bên trái, rồi chạm từ đúng bên phải nhé!',

    /** Kết quả — ba câu khen theo số sao. KHÔNG có câu nào cho "0 sao" vì không bao giờ có 0 sao. */
    praiseThree: 'Tuyệt vời! Bé nhớ siêu giỏi!',
    praiseTwo: 'Giỏi lắm! Bé gần đạt 3 sao rồi!',
    /**
     * ⭐ Câu cho 1 sao là câu QUAN TRỌNG NHẤT trong cả file này.
     *   Nó là thứ bé đọc khi bé làm kém nhất. Nên nó nói về điều bé ĐÃ LÀM ĐƯỢC
     *   ("đã học thêm từ mới"), không nói về điều bé chưa làm được.
     */
    praiseOne: 'Bé đã học thêm từ mới rồi!',
    /** "Bé làm đúng 7 trên 10 câu" — CHỈ nói số đúng, không bao giờ nói số sai. */
    correctCount: 'Bé làm đúng {{count}} / {{total}} câu',
    starsEarned: 'Bé được {{count}} sao',
    scoreLabel: 'Điểm của bé',
    streakBonusLabel: 'Chuỗi {{count}} câu liền',
    newRecord: 'Kỷ lục mới của bé!',
    /** Kỷ lục CŨ của chính bé — không bao giờ là điểm của bé khác. */
    bestLabel: 'Kỷ lục trước',
    /**
     * --- Phần thưởng SERVER trả về ------------------------------------------
     * Chỉ hiện khi bé THỰC SỰ nhận được khoản nào đó (> 0). Xem `ResultOverlay`.
     * `{{count}}` là số lượng, luôn dương ở đây — nên câu đọc tự nhiên, không cần số ít/nhiều.
     */
    rewardsTitle: 'Bé nhận được',
    rewardStars: 'Bé nhận thêm {{count}} sao',
    rewardAcorns: 'Bé nhận thêm {{count}} hạt dẻ',
    rewardXp: 'Bé nhận thêm {{count}} điểm kinh nghiệm',
    backToLesson: 'Về bài học',

    /** Các trạng thái không chơi được. */
    notFoundTitle: 'Không tìm thấy trò chơi này',
    notFoundHint: 'Bé quay lại chọn một trò chơi khác nhé!',
    noWords: 'Trò này chưa có từ nào',
    soonTitle: 'Trò này đang được làm',
    /** Game cần micro mà trình duyệt không hỗ trợ — nói THẬT lý do. */
    unsupportedTitle: 'Máy này chưa chơi được trò nói',
    unsupportedHint: 'Trò này cần micro. Bé thử trên máy khác, hoặc chọn trò khác nhé!',
  },

  /**
   * --- Điều hướng chính (BottomNav) --------------------------------------
   * Nhãn NGẮN, tối đa 2 từ: mỗi mục chỉ rộng ~1/4 màn hình điện thoại, nhãn dài sẽ bị cắt
   * hoặc ép chữ nhỏ lại — mà chữ nhỏ là thứ không được phép có trong app này.
   */
  nav: {
    learn: 'Học',
    quests: 'Nhiệm vụ',
    shop: 'Cửa hàng',
    collection: 'Bộ sưu tập',
    pet: 'Thú cưng',
    parent: 'Bố mẹ',
    /** Nhãn cho screen reader, đọc đầy đủ ngữ cảnh thay vì chỉ "Học". */
    goToLearn: 'Sang màn hình học',
    goToQuests: 'Sang màn hình nhiệm vụ',
    goToShop: 'Sang cửa hàng',
    goToCollection: 'Sang bộ sưu tập',
    goToPet: 'Sang nhà thú cưng',
    goToParent: 'Sang khu vực phụ huynh',
    /**
     * Nhãn đọc của nút Hồ sơ nhà thám hiểm trên `TopBar` (M13, T071).
     * ⚠️ Không thêm một mục thứ sáu vào `BottomNav` — 5 mục là TRẦN của dự án (xem chú thích đầu
     *    `BottomNav.tsx`); điểm vào hồ sơ nằm ở thanh trên cùng.
     */
    goToProfile: 'Hồ sơ nhà thám hiểm',
    /**
     * Nhãn NGẮN cho nút quay về màn hình học.
     * ⚠️ Khác `goToLearn` ở trên: `goToLearn` là nhãn ĐỌC cho screen reader nên cần đầy đủ ngữ
     *   cảnh; nhãn này hiện trên mặt nút nên phải ngắn — chữ dài sẽ xuống dòng và làm nút cao
     *   gấp đôi, trông như lỗi.
     */
    backToLearn: 'Về trang học',
  },

  // --- Cài đặt ----------------------------------------------------------
  settings: {
    title: 'Cài đặt',
    muteSound: 'Tắt tiếng',
    unmuteSound: 'Bật tiếng',
  },

  // --- Hiệu ứng phần thưởng ---------------------------------------------
  effects: {
    /** Nhãn cho screen reader khi có phần thưởng hiện ra — hiệu ứng hình ảnh không đọc được. */
    rewardAnnounce: 'Bé vừa nhận được {{item}}!',
    unlocked: 'Mở khoá rồi!',
    tapToContinue: 'Chạm để tiếp tục',

    // --- Lên cấp (LevelUpOverlay) -----------------------------------------
    /**
     * ⚠️ Tiêu đề đọc là "Bé lên cấp" chứ KHÔNG phải "Chúc mừng lên cấp": xưng "bé" giữ đúng
     *    giọng của cả app (mọi câu đều nói với bé, không nói về bé ở ngôi thứ ba).
     */
    levelUp: 'Bé lên cấp {{level}}!',
    newRank: 'Danh hiệu mới: {{title}}',
    /**
     * Nhảy nhiều cấp một lượt là bình thường (xem ghi chú ở `LevelUpOverlay`). Nói ra để bé
     * không tưởng app bỏ sót cấp nào.
     */
    levelsJumped: 'Bé vượt {{count}} cấp trong một lượt!',
    /** Nhãn của khối quà. "Quà mừng" — không phải "phần thưởng", nghe như tiền công. */
    levelUpRewards: 'Quà mừng cấp mới',
    gotItem: 'Bé nhận được {{name}}',
    gotBadge: 'Bé được tặng một huy hiệu mới',
    gotSticker: 'Bé được tặng một nhãn dán mới',
  },

  // --- Tài khoản --------------------------------------------------------
  auth: {
    login: 'Đăng nhập',
    signup: 'Tạo tài khoản',
    logout: 'Đăng xuất',
    email: 'Email của bố mẹ',
    password: 'Mật khẩu',
    displayName: 'Tên hiển thị (không bắt buộc)',
    forgotPassword: 'Quên mật khẩu?',
    useRecoveryCode: 'Dùng mã khôi phục',
    recoveryCode: 'Mã khôi phục',
    newPassword: 'Mật khẩu mới',
    loginFailed: 'Email hoặc mật khẩu không đúng',
    signupSuccess: 'Đã tạo tài khoản cho bố mẹ!',
    recoveryCodeTitle: 'Lưu lại mã khôi phục này',
    recoveryCodeWarning:
      'Mã này chỉ hiện MỘT LẦN. Bố mẹ hãy chụp ảnh hoặc ghi lại ở nơi an toàn. Nếu quên mật khẩu, cần mã này để đặt lại.',
    savedIt: 'Tôi đã lưu rồi',
    parentalConsent: 'Tôi là phụ huynh và đồng ý cho con sử dụng RubyLingo',
    consentRead: 'Tôi đã đọc Chính sách quyền riêng tư',
  },

  child: {
    setup: 'Tạo hồ sơ cho bé',
    nickname: 'Biệt danh của bé',
    nicknameHint: 'Chỉ cần biệt danh thôi — không cần tên thật',
    age: 'Bé bao nhiêu tuổi?',
    avatar: 'Chọn bạn đồng hành cho bé',
    privacyNote: 'RubyLingo KHÔNG lưu ảnh, tên thật hay ngày sinh của bé.',
    switchChild: 'Đổi hồ sơ bé',
    addChild: 'Thêm bé',
  },

  // --- Phụ huynh --------------------------------------------------------
  parent: {
    gate: 'Khu vực phụ huynh',
    /**
     * ⚠️ ĐỘ DÀI PIN PHẢI NỘI SUY TỪ `PARENT_PIN_LENGTH`, KHÔNG viết số vào câu.
     *    Trước đây câu này ghim cứng "4". Nếu hằng số đổi (ví dụ PIN 6 số), câu hướng dẫn sẽ NÓI
     *    SAI độ dài và người lớn nhập 4 số rồi bị từ chối mà không hiểu vì sao — đúng kiểu lỗi
     *    "một nguồn sự thật bị chép ra hai chỗ". Trang truyền `{ count: PARENT_PIN_LENGTH }`.
     */
    gateHint: 'Nhập mã PIN {{count}} số',
    enterPin: 'Nhập mã PIN',
    openGate: 'Mở khoá',
    /**
     * ⚠️ CÂU TRUNG TÍNH, MỜI THỬ LẠI — KHÔNG trách móc. Người dùng ở đây là người lớn, nhưng luật
     *    ngôn ngữ của dự án áp cho MỌI chuỗi hiển thị: không phán xét. ("Sai rồi" là câu cấm.)
     */
    pinWrong: 'Mã PIN chưa đúng. Bố mẹ thử lại nhé.',
    /** Trang cổng PIN — dùng khi đọc trạng thái cổng thất bại (mất mạng): an toàn hơn là mở. */
    gateLoadFailed: 'Chưa kiểm tra được cổng. Bố mẹ thử lại nhé.',
    openTitle: 'Khu vực phụ huynh đã mở',
    openHint: 'Bố mẹ có thể xem báo cáo và chỉnh cài đặt trong thời gian tới.',
    setPin: 'Đặt mã PIN',
    /** ⚠️ Cùng luật như `gateHint`: độ dài nội suy từ `PARENT_PIN_LENGTH`, KHÔNG ghim cứng số. */
    setPinHint: 'Mã PIN gồm {{count}} chữ số, dùng để mở lại khu vực này.',
    pinSaved: 'Đã lưu mã PIN.',

    // --- Quên mã PIN (T072.1 / T072.2) -----------------------------------
    /** Liên kết trong trạng thái cổng đóng — đường LÙI khi phụ huynh quên PIN. */
    forgotPin: 'Quên mã PIN?',
    forgotPinTitle: 'Đặt lại mã PIN',
    forgotPinHint: 'Bố mẹ nhập mật khẩu tài khoản và mã PIN mới.',
    /** Nhãn ô mật khẩu tài khoản (KHÁC mã PIN). */
    accountPassword: 'Mật khẩu của bố mẹ',
    /** Nhãn ô mã PIN mới. */
    newPin: 'Mã PIN mới',
    /** Nhãn NHÌN THẤY của ô mã PIN mới — độ dài nội suy từ `PARENT_PIN_LENGTH`, không ghim cứng. */
    newPinLabel: 'Mã PIN mới ({{count}} số)',
    /** Nhãn nút gửi của form đặt lại. */
    resetPinSubmit: 'Đặt lại',
    /**
     * ⚠️ CÂU TRUNG TÍNH khi mật khẩu SAI — không phán xét, và KHÔNG tiết lộ tài khoản có PIN hay
     *    chưa. Cố ý KHÁC câu đăng nhập ("Email hoặc mật khẩu không đúng") vì ở đây chỉ có mật khẩu,
     *    không có ô email.
     */
    passwordWrong: 'Mật khẩu chưa đúng. Bố mẹ thử lại nhé.',
    /** Đặt lại xong — mời quay lại nhập mã mới (KHÔNG tự mở cổng). */
    pinResetDone: 'Đã đặt lại mã PIN. Bố mẹ quay lại và nhập mã mới nhé.',
    backToGate: 'Quay lại nhập mã PIN',
    report: 'Báo cáo học tập',
    thisWeek: 'Tuần này',
    wordsLearned: 'Số từ đã học',
    /**
     * ⚠️⚠️ NÓI RÕ "TỔNG CỘNG", KHÔNG ĐỂ ĐỌC LẪN VỚI BA SỐ THEO TUẦN ĐỨNG CẠNH.
     *   `wordsMastered` là con số TÍCH LUỸ (`word_progress` không lưu mốc "nhớ chắc từ lúc nào",
     *   nên server không thể lọc theo khoảng), còn `wordsLearned` / `starsEarned` /
     *   `lessonsCompleted` thì theo khoảng của báo cáo. Bốn con số nằm cạnh nhau mà không có nhãn
     *   phân biệt thì phụ huynh sẽ đọc "tuần này con nhớ chắc được 45 từ" — và kết luận về con
     *   mình từ một con số sai ngữ cảnh. Nên nhãn phải tự nói lên điều đó.
     */
    wordsMastered: 'Tổng cộng đã nhớ chắc',
    lessonsCompleted: 'Số bài đã xong',
    starsEarned: 'Sao đã nhận',
    strugglingWords: 'Từ bé còn hay nhầm',
    masteredWords: 'Từ bé đã nhớ chắc',
    noStruggling: 'Chưa có từ nào bé hay nhầm — tốt lắm!',

    // --- Báo cáo tuần (T073) ---------------------------------------------
    /** Nút mở báo cáo, nằm trong trạng thái cổng đã mở. */
    openReport: 'Xem báo cáo tuần',
    /** Nút quay lại từ báo cáo về khu vực phụ huynh. */
    backToParentArea: 'Quay lại khu vực phụ huynh',
    /** Khoảng thời gian của báo cáo — ngày truyền vào đã ở dạng `DD/MM`. */
    reportRange: 'Từ {{from}} đến {{to}}',
    /** Tiêu đề khối biểu đồ cột. */
    reportDailyTitle: 'Số từ học mỗi ngày',
    /**
     * ⚠️ NHÃN ĐỌC của MỘT CỘT biểu đồ. Biểu đồ là THỊ GIÁC; không có nhãn này thì phụ huynh khiếm
     *    thị không nhận được con số nào — cả khối thành một hình trang trí.
     */
    reportBarLabel: 'Ngày {{day}}: {{count}} từ',
    /** Tuần chưa có ngày nào học — trung tính, KHÔNG màn hình trắng. */
    reportEmptyDays: 'Tuần này chưa có ngày nào học. Số liệu sẽ hiện khi bé bắt đầu học nhé!',
    /** Tuần chưa có từ nào nhớ chắc — lời mời, không trách. */
    noMastered: 'Tuần này chưa có từ nào bé nhớ chắc. Bố mẹ ôn cùng con nhé!',
    /** Không đọc được báo cáo (lỗi mạng) — câu trung tính, không lộ chi tiết kỹ thuật. */
    reportLoadError: 'Chưa mở được báo cáo. Bố mẹ thử lại nhé!',
    settings: 'Cài đặt',

    // --- Màn Cài đặt phụ huynh (T074) ------------------------------------
    /** Nút mở màn Cài đặt từ trạng thái cổng đã mở. */
    openSettings: 'Mở cài đặt',
    /** Nút quay lại khu vực phụ huynh (dùng chung với màn báo cáo). */
    settingsTitle: 'Cài đặt của bé',
    /** Tốc độ đọc hiện tại, ví dụ "0.8×". Đơn vị đặt trong chuỗi để dịch được trọn câu. */
    speechRateValue: '{{rate}}×',
    /** Trạng thái công tắc, hiện bằng CHỮ (không chỉ màu) để người mù màu vẫn đọc được. */
    settingsOn: 'Bật',
    settingsOff: 'Tắt',
    /** Đã lưu xong một thay đổi. */
    settingsSaved: 'Đã lưu cài đặt.',
    /** Lưu hỏng (mạng) — trung tính, và giá trị đang hiện KHÔNG bị mất. */
    settingsSaveFailed: 'Chưa lưu được. Bố mẹ thử lại nhé!',
    /** Không đọc được cài đặt lúc mở màn. */
    settingsLoadError: 'Chưa mở được cài đặt. Bố mẹ thử lại nhé!',
    /** Khối quản lý hồ sơ các bé. */
    childrenTitle: 'Hồ sơ của các bé',
    /** Mở form sửa một hồ sơ. */
    editChild: 'Sửa hồ sơ',
    /** Đã lưu thay đổi hồ sơ. */
    childSaved: 'Đã lưu hồ sơ.',
    /** Chưa lưu được thay đổi hồ sơ. */
    childSaveFailed: 'Chưa lưu được hồ sơ. Bố mẹ thử lại nhé!',
    /** Mở bước xác nhận xoá hồ sơ (bước 1 của hai bước). */
    deleteChild: 'Xoá hồ sơ',
    /** Bước 1 của xoá hồ sơ — nêu TÊN để bố mẹ chắc chắn đang xoá đúng bé. */
    deleteChildConfirm: 'Xoá hồ sơ của {{name}}? Thao tác này không khôi phục được.',
    /** Bước 2 — xác nhận xoá thật. */
    deleteChildYes: 'Xoá hẳn',
    /** Không xoá được hồ sơ. */
    deleteChildFailed: 'Chưa xoá được hồ sơ. Bố mẹ thử lại nhé!',
    /** Thao tác quản trị cần cổng PIN — câu TRUNG TÍNH chỉ đường, không phải lỗi kỹ thuật. */
    gateRequiredHint: 'Thao tác này cần mở khu vực phụ huynh bằng mã PIN. Bố mẹ nhập mã PIN nhé!',
    /** Lối vào kín đáo từ hộp thoại đổi bé sang khu vực phụ huynh. */
    editProfilesInParentArea: 'Sửa hồ sơ…',
    sound: 'Âm thanh',
    music: 'Nhạc nền',
    speechRate: 'Tốc độ đọc',
    reducedMotion: 'Giảm hiệu ứng chuyển động',
    deleteAccount: 'Xoá tài khoản và toàn bộ dữ liệu',
    deleteWarning:
      'Thao tác này XOÁ VĨNH VIỄN tài khoản của bố mẹ và toàn bộ dữ liệu học tập của các bé. Không thể khôi phục.',
    deleteConfirmPhrase: 'XOÁ VĨNH VIỄN',
  },

  // --- Lỗi --------------------------------------------------------------
  error: {
    generic: 'Có lỗi xảy ra. Bố mẹ thử lại nhé.',
    network: 'Mất kết nối mạng. Tiến độ của bé đã được lưu và sẽ đồng bộ lại sau.',
    notFound: 'Không tìm thấy trang này',
    backHome: 'Về trang chủ',
    syncPending: 'Đang đồng bộ...',
    syncDone: 'Đã đồng bộ',
    syncFailed: 'Chưa đồng bộ được — sẽ thử lại',

    /**
     * Màn hình khi ứng dụng gặp lỗi không lường trước (ErrorBoundary).
     *
     * ⭐ Tông giọng quan trọng: bé có thể là người nhìn thấy màn hình này. Câu chữ phải nói
     *   rõ LỖI KHÔNG PHẢI DO BÉ, và tiến độ không mất — nếu không bé sẽ tưởng mình vừa làm
     *   hỏng gì đó hoặc mất hết thành quả.
     */
    boundaryTitle: 'Ôi, có gì đó chưa ổn',
    boundaryHint:
      'Lỗi này không phải do bé đâu. Tiến độ học vẫn được giữ nguyên. Bố mẹ thử mở lại giúp con nhé.',
    reload: 'Mở lại',
  },

  /**
   * Câu hiển thị theo MÃ LỖI của API (`ApiErrorCode`).
   *
   * Vì sao không hiển thị thẳng `message` server gửi: câu đó có thể bị sửa ở server bất cứ
   * lúc nào, và UI cần ổn định. Chỉ những mã cần câu RIÊNG cho giao diện mới có mặt ở đây;
   * các mã còn lại dùng `message` của server (đã là tiếng Việt, và cụ thể hơn).
   */
  apiError: {
    sessionExpired: 'Phiên đăng nhập đã hết hạn. Bố mẹ đăng nhập lại nhé.',
    rateLimited: 'Bố mẹ thử lại sau một lát nhé.',
    emailTaken: 'Email này đã được dùng để tạo tài khoản.',
    childNotFound: 'Không tìm thấy hồ sơ của bé.',
    serverBusy: 'Máy chủ đang bận. Bố mẹ thử lại nhé.',
    invalidInput: 'Dữ liệu gửi lên chưa hợp lệ.',
  },

  // --- Khả năng trình duyệt ---------------------------------------------
  capability: {
    noSpeech: 'Thiết bị này chưa có giọng đọc tiếng Anh. Bố mẹ có thể cài thêm trong cài đặt hệ thống.',
    noMic: 'Thiết bị này không hỗ trợ micro cho game luyện nói. Bé sẽ chơi game khác nhé!',
  },
} as const;

/** Kiểu của cây chuỗi — dùng để đảm bảo không gọi sai khoá. */
export type ViStrings = typeof vi;
