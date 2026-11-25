# Note Nhí — Spec v1.1

> Tên app tạm đặt, có thể đổi.
> Phần A dành cho thầy/cô đọc và góp ý (khoảng 5 phút). Phần B là chi tiết kỹ thuật để build.
>
> **Thay đổi ở v1.2 (25/11/2026)**
> - Cài đặt ban đầu do **người hỗ trợ làm hộ** qua "gói cài đặt". Giáo viên chỉ gửi dữ liệu và làm 3 việc bắt buộc trên máy/TV của mình (3.11, 3.12).
> - Bớt thao tác mỗi tiết: lớp gợi ý theo thời khoá biểu, bỏ qua điểm danh nếu đã điểm danh trong ngày, tự bật toàn màn hình kèm khoá `Esc`, nhấp đúp để sửa tên, nhớ lựa chọn lần trước.
> - Sao lưu tự động vào 1 thư mục (có thể là thư mục Google Drive / OneDrive trên máy). Nhập Excel thông minh hơn. Thêm "Lên lớp năm mới".
>
> **Thay đổi ở v1.1 (25/11/2026)**
> - Giao diện và luồng chơi được viết lại theo **mockup đã duyệt** (`mockup/lop-nhac-vui-mockup.html`). Chỗ nào spec và mockup lệch nhau thì **mockup là chuẩn**.
> - Thêm các yêu cầu để dùng thật trên lớp: mic, thuật toán công bằng, màn hình laptop 1366×768, chống crash giữa tiết.
> - Chốt tech stack.
> - Dữ liệu thiết kế sẵn để chuyển sang có server (mục 5): UUID v7, `ownerId`, bảng phẳng, có repository, backup cùng định dạng với API sau này.

---

# PHẦN A — Dành cho thầy/cô

## App này là gì?

Một trang web chạy trên laptop, chiếu lên TV trong lớp, giúp tiết Nhạc vui hơn và lớp tập trung hơn.
- **Không cần mạng** khi dùng trên lớp (chỉ cần mạng lần đầu cài).
- **Không cần đăng nhập**, mở lên là dùng.
- Thầy/cô điều khiển bằng **bàn phím laptop** (chủ yếu phím Space), học sinh nhìn TV.
- Âm thanh phát qua **loa TV**.
- Danh sách học sinh **chỉ lưu trên laptop**, không đưa lên mạng.

## Bản đầu tiên (v1) có gì?

| Trò / chức năng | Dùng để làm gì |
|---|---|
| 🪑 **Ghế âm nhạc** | Gọi trả bài. Mỗi lượt app chọn ngẫu nhiên 1 trong 4 kiểu (đèn chạy, đèn sân khấu, bóng nảy, máy gắp thú). Nhạc chạy, nhạc dừng ở ai thì bạn đó lên. Ưu tiên bạn **chưa được gọi trong tuần**, bỏ qua bạn vắng. Bạn được gọi mà vắng thì bấm **V**: app ghi vắng và quay lại ngay. |
| 🎈 **Thử thách im lặng** | Lấy lại trật tự. Laptop "nghe" độ ồn của lớp, ồn quá thì quả bóng mất mạng, hết mạng thì bóng nổ. Giữ yên đến hết giờ thì cả lớp thắng. App bắt quá gắt hoặc quá lỏng thì thầy/cô chỉnh ngay bằng phím **↑ ↓**. Bóng nổ thì thầy/cô **chọn cách xử lý trên màn hình** (chơi lại, cho qua, thử thách vui...) tuỳ mood. |
| ⏳ **Màn hình chờ** | Đếm ngược có nhạc khi chuyển hoạt động ("Chuẩn bị sách vở!"). |
| 📋 **Danh sách lớp** | Quản lý **21 lớp, xếp theo 5 khối**. Nhập danh sách bằng cách dán từ Excel/Zalo, điểm danh vắng nhanh trước tiết. |
| 🎶 **Nhạc nền dân ca** | Dùng bản **không lời (instrumental / piano)** các làn điệu dân ca quen thuộc (Bèo dạt mây trôi, Trống cơm, Lý cây bông...). Thầy/cô bấm "Thêm nhạc" để chọn file mp3 trên laptop, đánh dấu bài **chậm** (cho màn hình chờ) hoặc **vui** (cho ghế âm nhạc). Chưa nạp bài nào thì app tự chơi giai điệu ngũ cung có sẵn. |

**Cài đặt ban đầu: thầy/cô không phải làm gì.** Thầy/cô gửi danh sách lớp (và nhạc nếu có), người hỗ trợ nhập sẵn, kiểm tra tên rồi gửi lại **1 file "gói cài đặt"**. Thầy/cô mở app, kéo file đó vào là dùng được. Lần đầu lên lớp, app hướng dẫn kiểm tra loa, màn hình và mic trong khoảng 30 giây.

Các bản sau (v2, v3) sẽ có thêm: đoán bài hát, nhanh-đứng-chậm-ngồi, gõ đệm theo, đoán nhạc cụ, nốt nhạc rơi, hộp quà bí ẩn, và ghi nhận 👍👌💪 để hỗ trợ viết nhận xét cuối kỳ. Thư viện bài hát sẽ bám theo sách **Kết nối tri thức**.

## Một tiết học dùng app trông thế nào? (ví dụ, tiết 35 phút)

| Phút | Hoạt động | Dùng app |
|---|---|---|
| 0–2 | Vào lớp, ổn định | Mở app → app tự gợi ý **3A** (theo thời khoá biểu) → Enter → bấm tên các bạn vắng → Enter. **Màn hình chờ** đếm ngược 2 phút. |
| 2–5 | Kiểm tra bài cũ | **Ghế âm nhạc** gọi 2–3 bạn lên hát. |
| 5–25 | Dạy bài mới | (Thầy/cô dạy như bình thường.) Lớp ồn → bật **Thử thách im lặng** 30 giây. |
| 25–32 | Ôn tập, trình bày | **Ghế âm nhạc** (bật song ca nếu muốn) gọi các bạn lên biểu diễn. |
| 32–35 | Kết thúc | **Màn hình chờ** + nhạc khi dọn đồ. |

Mỗi trò chỉ mất khoảng **1–3 phút** để không lấn thời gian dạy.

## Đã thống nhất với thầy/cô

| Câu hỏi | Trả lời | Ảnh hưởng tới app |
|---|---|---|
| Dạy bao nhiêu lớp? | 21 lớp, đủ 5 khối | Trang chủ xếp lớp theo khối, chuyển lớp nhanh |
| Gọi học sinh bằng gì? | Gọi **tên** | Màn hình chỉ hiện tên, không hiện số thứ tự |
| Chia tổ? | Có ~4 tổ nhưng xoay liên tục theo chỗ ngồi, mỗi lớp mỗi khác | **Bỏ** tính năng tổ ở v1 |
| Bóng nổ thì sao? | Cho nhiều lựa chọn để giáo viên chọn tuỳ mood | Màn hình bóng nổ có 4 nút lựa chọn |
| Mic laptop? | Hoạt động bình thường | Giữ nguyên Thử thách im lặng |
| Nhạc nền? | Nhạc dân ca dễ nghe, bản không lời (instrumental / piano) | Nạp file mp3 từ laptop vào app, chia nhóm chậm / vui |
| Việc gì mất thời gian? | Nghiệp vụ giáo án | Để dành cho giai đoạn sau |
| Giao diện | Đã duyệt mockup | Mockup là chuẩn khi build |

## Thầy/cô chỉ cần gửi

- [ ] **Danh sách học sinh 21 lớp.** File gì cũng được: Excel xuất từ phần mềm của trường, Word, hoặc ảnh chụp.
- [ ] *(Không bắt buộc)* **Thời khoá biểu môn Nhạc.** Có thì ngay tuần đầu app đã tự gợi ý đúng lớp. Không có thì app tự học sau vài tuần.
- [ ] *(Không bắt buộc)* **Vài file mp3 dân ca không lời** (khoảng 3 bài chậm + 3 bài vui). Không có thì app dùng giai điệu có sẵn.

Phần còn lại người hỗ trợ lo hết. Buổi đầu trên lớp, thầy/cô làm theo màn hình kiểm tra nhanh (loa, góc màn hình, mic), mất khoảng 30 giây.

---

# PHẦN B — Chi tiết kỹ thuật

## 0. Nguyên tắc

- **Mockup là chuẩn** về giao diện, luồng, thời lượng animation và âm thanh. Spec mô tả lại để build và test, không tự đặt ra hành vi khác.
- Các mục đánh dấu **[Vận hành]** là yêu cầu thêm để dùng thật trên lớp (mockup chưa cần). Bắt buộc có ở v1.

## 1. Bối cảnh & ràng buộc

| Yếu tố | Giá trị | Hệ quả thiết kế |
|---|---|---|
| Thiết bị | Laptop Windows → HDMI → TV | Layout 16:9. **Màn hình gốc phải hỗ trợ: 1366×768** (laptop trường học phổ biến), sau đó là 1920×1080. Điều khiển bằng bàn phím. Chạy trên Chrome/Edge. |
| TV | Có thể bị cắt mép (overscan) | Cài đặt **"Lề an toàn TV"** thêm 4% lề quanh toàn app |
| Âm thanh | Qua loa TV (HDMI) | Có nút test âm thanh; âm lượng chỉnh trong app |
| Tiết học | 35–40 phút | Mỗi game ≤ 3 phút; mở app → vào game ≤ 3 thao tác |
| Sĩ số | ~40 học sinh | Lưới 40 tên **vừa 1 màn hình, không cuộn** |
| Số lớp | 21 lớp, 5 khối (~840 học sinh) | Chọn lớp nhanh theo khối; nhập danh sách hàng loạt phải nhanh |
| Cách gọi | Gọi bằng tên | Chỉ hiện tên gọi, không hiện số thứ tự |
| Mạng | Không đảm bảo | PWA offline-first, dữ liệu lưu IndexedDB, **font và mọi tài nguyên đóng gói kèm app** |
| Đối tượng | Học sinh tiểu học | Màu sắc tươi, hiệu ứng vui, không mang tính bêu xấu |

**Quy tắc hiển thị trên TV [Vận hành]**
- Ở 1366×768 toàn màn hình, các màn Điểm danh và Ghế âm nhạc hiển thị đủ **40 ô tên (8 cột × 5 hàng) mà không có thanh cuộn**. Chiều cao ô co theo chiều cao màn hình (khoảng 8.4vh, từ 54 đến 84px). Header của màn Ghế âm nhạc cũng co theo (linh vật ~12vh).
- Tên trong lưới: cỡ chữ theo mockup (~2vw, từ 21 đến 33px). Tên dài **tự thu nhỏ để vừa 1 dòng**, không xuống dòng, không cắt chữ.
- Tên phóng to ở kết quả: ~9vw (60–150px).
- Tương phản cao: chữ màu mực `--ink` trên nền sticker sáng.
- Tiêu chí cuối cùng là **đọc được từ cuối lớp** (xem mục 8).

## 2. Danh sách màn hình & luồng

```
Lần đầu mở app (chưa có dữ liệu):
[Chào mừng: mở gói cài đặt] ──> [Trang chủ]
Lần đầu vào tiết:
[Trang chủ] ──> [Kiểm tra nhanh trên TV (~30 giây, bỏ qua được)] ──> [Điểm danh] ──> ...

Thường ngày:
[Trang chủ: lớp gợi ý, Enter] ──> [Điểm danh]* ──Enter──> [Launcher]
        │                            ▲  D                ├─ 1. Ghế âm nhạc
        │                            └───────────────────├─ 2. Thử thách im lặng
        └─> [Quản lý lớp] [Nhạc nền] [Cài đặt]            └─ 3. Màn hình chờ
                                                           Esc: quay về launcher
* Hôm nay đã điểm danh lớp này rồi thì bỏ qua, vào thẳng Launcher.
```

Thanh trên cùng (mọi màn): logo + linh vật nhỏ · pill tên lớp (ẩn ở trang chủ) · nút **Tiếng: bật/tắt (M)** · nút **Toàn màn hình (F)**.

## 3. Chức năng chi tiết

### 3.0 Trang chủ: chọn lớp
- Linh vật vẫy tay, nhãn ngày hôm nay (vd "Thứ ba, 25/11"), tiêu đề "Hôm nay mình vào lớp nào nhỉ?".
- **Lớp gợi ý**: 1 thẻ to nhất trang, kèm lý do (vd "Thứ ba tiết 2 · theo thời khoá biểu"). Khi chưa gõ gì, **`Enter` vào thẳng lớp gợi ý**. Cách chọn lớp gợi ý:
  1. Có thời khoá biểu (`ScheduleSlot`) mà giờ hiện tại nằm trong khoảng [giờ bắt đầu − 15 phút, giờ bắt đầu + 40 phút] cùng thứ → gợi ý lớp đó.
  2. Không có thì tự học từ lịch sử: các `Session` trong 28 ngày gần nhất, cùng thứ, `startedAt` lệch không quá ±30 phút → lớp xuất hiện nhiều nhất (hoà thì lấy lần gần nhất).
  3. Không có dữ liệu thì không gợi ý, chỉ hiện "Lớp vừa dạy".
- **Gõ tên lớp**: gõ phím chữ/số, ô hiển thị 2 ký tự cuối (vd `3A`), `Enter` vào lớp, `Backspace` xoá, `Esc` xoá hết. Gõ sai thì toast "Không có lớp …".
- **Vào lớp thì tự bật toàn màn hình**, kèm khoá phím `Esc` (xem 3.10). Thầy/cô không phải nhớ bấm `F`.
  - Ở trang chủ, phím `F` và `M` dùng để gõ tên lớp, **không** bật toàn màn hình / tắt tiếng.
- **"Lớp vừa dạy"**: 3 chip, tô màu theo khối.
- 21 lớp xếp thành **5 hàng theo khối**. Mỗi khối có 1 màu: 1 hồng, 2 cam, 3 vàng, 4 xanh lá, 5 xanh trời. Mỗi nút lớp hiện tên lớp và sĩ số.
- Chân trang: **Quản lý lớp · Nhạc nền · Cài đặt**.
- Có bản cập nhật app thì hiện thông báo **chỉ ở trang chủ** (xem 3.10).

### 3.1 Quản lý lớp & học sinh
*(Mockup chưa vẽ màn này. Làm theo cùng phong cách sticker. Màn này chủ yếu do **người hỗ trợ** dùng khi chuẩn bị gói cài đặt, xem 3.11.)*
- **Kéo thả file Excel (.xlsx/.xls/.csv) vào bất kỳ đâu trên màn hình.** App tự nhận 2 kiểu file:
  - *Nhiều sheet*: mỗi sheet là 1 lớp, tên sheet là tên lớp.
  - *1 sheet có cột "Lớp"*: kiểu file trường hay xuất từ phần mềm quản lý. App nhóm học sinh theo cột này.
  - App tự tìm dòng tiêu đề và cột họ tên (cột "Họ và tên", hoặc gộp 2 cột "Họ đệm" + "Tên"). Bỏ qua STT, ngày sinh, giới tính, dòng trống, dòng tổng.
- **Dán text** (textarea), mỗi dòng 1 học sinh. Hỗ trợ dạng `Nguyễn Văn An`, `12. Nguyễn Văn An`, `12<TAB>Nguyễn Văn An`. Được dán **nhiều lớp một lần**: dòng có dạng `Lớp 3A` / `3A:` được hiểu là mốc bắt đầu lớp mới.
- Số thứ tự nếu có thì chỉ dùng để sắp xếp, **không hiển thị**. Chuẩn hoá Unicode về NFC (dán từ Zalo/Word hay lẫn dạng tổ hợp).
- **Khối tự suy từ tên lớp** (`3A` → khối 3). **Năm học tự suy từ ngày hiện tại**: từ tháng 8 trở đi là năm học mới. Không bắt thầy/cô chọn.
- **Màn xem trước trước khi lưu**: liệt kê từng lớp, sĩ số và tên hiển thị. Đánh dấu chỗ đáng ngờ: tên trùng, dòng chỉ có 1 chữ, lớp dưới 15 hoặc trên 50 bạn. Sửa được ngay trên màn này. Cuối cùng bấm **Xác nhận** một lần.
- **Lên lớp năm mới** (cần có trước tháng 8/2027): 1 nút tạo các lớp của năm học mới từ năm cũ (3A → 4A, giữ nguyên học sinh; khối 5 ra trường). Lớp và lịch sử năm cũ giữ nguyên.
- **Tên hiển thị** tự sinh = tên gọi (chữ cuối). Trùng tên trong lớp thì thêm tên đệm (vd "Minh An", "Bảo An"). Vẫn trùng thì thêm chữ cái đầu của họ (vd "N. Minh An"). Thầy/cô sửa tay được.
- Sửa / xoá / thêm từng học sinh. Học sinh chuyển lớp/nghỉ học thì **lưu trữ** (`archived`) chứ không xoá, để giữ lịch sử gọi.

### 3.2 Điểm danh
- Lưới toàn bộ học sinh, chỉ hiện tên. Bấm vào ô để bật/tắt **vắng**: ô mờ, viền nét đứt, có nhãn đỏ "vắng".
- Pill "Có mặt x/y".
- `Enter` hoặc nút **Vào tiết** → Launcher. `Esc` → trang chủ.
- Trạng thái vắng chỉ áp dụng cho **buổi hôm nay**. Mặc định cả lớp có mặt.
- **Hôm nay đã điểm danh lớp này rồi** (vd quay lại sau giờ ra chơi) thì bỏ qua màn này, vào thẳng Launcher, kèm toast "Đã điểm danh lúc 8:05 · bấm D để sửa".
- **Nhấp đúp vào 1 tên để sửa tên hiển thị** ngay tại chỗ (`Enter` lưu, `Esc` huỷ), không phải vào Quản lý lớp. Nhấp đơn vẫn là bật/tắt vắng: chờ khoảng 220ms để phân biệt với nhấp đúp.
- *(Bỏ "gõ số thứ tự để đánh dấu vắng" vì app không hiển thị số thứ tự.)*

### 3.3 Launcher tiết học
- Nhãn: "Lớp 3A · Có mặt 38/40". Tiêu đề "Chơi gì đây ta?".
- 3 thẻ game to, nghiêng nhẹ, có số `1`–`3` ở góc. Phím `1`–`3` chọn game.
- Mục **"Sắp có ở bản sau"**: 6 thẻ viền đứt, không bấm được (Đoán bài hát, Đoán nhạc cụ, Nhanh đứng chậm ngồi, Gõ đệm theo, Nốt nhạc rơi, Hộp quà bí ẩn).
- `D` → sửa điểm danh, `Esc` → đổi lớp (trang chủ).

### 3.4 Game: Ghế âm nhạc 🪑

**Màn hình chính**
- Lưới các bạn **có mặt**. Bạn đã được gọi trong 7 ngày có dấu ✓.
- Pill "Chưa được gọi tuần này: N". Nút **Song ca (S)**. Nút **Quay (Space)**, đổi chữ theo trạng thái: Quay → Dừng nhạc → Tua nhanh.
- Linh vật Nốt Nhí và bong bóng thoại dẫn dắt từng bước.

**Luồng 1 lượt**
1. `Space` → **chọn kết quả trước** bằng thuật toán công bằng (bên dưới). Animation chỉ là phần hiển thị.
2. **Giới thiệu kiểu quay (~1.7 giây):** banner lướt qua tên các kiểu kèm tiếng tích, rồi dừng ở kiểu được chọn kèm tiếng chuông. Kiểu được chọn ngẫu nhiên và **không trùng kiểu của lượt trước**.
3. **Nhạc chạy:** phát nhạc nhóm *vui*, tự dừng sau 4–7 giây ngẫu nhiên. Với bạn thứ 2 khi song ca là 1.8–2.8 giây. `Space` = thầy/cô dừng nhạc sớm.
4. **Nhạc dừng → chậm dần:** mỗi bước phát 1 nốt ngũ cung (đi lên rồi đi xuống). `Space` = tua nhanh, hiện luôn kết quả.
5. **Cú lừa (50% số lượt):** dừng ở ô ngay cạnh, trống dồn ~1.4 giây, bong bóng "Dừng ở… ?", rồi "Ơ!" kèm tiếng *boing* và nhích sang ô trúng.
6. Ô trúng nháy 3 lần → sau 0.7 giây hiện **overlay kết quả**: tên gọi rất to trên nền vàng (song ca thì bạn thứ 2 nền hồng), tên đầy đủ nhỏ bên dưới, tia sáng xoay, confetti, tiếng *ta-da*, linh vật nhảy mừng.
7. Trên overlay:
   - `Space` **Tiếp tục**: về lưới.
   - `R` **Quay lại**: lượt này ghi `skipped`, quay lại và loại bạn vừa ra.
   - `V` **Bạn này vắng** *(chỉ hiện khi gọi 1 bạn)* **[Vận hành]**: đánh dấu bạn đó vắng hôm nay, lượt ghi `absent`, quay lại ngay.
   - `Esc`: đóng overlay.

**4 kiểu quay** (cùng nhịp: nhạc chạy → dừng nhạc → chậm dần → (cú lừa) → trúng)

| Kiểu | Khi nhạc chạy | Khi chậm dần / cú lừa |
|---|---|---|
| **Đèn chạy** | Ô sáng chạy theo hình rắn (hàng lẻ trái→phải, hàng chẵn phải→trái), có đuôi sao chổi 3 ô, linh vật nhỏ cưỡi trên ô sáng | Chậm dần ít nhất 14 bước. Cú lừa = dừng ô trước rồi nhích 1 ô |
| **Đèn sân khấu** | Cả lưới tối lại, một vòng đèn trượt mượt giữa các ô | Lượn quanh ô trúng, vòng gần dần. Cú lừa = dừng ô bên cạnh rồi trượt sang |
| **Bóng nảy** | Quả bóng ♪ nảy giữa các ô gần nhau, ô bị nảy trúng lún xuống | Nảy thấp dần, tiến lại gần ô trúng. Cú lừa = dừng ô bên cạnh rồi lăn sang |
| **Máy gắp thú** | Càng gắp chạy ngang qua lại | Dừng ở cột của ô trúng, thả xuống từng hàng, gắp lên, lắc lắc rồi trúng. Cú lừa = dừng ở hàng trên rồi "xuống thêm 1 hàng" |

**Song ca (`S`)**: chọn 2 bạn khác nhau. Chạy 2 lượt liền nhau, lượt 2 tiếp tục từ vị trí của lượt 1. Overlay hiện cả 2 tên.

**Thuật toán công bằng [Vận hành]**
- Chỉ chọn trong các bạn **có mặt** (không vắng, không `archived`).
- `lastCalledAt(học sinh)` = thời điểm muộn nhất trong `CallLog` có `status = 'called'` của lớp đó.
- Nhóm ưu tiên = các bạn **chưa được gọi trong 7 ngày**. Nhóm còn người thì chọn ngẫu nhiên đều trong nhóm.
- Nếu ai cũng đã được gọi trong 7 ngày thì chọn ngẫu nhiên trong những bạn có `lastCalledAt` **cũ nhất** (xoay vòng).
- Song ca: chọn bạn thứ 2 theo cùng luật, loại bạn thứ nhất.
- Mỗi lần chọn ghi 1 `CallLog` **ngay lập tức** (không chờ hết animation). Bấm `R`/`V` thì **đổi `status` thành `skipped`/`absent`**, không xoá bản ghi.
- Trường hợp biên: không còn ai có mặt thì toast "Không còn bạn nào để gọi". Bật song ca mà chỉ còn 1 bạn thì chỉ gọi 1 bạn.

### 3.5 Game: Thử thách im lặng 🎈

**Màn chuẩn bị**: chọn thời gian **30 giây / 1 phút / 2 phút**, độ khó **Dễ / Vừa / Khó** (mặc định 30 giây, Vừa). Nút **Bắt đầu (Space)**. Linh vật làm động tác "suỵt".
- **App nhớ lựa chọn lần trước** (lưu trong `UserPrefs`). Thường chỉ cần bấm `Space`. Thời lượng và lời nhắn của Màn hình chờ cũng được nhớ như vậy.

**Luồng**
1. **Hiệu chỉnh 3 giây**: bong bóng thoại "Mình đang nghe thử… 3, 2, 1". Đo độ ồn nền rồi đặt ngưỡng (xem Kỹ thuật). Vạch ngưỡng chỉ hiện sau khi đo xong.
2. Bắt đầu: tiếng tích, "Bắt đầu! Suỵt…".
3. Màn chơi gồm 3 cột:
   - Cột trái: **3 trái tim**, đồng hồ đếm ngược to, **thanh đo độ ồn** có vạch đen là ngưỡng (xanh khi yên, đỏ khi vượt ngưỡng).
   - Cột giữa: **quả bóng có mặt cười**, to dần từ 75% lên 110% theo thời gian.
   - Cột phải: linh vật và bong bóng thoại ("Suỵt… giỏi lắm!" / "Ồn quá à!").
4. Ồn vượt ngưỡng **cộng dồn > 1 giây** (khi hết ồn thì bộ đếm giảm gấp đôi tốc độ) thì mất 1 mạng: bóng rung, tiếng *bíp*, mặt bóng mếu 1.5 giây, "Còn N mạng thôi!". Sau đó **miễn trừ 2 giây**.
5. Hết 3 mạng: bóng **nổ** (hình "BÙM!", tiếng *pop*), linh vật buồn. Sau 0.9 giây hiện **4 lựa chọn** (phím `1`–`4`):
   - 🔁 **Chơi lại**: cùng thời gian, cùng độ khó.
   - 🔥 **Chơi lại, khó hơn**: tăng 1 bậc **cả** thời gian (30 giây→1 phút→2 phút) **và** độ khó (Dễ→Vừa→Khó). Toast báo mức mới.
   - 🎲 **Thử thách vui**: quay ngẫu nhiên 14 lần chậm dần, rồi *ta-da* ra 1 thử thách cho cả lớp. Sau đó có nút **Xong, chơi lại (1)** / **Cho qua (4)**.
   - ➡️ **Cho qua**: về launcher.
6. Hết giờ mà còn mạng: **thắng**. Bóng bay lên, nhạc chiến thắng, confetti, "Cả lớp giỏi quá!", nút **Chơi tiếp (Space)** / **Về (Esc)**.
7. `Esc` khi đang chơi / đang ở overlay thì về màn chuẩn bị. `Esc` ở màn chuẩn bị thì về launcher.

Thử thách vui mặc định: *Cả lớp hát lại 1 câu bài vừa học · Vỗ tay theo nhịp 8 lần · Đứng lên ngồi xuống 5 lần · Thì thầm hát 1 câu · Giữ tượng 10 giây · Cả lớp cùng "suỵt" thật nhỏ 3 lần*. Thầy/cô sửa được trong Cài đặt.

**Kỹ thuật mic [Vận hành]**
- Lấy mic bằng:
  ```ts
  getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
  ```
  **Bắt buộc tắt cả 3.** Nếu để mặc định, Chrome sẽ tự cân âm lượng (AGC): lớp càng ồn thì mic càng tự giảm, và game gần như không thể thua.
- Đo: `AnalyserNode` → RMS mỗi frame → **dBFS** = `20·log10(rms)` → làm mượt ~300ms.
  - Thanh đo hiển thị dải **−70 dBFS → −10 dBFS** quy về 0–100%.
- Hiệu chỉnh: độ ồn nền = **trung vị** các mẫu trong 3 giây (trung vị chống được 1 tiếng động lẻ).
  - `ngưỡng = nền + biên độ`. Biên độ theo độ khó: **Dễ +20 dB · Vừa +14 dB · Khó +8 dB**.
  - Kẹp ngưỡng trong khoảng **−52 → −16 dBFS**.
  - *Đây là giá trị khởi điểm, chỉnh lại sau buổi thử trên lớp thật.*
- Nếu độ ồn nền lúc đo cao bất thường (> −46 dBFS) thì toast "Lúc đo lớp còn hơi ồn, ngưỡng đã được giới hạn. Chỉnh bằng ↑ ↓".
- **Chỉnh ngưỡng khi đang chơi: `↑` nới (+2 dB), `↓` siết (−2 dB)**. Vạch ngưỡng di chuyển theo, kèm toast.
- Xử lý lỗi:
  - Bị từ chối quyền mic: màn hướng dẫn bật lại quyền (ảnh chụp icon 🔒 trên thanh địa chỉ).
  - Không có mic: làm mờ thẻ game, kèm ghi chú.
  - Mic bị ngắt giữa chừng: tạm dừng game và báo.
- Trong lúc game chạy, app **không phát nhạc nền** (tránh mic thu tiếng loa). Không ghi âm, không lưu âm thanh. Tắt mic (`track.stop()`) ngay khi rời game.

### 3.6 Màn hình chờ ⏳
- Thời lượng: **10 giây (thử) / 1 / 2 / 3 / 5 phút**, mặc định 2 phút. Lời nhắn tối đa 60 ký tự, mặc định "Chuẩn bị sách vở nhé!".
- Khi chạy: banner lời nhắn (nền hồng, hơi nghiêng), **vòng tròn đếm ngược** (xanh, 10 giây cuối chuyển đỏ), linh vật lắc lư.
- Nhạc nhóm *chậm*, fade-in 1.5 giây, lặp nếu hết bài.
- **10 giây cuối**: số giây to trên nền vàng, nhịp đập, mỗi giây 1 tiếng tích, linh vật nhảy.
- Hết giờ: nhạc fade-out 1.5 giây, tiếng chuông, banner đổi thành "Hết giờ rồi!", linh vật nhảy mừng.
- `Space` tạm dừng / tiếp tục (đồng hồ mờ khi tạm dừng). `+`/`-` cộng/trừ 30 giây (tối thiểu 1 giây). `Esc` về launcher.

### 3.7 Cài đặt
*Mọi mục đều có giá trị mặc định hợp lý. Thầy/cô không bao giờ **bắt buộc** phải vào đây.*
- Âm lượng tổng. Nút **Test loa** (phát 1 đoạn nhạc ngắn).
- Nút **Test mic**: hiển thị thanh độ ồn trực tiếp theo đúng thang dBFS của game.
- **Lề an toàn TV** (bật/tắt) **[Vận hành]**. Nút **"Chạy lại kiểm tra trên TV"** (3.12).
- Danh sách **thử thách vui** (thêm/sửa/xoá).
- **Thời khoá biểu** (không bắt buộc): bảng thứ × giờ bắt đầu × lớp, dùng cho lớp gợi ý.
- **Sao lưu tự động**: chọn **1 thư mục** một lần duy nhất (File System Access API, handle lưu trong IndexedDB).
  - App ghi file `note-nhi-backup.zip` sau mỗi buổi dạy (khi về trang chủ), tối đa 1 lần/ngày, giữ 7 bản gần nhất.
  - Nếu thư mục đó nằm trong **Google Drive / OneDrive trên máy** thì backup tự lên cloud mà app không cần đăng nhập.
  - Chrome hỏi lại quyền thì hiện nút "Cho phép sao lưu" ở trang chủ, không chặn việc dạy.
  - Chưa chọn thư mục thì cứ 14 ngày nhắc 1 lần ở trang chủ.
- **Xuất / nhập** (cùng 1 định dạng `.zip`, mục 5.3):
  - **Backup**: dữ liệu, có tuỳ chọn kèm nhạc.
  - **Gói cài đặt**: luôn kèm nhạc (3.11).
- **Xoá toàn bộ dữ liệu trên máy này** (phải gõ chữ `XOA` để xác nhận). Người hỗ trợ dùng sau khi chuẩn bị xong gói.

### 3.8 Âm thanh & nhạc nền 🎶

**Nhạc từ file**: bản thu **không lời (instrumental / piano)** dạng mp3, do giáo viên tự nạp.

| Nhóm | Dùng cho | Bài gợi ý |
|---|---|---|
| **Chậm, nhẹ** (`calm`) | Màn hình chờ | Bèo dạt mây trôi, Cò lả, Ru con Nam Bộ |
| **Vui, nhanh** (`lively`) | Ghế âm nhạc | Trống cơm, Lý cây bông, Lý ngựa ô, Inh lả ơi |

- Màn Nhạc nền có **2 ô thả to: "Chậm, nhẹ" và "Vui, nhanh"**. Kéo cả loạt file `.mp3` / `.m4a` vào ô nào thì cả loạt thuộc nhóm đó (hoặc bấm vào ô để chọn file). File được lưu vào IndexedDB dạng Blob, dùng offline.
- Tên bài lấy từ tên file (bỏ đuôi, bỏ số thứ tự đầu, thay `_`/`-` bằng dấu cách).
- Mỗi bài: sửa tên, kéo sang nhóm kia, nghe thử, xoá.
- Gọi `navigator.storage.persist()` (~5 MB/bài, 10 bài ≈ 50 MB).

**Khi phát**
- Ghế âm nhạc: chọn ngẫu nhiên 1 bài nhóm vui, **phát từ vị trí ngẫu nhiên** để học sinh không đoán được lúc dừng. Dừng = cắt đột ngột.
- Màn hình chờ: phát bài nhóm chậm, fade-in/fade-out, lặp.
- **Chưa có bài nào** → dùng **giai điệu ngũ cung tự sinh bằng Web Audio** như trong mockup:
  - Nhóm vui: 140 BPM, có bass và trống.
  - Nhóm chậm: 66 BPM, sine nhẹ, có nốt nền.

**Hiệu ứng âm thanh** (tự sinh, không dùng file): ta-da, bíp, pop (bóng nổ), chiến thắng, tích, boing (cú lừa), chuông, nốt ngũ cung từng bước, trống dồn.

**Bản quyền:** dùng cá nhân trên lớp, không thương mại. File nhạc **không** đưa vào repo hay bản deploy.

### 3.9 Phong cách & linh vật (theo mockup)
- Phong cách **"sổ sticker"**: khối viền mực đậm 3px, bóng cứng 4px, nghiêng nhẹ. Nền trời sáng có nốt nhạc bay mờ. Chỉ có giao diện sáng (dành cho TV lớp học).
- Bảng màu (token): `--bg #e8f4ff · --ink #2b2350 · --sun #ffd95a · --pink #ffaccb · --mint #86e6bd · --sky #95d8ff · --orange #ffc17e · --lilac #cbbcff · --coral #ff6b6b`.
- Font **Nunito** (600–900, subset tiếng Việt), **đóng gói kèm app**.
- Linh vật **Nốt Nhí** (nốt nhạc màu vàng, SVG) có 8 trạng thái: `idle, wave, dance, cheer, shh, noisy, sad, calm`.
- Tôn trọng `prefers-reduced-motion` (tắt animation, tắt confetti).

### 3.10 Ổn định khi dùng trên lớp [Vận hành]
- **Error boundary** bọc từng màn hình: lỗi thì hiện "Ối, có lỗi nhỏ" kèm nút **Về trang chủ** / **Tải lại**. Không bao giờ để màn trắng trên TV.
  - Dữ liệu (điểm danh, CallLog) ghi xuống IndexedDB ngay khi thay đổi, nên tải lại không mất gì.
  - Lỗi được ghi vào nhật ký lỗi cục bộ (không gửi đi đâu), xuất được cùng backup.
- **Screen Wake Lock**: giữ màn hình sáng khi đang ở bất kỳ màn nào ngoài trang chủ. Xin lại khi tab được mở lại (`visibilitychange`).
- **Cập nhật PWA không làm gián đoạn tiết học**: service worker ở chế độ `prompt`, không tự tải lại. Thông báo "Có bản mới · Cập nhật" **chỉ hiện ở trang chủ**.
- **Toàn màn hình + phím `Esc`**: khi đang toàn màn hình, trình duyệt dùng `Esc` để thoát toàn màn hình nên app không nhận được phím này, mà app lại dùng `Esc` để "quay lại".
  - Cách xử lý: khi bật toàn màn hình, gọi `navigator.keyboard.lock(['Escape'])` (Chrome/Edge hỗ trợ). Bấm `Esc` lúc đó là "quay lại", **giữ `Esc` ~2 giây** mới thoát toàn màn hình.
  - Trình duyệt không hỗ trợ khoá phím thì dùng `Backspace` làm phím "quay lại" dự phòng ở các màn game.

### 3.11 Cài đặt ban đầu, người hỗ trợ làm hộ
**Nguyên tắc:** giáo viên chỉ **gửi dữ liệu**. Việc gì làm hộ được thì người hỗ trợ làm. Giáo viên chỉ tự tay làm những việc **bắt buộc phải làm trên máy/TV của họ**, và những việc đó có màn hướng dẫn riêng.

**Phía người hỗ trợ** (trên máy của mình, dùng 1 profile trình duyệt riêng):
1. Nhận từ giáo viên: danh sách lớp (file gì cũng được; ảnh hay Word thì gõ hoặc dán lại thành text), thời khoá biểu (nếu có), mp3 (nếu có).
2. Mở app → **Quản lý lớp**: kéo file vào → xem trước, sửa tên đáng ngờ → Xác nhận (3.1).
3. **Cài đặt → Thời khoá biểu** (nếu có). **Nhạc nền**: thả file vào 2 ô.
4. **Cài đặt → Xuất gói cài đặt** → được file `note-nhi-<ngày>.zip` (dữ liệu + nhạc).
5. Gửi gói qua Zalo / USB / làm qua phần mềm điều khiển máy từ xa.
6. **Xoá dữ liệu ở máy mình** (Cài đặt → Xoá toàn bộ dữ liệu) và xoá file đã nhận trong Zalo. Đây là dữ liệu cá nhân của trẻ em, không giữ lại.

**Phía giáo viên, lần đầu mở app** (màn **Chào mừng**, chỉ hiện khi máy chưa có dữ liệu):
- Ô thả to **"Kéo gói cài đặt vào đây"** (hoặc bấm để chọn file). Nhập xong thì hiện tóm tắt: "21 lớp · 838 học sinh · 6 bài nhạc".
- 2 việc bắt buộc làm trên máy giáo viên, mỗi việc 1 nút:
  - **Cài app ra màn hình** (lời nhắc cài PWA).
  - **Chọn thư mục sao lưu** (gợi ý thư mục Google Drive / OneDrive nếu máy có).
  - Làm qua điều khiển từ xa thì người hỗ trợ bấm hộ.
- Link nhỏ "Chưa có gói? Tự nhập danh sách" → Quản lý lớp.
- Khi nhập gói, `ownerId` của mọi bản ghi được gán bằng ID chủ máy của giáo viên. Gói không mang ID của máy người hỗ trợ.

### 3.12 Kiểm tra nhanh trên TV (lần đầu vào tiết)
Đây là những việc **chỉ làm được tại lớp, trên TV thật**. Chèn vào trước màn Điểm danh ở **lần đầu tiên** vào tiết. Mỗi bước 1 phím, có nút **Bỏ qua**. Xong thì không hiện lại (chạy lại được trong Cài đặt).
1. **Loa**: phát nhạc ngắn → "Nghe rõ không?" `Enter` Rõ / `↑` `↓` chỉnh âm lượng.
2. **Góc màn hình**: hiện 4 dấu góc đỏ sát mép → "Thấy đủ 4 góc không?" `Enter` Đủ / `L` Bị cắt (tự bật Lề an toàn TV rồi hỏi lại).
3. **Mic**: trình duyệt hỏi quyền → nhắc "Bấm **Cho phép**". Hiện thanh đo → "Thầy/cô vỗ tay thử nhé". Thanh nhảy là xong.

## 4. Phím tắt

| Phím | Ở đâu | Chức năng |
|---|---|---|
| Chữ/số, `Enter`, `Backspace`, `Esc` | Trang chủ | Gõ tên lớp / vào lớp (chưa gõ gì thì vào lớp gợi ý) / xoá / xoá hết |
| `Enter` / `Esc` | Điểm danh | Vào tiết / về trang chủ |
| `1`–`3`, `D`, `Esc` | Launcher | Chọn game / sửa điểm danh / đổi lớp |
| `Space` | Ghế âm nhạc | Quay → dừng nhạc → tua nhanh; trên overlay: tiếp tục |
| `S` | Ghế âm nhạc | Bật/tắt song ca |
| `R` / `V` | Overlay kết quả | Quay lại / bạn này vắng |
| `Space` | Thử thách im lặng | Bắt đầu / chơi tiếp |
| `↑` / `↓` | Thử thách im lặng (đang chơi) | Nới / siết ngưỡng |
| `1`–`4` | Bóng nổ | Chọn cách xử lý |
| `Space`, `+` / `-` | Màn hình chờ | Bắt đầu, tạm dừng / ±30 giây |
| `Esc` | Trong game | Lùi 1 bước (overlay → game → launcher) |
| `F` / `M` | Mọi màn trừ trang chủ | Toàn màn hình / tắt tiếng (vào lớp thì tự bật toàn màn hình) |
| Giữ `Esc` ~2 giây | Khi toàn màn hình | Thoát toàn màn hình (bấm nhanh `Esc` vẫn là quay lại) |

*(Phím `N` "giả lập lớp ồn" chỉ có trong mockup.)*

## 5. Dữ liệu (IndexedDB qua Dexie), thiết kế sẵn để chuyển sang server

**Mục tiêu:** v1 chạy 100% offline. Đến khi cần server (sao lưu cloud, nhiều máy, giáo án AI, nhiều giáo viên) thì **chỉ thêm tầng đồng bộ, không phải đổi schema, không phải sửa UI**.

### 5.1 Quy ước bắt buộc cho mọi bảng đồng bộ được
| Quy ước | Lý do |
|---|---|
| `id` = **UUID v7**, sinh ở client (package `uuid`) | Không trùng khi gộp dữ liệu từ nhiều máy. v7 sắp theo thời gian nên index Postgres hiệu quả |
| `ownerId` = id giáo viên. v1 dùng 1 UUID "chủ máy" tự sinh lần đầu, khi có tài khoản thì gán sang | Server biết dữ liệu của ai mà không cần migrate từng dòng |
| `createdAt`, `updatedAt` = epoch ms (UTC). Ngày học dùng chuỗi `YYYY-MM-DD` theo giờ máy | Đồng bộ theo `updatedAt` (last-write-wins). Ngày học không lệch múi giờ |
| `deletedAt?` (xoá mềm), không bao giờ xoá cứng bản ghi đã đồng bộ | Máy khác mới biết bản ghi đã bị xoá |
| **Bảng phẳng, chỉ tham chiếu bằng id, không có mảng lồng nhau** | Ánh xạ 1-1 sang bảng SQL, và 2 máy sửa cùng lúc không đè mất dữ liệu của nhau |
| Dữ liệu nhị phân (mp3) **tách khỏi bảng metadata** | Đồng bộ metadata nhẹ. File lớn sau này đẩy lên object storage riêng |

### 5.2 Bảng
```ts
// đồng bộ được (đều có: id, ownerId, createdAt, updatedAt, deletedAt?)
Class         { name, grade /* 1–5 */, schoolYear /* '2026-2027' */, lastUsedAt }
Student       { classId, order, fullName, displayName, archived }
Session       { classId, date /* YYYY-MM-DD */, startedAt, attendanceConfirmedAt? }  // 1 buổi học
ScheduleSlot  { weekday /* 1=T2 … 7=CN */, startMin /* phút từ 0h */, classId }   // thời khoá biểu, không bắt buộc
Attendance    { sessionId, studentId, status: 'absent' }                 // 1 dòng / bạn vắng (thay cho mảng absentStudentIds)
CallLog       { sessionId, classId, studentId, game, method /* chase|spot|ball|claw */,
                status: 'called' | 'skipped' | 'absent', at }
FunChallenge  { text, order }
UserPrefs     { waitMessage, waitDurationSec, silenceDurationSec, silenceDifficulty }  // 1 dòng / giáo viên, nhớ lựa chọn lần trước
TrackMeta     { title, mood: 'calm' | 'lively', mimeType, durationSec, fileId }

// chỉ ở máy này, không đồng bộ
TrackFile     { id, blob }                                               // file mp3
DevicePrefs   { volume, muted, tvSafeMargin, micDeviceId }               // đi theo máy, không theo người
ErrorLog      { id, at, screen, message, stack }
Meta          { key, value }                                             // schemaVersion, localOwnerId, lastBackupAt,
                                                                         // backupDirHandle, tvCheckDoneAt, onboardedAt…
```
- Có `schoolYear` vì mỗi năm học "3A" là một lớp khác. Lên năm mới thì tạo lớp mới, lịch sử năm cũ giữ nguyên.
- Index cần có: `CallLog[classId+studentId+at]`, `Session[classId+date]`, `Attendance[sessionId]`, `Student[classId]`, `[updatedAt]` trên mọi bảng đồng bộ (để sau này lấy được "những gì đổi từ lần đồng bộ trước").
- Schema có version, mỗi lần đổi viết migration bằng Dexie (`db.version(n).upgrade(...)`).
- v2 sẽ thêm (cùng quy ước): `Song`, `Assessment` (👍👌💪), `ClassPoints`.

### 5.3 Tầng truy cập dữ liệu
- **UI và game không gọi Dexie trực tiếp.** Mọi đọc/ghi đi qua `db/repositories` (vd `classRepo`, `callLogRepo`). Repository tự gán `id`, `ownerId`, `createdAt`, `updatedAt`.
- Mọi kiểu dữ liệu khai báo bằng **Zod schema** trong `domain/schemas`. Đây là nguồn chuẩn duy nhất: sinh type TS, validate khi nhập backup, và sau này dùng chung cho API.
- **File backup = đúng định dạng dữ liệu sẽ gửi lên server.** Là 1 file `.zip` gồm:
  - `data.json`: `{ format: 'note-nhi-backup' | 'note-nhi-setup', schemaVersion, exportedAt, ownerId, tables: { classes: [...], students: [...], ... } }`.
  - `music/<fileId>.<ext>` (có hay không tuỳ lựa chọn).
  - Gói cài đặt (`note-nhi-setup`) dùng chung định dạng. Khác ở chỗ: không mang `ownerId`, không có lịch sử (`Session`, `Attendance`, `CallLog`).

### 5.4 Lộ trình khi cần server (chưa làm ở v1)
1. **Sao lưu lên Google Drive của chính giáo viên.** Client gọi thẳng API của Drive, chưa cần server riêng.
2. **Đồng bộ nhiều máy:**
   - Thêm bảng `Outbox` (repository ghi vào cùng transaction).
   - API `POST /sync/push` + `GET /sync/pull?since=<updatedAt>`.
   - Postgres có schema giống hệt 5.2.
   - Hoặc dùng Dexie Cloud nếu muốn nhanh.
3. **Backend thật** (giáo án AI, đăng nhập, nhiều giáo viên): Node + TypeScript (Hono/NestJS) + PostgreSQL (Drizzle), monorepo dùng chung `domain/schemas`.
   - Trước khi đưa tên học sinh lên server: xin đồng ý, mã hoá, đánh giá theo luật bảo vệ dữ liệu cá nhân.

## 6. Tech stack (đã chốt)

| Phần | Chọn | Ghi chú |
|---|---|---|
| Ngôn ngữ / UI | **React 19 + TypeScript (strict) + Vite** | |
| Style | **Tailwind CSS v4** | Token màu và kiểu sticker lấy từ mockup (mục 3.9) |
| State | **Zustand** (state app) + **state machine có type** cho các phase của game | Ghế âm nhạc: `idle → intro → fast → slow → fakeout → landed → result`. Im lặng: `setup → calib → play → popped/won` |
| Âm thanh | **Web Audio API, tự viết engine** (port module `Snd` của mockup sang TS) | Không dùng Tone.js. Phát mp3 bằng `AudioBufferSourceNode` (start ở vị trí ngẫu nhiên, dừng chính xác) |
| Mic | Web Audio `AnalyserNode` | Xem 3.5 |
| Lưu trữ | **Dexie + `dexie-react-hooks`** (`useLiveQuery`) | |
| Nhập Excel | **SheetJS**, chỉ tải khi người dùng bấm nhập (`import()` động) | Cài từ cdn.sheetjs.com |
| Gói cài đặt / backup | **fflate** (zip) + **File System Access API** (sao lưu tự động vào thư mục) | Đều là thư viện/API nhỏ, chạy offline |
| Toàn màn hình | Fullscreen API + **Keyboard Lock API** (`navigator.keyboard.lock`) | Xem 3.10 |
| Offline | **vite-plugin-pwa** (Workbox), `registerType: 'prompt'` | |
| Font | **@fontsource/nunito** (subset vietnamese) | |
| Test | **Vitest** (logic thuần) + **Playwright** (e2e) | Playwright dùng mic giả: `--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<wav>` để test Thử thách im lặng thắng/thua |
| Chất lượng | ESLint + Prettier, `tsc --noEmit` | |
| CI/CD | **GitHub Actions**: lint → typecheck → test → build → deploy **Cloudflare Pages** (HTTPS, mic cần HTTPS) | |

**Không dùng backend / Next.js ở v1.** App chạy offline hoàn toàn, dữ liệu học sinh ở lại trên máy giáo viên.

**Cấu trúc thư mục**
```
src/
  app/        khung app, điều hướng màn hình, ErrorBoundary, phím tắt toàn cục
  features/   home · prep · launcher · chairs · silence · wait · classes · music · settings
  domain/     logic thuần, test bằng Vitest: parseRoster, displayNames, pickStudents, silenceThreshold
              + schemas/ (Zod, nguồn chuẩn cho type, backup và API sau này)
  audio/      engine: synth, sfx, trackPlayer, micMeter
  db/         schema Dexie, migrations, repositories (UI chỉ đi qua đây), backup import/export
  ui/         Sticker, Button, Overlay, Mascot (Nốt Nhí), Confetti
e2e/          Playwright + file wav giả lập lớp yên / lớp ồn
```

**Test tối thiểu cho `domain/`**: dán danh sách (các định dạng ở 3.1, tiếng Việt NFC/NFD), sinh tên hiển thị khi trùng, thuật toán công bằng (không bao giờ chọn bạn vắng; trong 7 ngày không lặp khi còn bạn chưa gọi; `R`/`V` không tính là đã gọi), tính ngưỡng (trung vị, kẹp min/max).

## 7. Ngoài phạm vi v1
- Đăng nhập, đồng bộ nhiều máy, dùng chung giữa các giáo viên.
- Thư viện bài hát, các game v2/v3, ghi nhận đánh giá.
- Hỗ trợ điện thoại / màn hình cảm ứng.
- Chia tổ (tổ xoay liên tục, mỗi lớp mỗi khác → cân nhắc lại sau, có thể chọn tổ ngay tại chỗ).
- **Nghiệp vụ giáo án** (pain point lớn nhất của giáo viên). Đây là hướng phát triển lớn sau v3, cần khảo sát riêng.

**Backlog cải thiện (sau v1, chưa bắt buộc)**
- Chuẩn hoá âm lượng giữa các file mp3 (đo độ to khi nạp, lưu hệ số gain). Ramp ~20ms khi cắt nhạc để loa không kêu "bụp". Tránh bắt đầu phát trong 10 giây cuối bài.
- "Chế độ nhẹ" cho laptop yếu (tắt blur, giảm confetti, tắt nốt nhạc bay).

## 8. Tiêu chí hoàn thành v1
- [ ] Từ lúc mở app → đang chạy Ghế âm nhạc: **≤ 3 thao tác, ≤ 10 giây** (có lớp gợi ý: `Enter` → `Enter` → `1` → `Space`).
- [ ] Dán danh sách 40 học sinh từ Excel → nhập đúng, không lỗi tiếng Việt.
- [ ] **Người hỗ trợ**: từ file Excel của trường (cả 2 kiểu: nhiều sheet / 1 sheet có cột Lớp) đến gói cài đặt **≤ 10 phút** cho 21 lớp.
- [ ] **Giáo viên**: từ lúc mở link lần đầu đến sẵn sàng dạy **≤ 2 phút** (kéo gói vào, cài app, chọn thư mục sao lưu). Kiểm tra trên TV **≤ 30 giây**.
- [ ] Lớp gợi ý đúng khi có thời khoá biểu. Không có thời khoá biểu thì sau 2 tuần dạy, gợi ý đúng ≥ 80% số tiết.
- [ ] Vào lại lớp đã điểm danh trong ngày → không phải điểm danh lại.
- [ ] Đang toàn màn hình, bấm `Esc` là quay lại màn trước, **không** thoát toàn màn hình.
- [ ] Sao lưu tự động ghi được vào thư mục đã chọn. Xoá sạch dữ liệu trình duyệt rồi nhập file backup → khôi phục đủ dữ liệu.
- [ ] Nạp được file mp3, phân nhóm chậm/vui; tắt mạng vẫn phát được; khởi động lại laptop nhạc vẫn còn.
- [ ] Ở **1366×768 toàn màn hình**: lưới 40 tên hiện đủ, **không cuộn**. Đọc rõ từ cuối lớp (thử thực tế trên TV).
- [ ] Ghế âm nhạc không bao giờ chọn bạn vắng; trong 7 ngày không lặp bạn khi còn bạn chưa được gọi (có unit test).
- [ ] Thử thách im lặng: xác nhận đã tắt AGC / noise suppression / echo cancellation. Hoạt động với mic laptop trong lớp ~40 em (thử thực tế). Chỉnh ngưỡng bằng ↑ ↓ có tác dụng ngay.
- [ ] Ngắt mạng hoàn toàn → app vẫn mở và chạy đủ chức năng, font vẫn đúng.
- [ ] Cố tình gây lỗi trong 1 màn → hiện màn lỗi có nút về trang chủ, không trắng màn hình, dữ liệu không mất.
- [ ] Màn hình chờ 5 phút: laptop không tắt màn hình / không ngủ.
- [ ] Deploy bản mới giữa tiết: app đang mở không tự tải lại.
- [ ] CI xanh: lint, typecheck, unit test, e2e.
- [ ] Dùng thật ít nhất **2 tiết** và ghi lại feedback.
