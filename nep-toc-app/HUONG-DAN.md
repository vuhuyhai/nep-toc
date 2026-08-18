# NẾP TÓC — Hướng dẫn vận hành

Ghi lại những chỗ **đã trả giá thật**, để lần sau sửa app khỏi dò lại từ đầu.
Đừng "dọn gọn" các đoạn có ghi chú, chúng ở đó vì một lý do.

---

## 1. Hai đường chạy

App chạy được ở hai nơi, dùng **chung một bản lời nhắc** để giọng văn không lệch.

| | Chạy tại máy | Chạy trên Netlify |
|---|---|---|
| Trang tĩnh | `may-chu.js` | Netlify publish `nep-toc-app` |
| Viết gợi ý content | gọi thẳng Anthropic bằng `ANTHROPIC_API_KEY` ở máy | bộ quét gọi hàm `phan-tich` |
| Hỏi nhanh | `may-chu.js` đóng vai hàm nền, kết quả giữ trong bộ nhớ | `hoi-background.mjs` + Netlify Blobs |
| Mã truy cập | không cần | **cần** |

`thu-thap.js` tự chọn đường: có `ANTHROPIC_API_KEY` ở máy thì gọi thẳng, không thì gọi
qua mạng tới hàm nền đã deploy.

---

## 2. Nguồn tin

`cau-hinh.json` có **54 nguồn đang bật** và **18 nguồn đã chết**, tất cả đã tải thật và
đọc thật ngày 17/08/2026. Nguồn chết vẫn nằm trong file kèm `lyDo`, cố ý, để không ai
thử lại lần nữa.

Kiểm lại bất cứ lúc nào:

```bash
node kiem-tra-nguon.js
```

### Luật số một khi đánh giá feed

**Xem `pubDate` của item ĐẦU TIÊN, không bao giờ xem `lastBuildDate`.**
Đã gặp feed `lastBuildDate` tự nhảy sang hôm nay nhưng bài mới nhất từ hai năm trước, và
feed trả HTTP 200 với XML hợp lệ nhưng nội dung là blog hoàn toàn khác.

### Bẫy `site:` trên Google News

Nhiều trang lớn chặn feed gốc (Harvard 404, Mayo rớt kết nối, Cleveland 404, Healthline
404, EatingWell và Verywell trả 402). Đường vòng là đọc qua Google News với `site:ten-mien`.

**Nhưng phải kèm từ khóa chủ đề.** Truy vấn `site:` trần kéo về trang tĩnh của site đó:
- `site:mayoclinic.org` → trang đăng nhập, 6865 ngày tuổi
- `site:shape.com` → trang chủ, 4750 ngày tuổi
- `site:acefitness.org` → trang "All Courses", 1293 ngày tuổi

Viết đúng phải là `site:health.harvard.edu (weight OR nutrition OR exercise OR women)`.

### Reddit

Reddit **có** RSS thật (`/r/<sub>/top/.rss?t=week`) nhưng chặn theo **tốc độ ở mức IP**,
rất gắt. Gọi liền tay vài lần là 429 hoặc 500. Bộ quét đã nghỉ **22 giây** giữa mỗi lần
gọi Reddit và thử lại có lùi thời gian. Thấy nó đứng im vài phút ở đoạn Reddit là bình
thường, đừng tưởng treo.

Đường dẫn `/top/?t=week` đã là bộ lọc upvote sẵn, nên `soBaiDau` chính là lấy N bài top tuần.

---

## 3. Ba chốt an toàn nội dung

Đây là chỗ app này khác hẳn ba app tin trước, và là phần **không được gỡ**.

### `laQuangCaoThanDuoc()`

Ngành tóc ngập bài quảng cáo trá hình. Chúng lọt qua mọi bộ lọc từ khóa vì chúng dùng
**đúng** những từ khóa mình đang tìm, và chúng khoe số liệu ấn tượng nên `chotGiuLai()`
cũng cứu nhầm.

Vì vậy hàm này chạy **TRƯỚC** `chotGiuLai()`. Đảo thứ tự là hỏng. Lần quét đầu nó bỏ 71 bài.

### `laHaiVeTamLy()`

Chặn nội dung cổ vũ nhịn ăn cực đoan, chê bai cơ thể, mô tả cách hạn chế ăn của người rối
chế giễu hói. Người đọc cuối là khách ngồi trên ghế salon, trong đó có người rụng tóc
với việc ăn uống. Đây không phải chuyện lọc cho feed sạch, mà là chuyện không đưa nguyên
liệu độc vào tay người sắp viết bài cho hàng nghìn người đọc.

### Câu `luuY` do AI viết

Bắt buộc có ở bài về thuốc GLP-1, thực phẩm chức năng, can thiệp y tế, rối loạn ăn uống,
hoặc bài có con số phục hồi tóc ấn tượng. Nội dung: nhắc không hứa kết quả, không tư vấn
y tế thay bác sĩ, và nói rõ giới hạn của sản phẩm chăm tóc.

### Bộ lọc quét lại toàn bộ kho

Cả ba bộ lọc chạy lại trên **toàn bộ kho** mỗi lần chạy, không chỉ tin vừa quét.
Bài học từ app SỨC BẬT: sửa bộ lọc mà chỉ áp cho tin mới thì 313 bài cũ vẫn nằm nguyên
trong kho với nội dung đáng lẽ phải bỏ.

---

## 4. Bẫy khi gọi Claude viết gợi ý

1. **`max_tokens` phải rộng.** Ở đây để 1400 vì trả về **năm** trường tiếng Việt, nhiều
   hơn ba trường của các app trước. Để chật thì câu trả lời bị cắt và khối JSON hụt ngoặc.
2. **Phải đặt `thinking: {type:"disabled"}`.** Phần thinking **đếm vào** `max_tokens`.
   Bật nó thì nhiều bài tiêu vài trăm token để nghĩ rồi chạm trần giữa chừng.
3. **Phải ép luân phiên kiểu mở đầu từ ngoài.** Mỗi lần gọi là một cuộc hội thoại riêng,
   model không biết bài trước mở thế nào. Để tự do thì hàng trăm câu hook mở gần giống
   nhau hết. `KIEU_MO` có 6 kiểu, xoay theo số thứ tự bài.

   **Luân phiên 6 kiểu vẫn CHƯA ĐỦ.** Đếm thật trên 160 hook đầu tiên: riêng cụm
   "Nhiều người nghĩ" chiếm **23 câu**, tức cứ 7 bài lại một câu mở y hệt. Lý do: trong
   *cùng một kiểu*, model lại rơi vào cùng một khuôn câu. Cách chữa là **liệt kê thẳng
   các cụm bị cấm** trong lời nhắc, và danh sách đó phải lấy từ số đếm thật chứ không
   phỏng đoán. Sau khi siết, 8 bài thử cho ra 8 câu mở khác hẳn nhau.

   Muốn kiểm lại độ đa dạng bất cứ lúc nào, đếm ba từ đầu của mọi hook trong
   `du-lieu/tin-tuc.json`. Cụm nào vượt quá 2 lần là dấu hiệu phải bổ sung vào danh sách cấm.

   **160 hook viết trước lúc siết vẫn còn nguyên khuôn cũ.** Muốn dọn thì tăng `WA_VER`
   trong `thu-thap.js` rồi chạy `VIET-BU-GOI-Y.bat` nhiều lần. Lưu ý việc này viết lại
   TOÀN BỘ kho, tốn thêm chừng ấy lượt gọi API. Không dọn cũng dùng được, và mỗi ngày
   bài mới sẽ theo lời nhắc mới.
4. **Tin nguồn tiếng Việt thì giữ nguyên tiêu đề gốc bằng mã, không nhờ AI.** Bảo nó
   "chép y nguyên" vẫn bị diễn đạt lại, nghe xuôi hơn nhưng đã sai sự việc.

### Xen kẽ bốn nhóm

`tatCa` xếp theo nhóm, nghề hết rồi mới tới khoa học, xu hướng, Việt Nam. Đưa nguyên
thứ tự đó cho AI thì trần `MAX_PHANTICH` tiêu hết vào nhóm đầu.

**Đã thấy đúng như vậy ở lần chạy đầu: 40 bài xong thì cả 40 đều ở tab Khoa học, ba tab
kia trống trơn.** Nay có mảng `xen` trộn đều bốn nhóm trước khi gọi AI. Mảng đó **cùng
tham chiếu** tới phần tử của `tatCa`, không được sao chép sâu.

---

## 4a. Chân dung khách hàng và màu thương hiệu

### Chân dung

Nguồn: `CHAN-DUNG-CHU-SALON.md` ở thư mục gốc (dựng 18/08/2026, ghi nguồn từng con số).
Bản rút gọn nạp vào AI nằm ở `netlify/functions/chung/chan-dung.js`, viết CommonJS để
**ba** file lời nhắc cùng require được: content, phan-tich, hoi.

Chép ra ba bản là sớm muộn ba lời nhắc mô tả ba người khác nhau. Sửa tài liệu gốc thì
phải sửa file này theo.

`DAY_DU` dùng cho sinh bài đăng thật. `GON` dùng cho `phan-tich` (chạy hàng trăm bài mỗi
ngày, chỉ trả câu hook và góc triển khai, nhét cả chân dung đầy đủ vào là tốn token vô ích).

**Điều quan trọng nhất trong tài liệu:** anh Dũng không sở hữu một cái salon, anh đang LÀ
SỰ AN TÂM. Bài phải chạm cả tầng nói ra (muốn mặc vừa quần áo cũ) lẫn tầng bên trong
(được là chính mình, không thấy có lỗi khi chăm sóc bản thân).

### Luật nối về chân dung

Kho tin quét cả tạp chí da liễu học thuật lẫn tạp chí làm đẹp cho người tiêu dùng, trong
khi người đọc là người điều hành một cái tiệm.

**Bài học mang từ app trước sang:** bài về chuyên môn da liễu ra bài viết hay và an toàn,
nhưng KHÔNG chạm nỗi đau nào của chủ salon. Bài đúng mà trượt mục tiêu thì vẫn
là bài không dùng được.

Đã thêm luật bắt buộc: bài phải chạm ít nhất một trong năm nỗi sợ, hoặc quỹ thời gian,
hoặc chuyện con cái, hoặc cảm giác được là chính mình, hoặc nỗi mệt của người đã bỏ cuộc
nhiều lần. Chủ đề nằm ngoài đời sống của chị thì phải tìm góc bắc cầu (chị đang chăm mẹ,
chị muốn hiểu trước để chuẩn bị) VÀ ghi ở `canKiem` rằng bài hợp nhóm lớn tuổi hơn.

Cách siết: bắt AI tự hỏi bài này giúp chủ salon làm gì trong tiệm (dạy thợ, trả lời khách
hỏi khó, chọn hàng nhập, bỏ một dịch vụ đang hứa quá lời) trước khi viết.

### Mâu thuẫn đã xử lý: ảnh trước và sau

Tài liệu chân dung ghi ảnh trước và sau là yếu tố tạo niềm tin. Luật ảnh của app lại cấm.
Hai chuyện khác hẳn nhau nên đã tách rõ:
- Ảnh THẬT của khách thật, có xin phép: được, và `goiYAnh` được phép gợi ý dùng.
- Máy sinh ra một cặp ảnh trước sau: CẤM. Đó là bịa bằng chứng kết quả, vừa sai sự thật
  vừa đúng thứ pháp luật quảng cáo soi.

### Màu thương hiệu

Màu chủ đạo: nâu đồng `#8A5A3B`, chọn để khác hẳn bốn app tin kia.

**Bản đầu app này dùng hồng `#D4537E` do tôi tự chọn, SAI nhận diện.** Màu chính của
NẾP TÓC là nâu đồng `#8A5A3B`. Đã đo tương phản WCAG bằng script, không ước lượng bằng mắt.

Ba luật brand được tôn trọng trong `chung.css`:
1. Coral là ĐIỂM NHẤN, không phải nền. Nền lớn dùng trắng và kem.
2. Tiêu đề dùng than đậm ấm `#2e2b29`, không tô nâu. Nội dung dùng `#404040`.
3. Coral thuần chỉ cho nút, dấu tích, eyebrow, hover.

Vì luật 2, biến `--accent-2` (chữ nhãn nhỏ trên nền sáng) lấy bản nâu đậm hơn, chứ không lấy
bản đậm `#c0393a`. Coral thuần trên nền trắng chỉ đạt khoảng 3.4:1, không đủ đọc chữ nhỏ;
`#c0393a` đạt 5.4:1.

Ô số liệu "Nên dùng" trước đây tô số bằng màu nhấn, trái luật 2. Nay số để than ấm, màu nhấn
chuyển thành vạch viền trái.

**Khác bản trước:** chữ trắng trên nền coral chỉ đạt 3.29:1, dưới ngưỡng. Nâu đồng đạt
5.82:1 nên chữ trong nút không còn phải né nữa. Xanh rêu `#5B6B4F` thay màu hổ phách cũ
cho mức "Đáng chú ý", vì hổ phách nằm sát nâu đồng, ba mức nhìn ra một màu.
Đây là cặp màu do chính brand guideline quy định nên giữ nguyên, không tự đổi. Các nút
đều dùng chữ đậm nên đọc vẫn rõ.

---

## 4a3. Viết content bằng Gemini

Từ 18/08/2026, phần **Tạo content** đi Gemini nếu có `GEMINI_API_KEY`, không thì đi Claude.

**ĐÃ CHẠY THẬT trên bản online:** `gemini-3.7-flash`, xong trong **7 giây** so với ~30 giây
của Claude. Nhớ rằng thêm biến môi trường xong PHẢI **Trigger deploy**, không thì hàm nền
vẫn chạy bản cũ và lặng lẽ dùng Claude. Đã vấp đúng lỗi này.
App mở công khai nên số lượt tăng mạnh, mà Gemini có bậc miễn phí rộng hơn hẳn.

**Lời nhắc và khuôn kết quả GIỮ NGUYÊN**, chỉ đổi chỗ gửi đi. Nhờ vậy đổi qua đổi lại mà
giọng văn không đổi theo.

**Hỏi nhanh VẪN đi Claude**, vì nó cần công cụ tra web. Bộ quét `phan-tich` cũng vẫn Claude.
Muốn chuyển nốt hai cái đó thì làm tương tự, nhưng Hỏi nhanh sẽ mất phần tra web.

### Tự lùi về Claude

Gemini hỏng mà còn khóa Claude thì **tự lùi về Claude**, ghi lý do ra nhật ký máy chủ rồi
đi tiếp. Người dùng đang chờ bài không cần biết bên trong dùng máy nào; hỏng một bên mà cả
tính năng chết là tệ nhất. Không có đường lùi thì để lỗi nổi lên.

Đã kiểm ba trường hợp: khóa Gemini bậy + có Claude thì lùi và vẫn ra bài 195 từ; không có
Gemini thì đường cũ nguyên vẹn; khóa Gemini bậy + không Claude thì báo lỗi rõ.

### Ba khác biệt của Gemini đã phải xử lý

1. **Không chấp nhận `additionalProperties`**, gửi vào là 400. Hàm `doiSchema` gỡ bỏ.
   Bẫy: phải đệ quy vào TỪNG thuộc tính trong `properties`, không phải vào cả khối. Làm
   sai thì `additionalProperties` ở tầng trong vẫn còn. Đã bắt được đúng lỗi này lúc đo.
2. **Không giữ thứ tự khóa**, phải khai `propertyOrdering` thì kết quả mới đúng thứ tự.
3. **Tắt phần suy nghĩ** bằng `thinkingConfig.thinkingBudget = 0`, cùng lý do với
   `thinking: disabled` bên Claude: phần nghĩ ĐẾM VÀO `maxOutputTokens`.

Thỉnh thoảng Gemini vẫn bọc kết quả trong khối ``` dù đã bảo trả JSON thuần, nên có bước
gỡ khối trước khi đọc.

### Tên model

**KHÔNG ghi cứng một tên model.** Google đổi tên liên tục; hôm nay đúng, ba tháng sau gọi
là 404 và cả tính năng chết mà không ai biết vì sao.

Cách làm: thử tên trong `GEMINI_MODEL` (nếu có) hoặc tên đầu danh sách ưu tiên. Gặp 404
hay 400 thì hỏi Google `/v1beta/models` xem khóa này dùng được gì, chọn theo thứ tự ưu
tiên, rồi thử lại một lần. Model dò được nhớ trong vòng đời hàm nền, khỏi hỏi lại mỗi lượt.

### Cách xác nhận Gemini đã bật

Thẻ trong tab **Đã tạo** có nhãn nhỏ ghi `gemini` hay `claude`. Hoặc gọi thẳng:

```bash
curl -s -X POST https://nep-toc.netlify.app/.netlify/functions/hoi-background -H "content-type: application/json" --data "{\"id\":\"thu1\",\"ma\":\"MA_CUA_ANH\",\"viec\":\"content\",\"dinhDang\":\"facebook\",\"phongCach\":\"ca-benh\",\"kichCo\":\"ngan\",\"bai\":{\"tieuDe\":\"thu\"}}"
```

rồi đọc kết quả, xem trường `may`.

---

## 4a4. Thanh tiến trình lúc chờ

Chờ tạo content mà chỉ có ba chấm nhấp nháy thì người ta tưởng treo. Nay có thanh chạy,
tên việc đang làm, số giây đã trôi, và dãy chấm cho biết còn mấy chặng.

### Không nói dối về tiến độ

Đây là MỘT lời gọi API, máy chủ không báo về đang làm tới đâu, nên **không thể biết phần
trăm thật**. Thanh chạy theo THỜI GIAN đã trôi và **dừng ở 92%**, chỉ khi bài về thật mới
đầy nốt.

Thà thanh đứng chờ ở 92% còn hơn đầy 100% rồi vẫn quay: kiểu đó làm người ta mất tin vào
mọi thanh tiến trình về sau.

Các bước ghi ra là thứ AI thực sự phải làm, theo đúng thứ tự trong lời nhắc. Người đọc vừa
đỡ sốt ruột vừa biết trước bài sắp có những phần gì.

### Tự học thời gian, không ghi cứng

**Đo thật trên bản online: Claude mất khoảng 30 giây, Gemini chỉ 7 giây.** Ghi cứng một
con số thì đổi nhà cung cấp là thanh chạy sai hẳn, hoặc bò như rùa rồi nhảy vọt, hoặc đầy
ngay lập tức rồi đứng chờ.

Nay nhớ 5 lượt gần nhất trong localStorage và lấy **trung vị**. Trung vị chứ không trung
bình: một lượt lỗi mạng kéo dài 90 giây sẽ kéo lệch hẳn trung bình, còn trung vị thì gần
như không nhúc nhích. Lượt đầu chưa có gì để học thì dùng 12 giây.

Ngưỡng báo "lâu hơn thường lệ" cũng tính theo con số đã học (gấp 3 lần, tối thiểu 45 giây),
không ghi cứng.

### Nhớ dừng đồng hồ

`ttDung()` đặt trong `xong()` là chốt chặn, vì mọi đường ra khỏi vòng tạo đều đi qua đó.
Cũng gọi ở hàm đóng hộp, phòng khi người dùng đóng giữa chừng. Quên chỗ nào thì có một
`setInterval` chạy lẻ mãi phía sau.

---

## 4b. Nút Tạo content

Nút hồng trên mỗi thẻ tin. Ba bước: chọn định dạng (Facebook hoặc TikTok), chọn phong
cách, chọn độ dài, rồi mới gọi AI.

**Bắt chọn phong cách trước là CÓ CHỦ Ý.** Một bài tin lên được năm kiểu bài rất khác
nhau. Để AI tự chọn thì lần nào cũng ra cùng một giọng, mà cả trang đọc đều đều
thì không ai xem.

**Đi CHUNG hàm nền với Hỏi nhanh** (`hoi-background` + `hoi-ket-qua` + cùng kho Blobs),
phân biệt bằng trường `viec: "content"`. Không dựng hàm mới, cố ý: mỗi hàm mới là một cửa
gọi API phải tự lo phần chặn, mà chặn sai một chỗ là đốt tiền. Một cửa thì chỉ canh một chỗ.

**Danh sách phong cách nằm ở HAI nơi phải khớp nhau:**
- `netlify/functions/loi-nhac-content.js` (hằng `PHONG_CACH`) là bản thật, có cả chỉ dẫn cho AI.
- `nep-toc-app/index.html` (hằng `PHONG_CACH`) chỉ có mã và tên, để vẽ nút.

Trang tĩnh không import được file CommonJS nên phải chép. Thêm bớt phong cách phải sửa cả
hai; sai một chữ trong `ma` thì hàm nền lặng lẽ rơi về phong cách đầu tiên, không báo lỗi.
Có sẵn lệnh đối chiếu hai danh sách ở cuối mục này.

**max_tokens để 4000**, rộng hơn hẳn hàm phan-tich. Kịch bản 60 giây có thể tới 12 cảnh,
mỗi cảnh bốn trường. Chật là hụt ngoặc, hỏng cả khối JSON.

**Câu Lưu ý của bài là ràng buộc CỨNG** truyền vào lời nhắc, không phải gợi ý. Đã kiểm
thật với bài về thuốc GLP-1: cả bài Facebook lẫn kịch bản TikTok đều tự nhắc hỏi bác sĩ
và không khuyên dùng hay không dùng thuốc.

**Có bước dọn ký tự lạ** (hàm `donKetQua`). Đã gặp thật: model trả câu canKiem kèm dấu
ngoặc Nhật `」`. Bước dọn CHỈ bỏ ký tự rác, KHÔNG đụng dấu xuống dòng, vì bài Facebook dựa
vào xuống dòng để chia đoạn và giao diện hiển thị bằng `white-space: pre-wrap`.

**BẪY CSS ĐÃ TRẢ GIÁ.** Lớp `.hop` phải có `min-width: 0`. Nó là ô của lưới `.lop-phu`,
mà ô lưới mặc định `min-width: auto` nên không bao giờ hẹp hơn nội dung bên trong. Bảng
kịch bản TikTok có `min-width: 560px`, thế là trên điện thoại 375px cả cái hộp bị kéo giãn
ra 644px, tràn khỏi màn hình và phần đầu phần chân lệch hẳn đi. Đặt `min-width: 0` thì hộp
co đúng 335px và bảng tự cuộn ngang trong khung riêng của nó.

Đối chiếu hai danh sách phong cách bất cứ lúc nào:

```bash
node -e "const{PHONG_CACH}=require('./netlify/functions/loi-nhac-content.js');const h=require('fs').readFileSync('nep-toc-app/index.html','utf8');['facebook','tiktok'].forEach(d=>PHONG_CACH[d].forEach(x=>{if(!h.includes('\"'+x.ma+'\"'))console.log('THIEU o giao dien:',d,x.ma)}));console.log('xong')"
```

---

## 4a2. Cài app về máy và nút Góp ý

### Cài app về máy (PWA)

**Chrome chỉ mời cài app khi có ĐỦ ba thứ:** manifest hợp lệ, service worker biết xử lý
fetch, và icon **PNG** 192 với 512. Icon SVG một mình KHÔNG đủ, đây là chỗ suýt hỏng vì
trước đó tôi đã xóa hết PNG do chúng còn mang màu thương hiệu cũ.

Icon PNG được sinh lại bằng `scratchpad/sinh-icon.js`: tự viết bộ mã hóa PNG bằng `zlib`
có sẵn của Node, không cần cài thư viện ảnh nào. Hình là trái tim trắng đặc trên nền
nâu đồng. **Bản maskable phải phủ KÍN ô vuông**, không bo góc sẵn, vì hệ điều hành tự cắt
theo hình nó muốn; bo sẵn thì lúc nó hiện dạng vuông bo sẽ lòi bốn góc trắng. Hình chính
nằm trong vòng an toàn 80% giữa ảnh.

`sw.js` dùng **MẠNG TRƯỚC**, kho tạm chỉ là lưới đỡ khi mất mạng. Cố ý không dùng
kho-trước cho nhanh: app đổi nội dung mỗi ngày, kho-trước thì người dùng mở lên thấy bản
cũ mà không hiểu vì sao. Service worker KHÔNG đụng tới `/.netlify/*`, đó là chỗ gọi AI.

**iPhone không có `beforeinstallprompt`**, Apple không cho. Chỉ còn cách chỉ tay: bấm nút
Chia sẻ rồi Thêm vào MH chính. Dải mời trên iPhone chờ 6 giây mới hiện, để người ta kịp
xem app có gì trước đã; mời ngay lúc vừa mở thì gần như ai cũng tắt.

Bấm "để sau" là nhớ luôn, không mời lại nữa.

### Nút Góp ý

Nút tròn nổi góc phải, thấy được ở mọi tab. **KHÔNG đòi đăng ký**, cố ý: bắt người ta
đăng ký mới cho góp ý thì phần lớn bỏ đi, mà đúng những người bỏ đi mới là người có điều
đáng nói nhất. Người đã đăng ký thì lấy sẵn tên và liên hệ từ hồ sơ, khỏi gõ lại.

Mỗi góp ý ghi kèm **bối cảnh**: đang ở tab nào, đang dùng điện thoại hay máy tính. Không
có cái đó thì đọc "chỗ này khó dùng" mà chịu, không biết chỗ nào.

Chống spam nhẹ: trần 10 góp ý mỗi ngày theo IP, bỏ nội dung dưới 5 ký tự, cắt ở 2000 ký tự.
Đọc lại thì phải có `MA_QUAN_TRI`, vì góp ý có thể kèm số điện thoại người gửi.

### Bẫy đã trả giá: hai viên nổi cùng bám đáy

Dải cài app và nút Góp ý đều bám đáy màn hình nên chồng lên nhau.

**Đã thử rồi bỏ:** đo chiều cao dải rồi đẩy nút lên. Dải trên iPhone cao 189px, gần gấp
đôi trên Android vì có thêm hai dòng hướng dẫn, nên phải đo động; mà đo động lại phụ thuộc
thời điểm trình duyệt tính xong bố cục. Thử cả `requestAnimationFrame` (KHÔNG chạy khi tab
ở nền), rồi `setTimeout`, rồi biến CSS, rồi đặt thẳng `style.bottom`. Tốn công mà vẫn không
chắc trên mọi máy.

**Chốt:** dải hiện thì ẨN hẳn nút góp ý. Dải chỉ hiện tạm, cài xong hoặc bấm để sau là nút
quay lại ngay. Nhớ gọi `dayNutGopYLen()` ở CẢ hàm hiện lẫn hàm ẩn, thiếu ở hàm ẩn thì đóng
dải xong nút biến mất luôn.

---

## 4b1. Đăng ký một lần (app đã mở công khai)

**ĐỔI TỪ 18/08/2026.** Trước đây có hai hộp thoại `prompt` của trình duyệt: một hỏi mã
truy cập, một hỏi tên, và cả hai bật lên GIỮA LÚC đang bấm tạo content. Xóa lịch sử duyệt
web hay đổi máy là hỏi lại từ đầu. Prompt còn bị chặn hẳn trong webview Zalo.

Nay có màn **đăng ký một lần**: họ và tên, số liên lạc (kèm ô tích có dùng Zalo), email,
và mã truy cập. Đổi lấy một **mã thông hành (token)** riêng cho từng người, lưu ở Blobs
kho `nguoi-dung`.

### App đã mở công khai (18/08/2026)

Vũ Hải mở app cho mọi người dùng để lấy phản hồi. Hai thay đổi theo đó:

**Đăng ký chỉ bật khi bấm Tạo content hoặc Hỏi nhanh**, KHÔNG bật lúc mở trang. Đọc tin
thì ai cũng đọc được. Hai chức năng kia mới là chỗ tốn tiền API thật.

Câu mở của màn đăng ký đổi theo việc người ta đang định làm, vì người bấm Tạo content và
người bấm Hỏi nhanh có mong đợi khác nhau.

**Thêm trần lượt theo TỪNG NGƯỜI** (`TRAN_LUOT_NGUOI`, mặc định **8** lượt mỗi ngày).
Tám chứ không phải 20 như VÓC DÁNG: đây là app thứ năm dùng chung một khóa API nên nó ăn
vào cùng hạn mức với bốn app kia.
Từ lúc mở công khai, trần theo IP không còn đủ: nhiều người chung một mạng công ty thì
chặn oan nhau, còn một người đổi mạng là lách được. Trần theo IP vẫn giữ làm lớp thứ hai
cho ai chưa đăng ký mà còn dùng mã cũ.

**Người bị khóa KHÔNG bị đá về màn đăng ký nữa.** App công khai thì họ vẫn có quyền vào
đọc tin, chỉ mất quyền dùng AI.

Kiểm số liên lạc và email ở CẢ HAI nơi: ở trang để người dùng biết sớm khỏi chờ một vòng
mạng, và ở máy chủ vì đó mới là chỗ đáng tin. Kiểm LỎNG thôi, chỉ chặn thứ rõ ràng không
phải số hay không phải email; chặt quá thì loại nhầm số cố định có mã vùng hay người gõ +84.

Từ đó mọi lời gọi gửi `token`, không gửi mã dùng chung nữa. Mã dùng chung bị **xóa khỏi
máy** ngay sau khi đăng ký xong.

### Được ba thứ mà cách cũ không có

1. Không phải gõ lại gì sau lần đầu.
2. Tên người dùng là THẬT, lấy từ hồ sơ đã đăng ký. Cách cũ ai gõ tên gì cũng được, nên
   số liệu trong trang Quản trị không tin được.
3. **Khóa được TỪNG người** mà không phải đổi mã của cả nhóm. Ai nghỉ việc hay mất máy
   thì khóa riêng người đó ở trang Quản trị.

Đây KHÔNG phải hệ thống tài khoản có mật khẩu, cố ý. Công cụ nội bộ vài người dùng, dựng
đăng nhập đầy đủ là quá tay. Token tương đương một tấm thẻ ra vào: ai cầm thẻ thì vào
được, mất thẻ thì khóa thẻ đó lại.

### Đường cũ vẫn sống

Hàm nền nhận CẢ HAI: `token`, hoặc `ma` dùng chung như trước. Giữ đường cũ để trình duyệt
nào còn nhớ mã từ hôm trước vẫn dùng tiếp được, khỏi bắt cả nhóm đăng ký lại trong cùng
một ngày. Ưu tiên token vì nó cho biết ĐÚNG ai đang dùng.

Hàm `hoi-background` lấy tên từ hồ sơ khi có token, KHÔNG tin chuỗi `nguoiDung` trình
duyệt gửi lên.

### Token bị khóa thì sao

Trang tự gọi `dang-ky` với `viec: "kiem"` một lần lúc mở, để đưa người bị khóa về màn
đăng ký thay vì để họ bấm mãi rồi nhận lỗi khó hiểu. Mất mạng thì bỏ qua, không chặn ai
chỉ vì mạng chập.

### Chạy tại máy

`localhost` thì bỏ qua hết phần đăng ký, giống mọi đường chạy tại chỗ khác. `may-chu.js`
vẫn trả lời hàm `dang-ky` để trang không báo lỗi mạng lúc tự kiểm danh tính.

### Gói danh tính

Hàm `danhTinh()` trong `index.html` là **chỗ duy nhất** quyết định gửi gì lên máy chủ:
có token thì gửi token, không thì gửi mã cũ kèm tên. Sau này đổi cách nhận diện chỉ phải
sửa một hàm đó.

---

## 4b2. Tab Đã tạo và chống mất bài

Sinh ra từ hai lỗi Vũ Hải báo: **đang tạo content mà bấm ra ngoài là mất**, và **không
có chỗ lưu lịch sử content**.

### Chống mất bài

Bấm nền hộp **không còn đóng hộp nữa**. Bỏ hẳn đường đóng do lỡ tay còn chắc hơn là hỏi
lại mỗi lần. Muốn đóng thì bấm dấu nhân hoặc phím Esc.

Cờ `dangTao` bật lúc bắt đầu gọi AI, hạ ở MỌI đường ra (xong, lỗi, hết giờ). Đang tạo mà
đóng thì phải xác nhận, vì lượt đó vẫn bị tính phí dù có nhận được bài hay không.

### Kho content

Lưu ở **máy chủ** (Blobs kho `content-luu`), KHÔNG phải localStorage. Để ở trình duyệt thì
đổi máy, đổi trình duyệt, hay xóa lịch sử duyệt web là mất sạch, tức là vẫn đúng cái lỗi
vừa sửa.

Mỗi bài một blob riêng, khóa `YYYY-MM-DD/<id>`, cùng lý do như nhật ký. Giữ 180 ngày.
`luuContent` không ném lỗi ra ngoài: lưu hỏng thì người dùng vẫn nhận được bài, chỉ là
không có trong tab Đã tạo.

Khác kho `nhat-ky` (chỉ giữ số liệu để thống kê): kho này giữ TRỌN nội dung để đọc và
chép lại được.

Hàm `content-da-tao` gác bằng **`MA_TRUY_CAP`**, không phải `MA_QUAN_TRI`: ai tạo được thì
đọc lại được, đây là việc hằng ngày của nhân sự chứ không phải việc của người quản lý.
Hàm này không gọi API tính tiền nào nên không cần trần lượt.

Tab Đã tạo dùng LẠI đúng `veKQFacebook` và `veKQTiktok` của hộp Tạo content, để hai nơi
hiện giống hệt nhau. Nút Chép cũng dùng lại `kqRaChu`, tạm trỏ `baiDangTao` vào bài gốc
để dòng Nguồn ở cuối vẫn đúng.

### Bẫy prompt trong webview

`window.prompt` bị CHẶN trong một số trình duyệt nhúng, rõ nhất là webview của **Zalo và
Facebook**, mà người dùng hay mở link ngay trong Zalo. Không bọc thì prompt ném
lỗi và cả luồng Tạo content chết giữa chừng, không báo gì.

Đã bọc trong hàm `hoiAnToan`, và lời gọi `hoiTen` cũng nằm trong `try`. Prompt bị chặn thì
bài vẫn tạo bình thường, chỉ là vào thống kê dưới tên `(không tên)`.

---

## 4c. Prompt ảnh và cầu nối với extension ChatGPT Auto Ảnh

Mỗi bài content sinh ra hai thứ về ảnh:
- `goiYAnh`: một câu tiếng Việt nói cho nhân sự biết nên dùng ảnh gì.
- `promptAnh`: câu lệnh đưa thẳng sang công cụ tạo ảnh.

### Hai ràng buộc kỹ thuật không được phá

**MỘT DÒNG.** Extension tách prompt theo từng dòng, một dấu xuống dòng lọt vào là prompt
vỡ thành hai prompt cụt, ra hai tấm ảnh sai. Lời nhắc có dặn, nhưng hàm `motDong()` ép
lại bằng mã mới chắc. Hàm đó cũng gỡ luôn cờ kỹ thuật kiểu `--ar 16:9` nếu model lỡ thêm.

**KHÔNG kèm câu style.** Extension đã có sẵn ô "Câu nối thêm" chứa câu style chuẩn của
Vũ Hải và tự nối vào cuối mỗi prompt. Viết lại trong `promptAnh` là câu style bị lặp hai
lần. Vì vậy `promptAnh` chỉ lo phần NỘI DUNG cảnh.

### Luật an toàn hình ảnh

Ngành tóc rất dễ ra ảnh soi mói mái tóc, nên lời nhắc cấm thẳng: không cận cảnh đỉnh đầu
đùi vòng eo, không ảnh trước và sau, không bàn cân hiện số, không thước dây quấn người,
người trong ảnh không khổ sở hay xấu hổ.

**Đã lọt thật một lần:** bài về thuốc GLP-1 mà prompt tả "ngồi trước cửa phòng tập". Quy
ước đứng của Vũ Hải là style là style, chủ đề là chủ đề, không tự rắc phòng tập vào mọi
tấm ảnh chỉ vì đây là app của chuỗi gym. Luật đã siết để cấm cả cảnh đứng ngồi bên ngoài
salon vào mọi tấm ảnh, và cấm luôn logo thương hiệu trong ảnh.

**Bẫy lặp bối cảnh, y hệt bẫy câu hook.** Ba prompt đầu tiên thì hai cái cùng mở bằng
"ngồi bên cửa sổ buổi sáng". Đã cấm thẳng ba khuôn quen (`ngồi bên cửa sổ`, `ánh nắng
chiếu qua rèm`, `hai tay ôm tách trà`) và liệt kê sẵn các bối cảnh thay thế. Sau khi siết,
ba bài khác nhau ra ba bối cảnh khác nhau: bàn trang điểm, khu chợ sớm, bếp nhà.

### Cầu nối với extension

File `Extension-ChatGPT-Auto-Anh/cau-noi-nep-toc.js` là content script chạy trên
`nep-toc.netlify.app` và `localhost:8095`. Nó cắm cờ `data-chatgpt-auto-anh="1"` lên thẻ
`<html>`; trang nhìn cờ đó để quyết định hiện nút "Gửi sang ChatGPT Auto Ảnh" hay hiện lời
nhắc cài đặt.

**VÌ SAO dùng content script chứ không dùng `externally_connectable`:** cách kia bắt trang
web phải biết MÃ ID của extension, mà extension cài dạng unpacked thì ID đổi theo đường
dẫn thư mục trên từng máy. Nhân sự sẽ phải tự đi tìm ID rồi điền vào app, sai một chữ là
im lặng không chạy. Content script thì chạy sẵn trong trang, trang chỉ cần bắn
`window.postMessage`, không cần biết gì về extension.

Giao thức, cả hai chiều đều kiểm `e.source === window`:

| Chiều | Nội dung |
|---|---|
| Trang gửi | `{nguon:"nep-toc", viec:"themPrompt", prompt:"..."}` |
| Extension đáp | `{nguon:"chatgpt-auto-anh", ok:true/false, chiTiet:"..."}` |

Extension chỉ THÊM prompt vào ô nhập, **không tự bấm chạy**, cố ý: sinh ảnh tốn hạn mức
ChatGPT nên người vẫn bấm nút cuối cùng. Gửi hai lần cùng một prompt thì báo "đã có sẵn
trong hàng chờ" chứ không thêm dòng trùng.

`panel.js` có thêm `chrome.storage.onChanged` để ô nhập tự cập nhật khi bảng đang mở.
Thiếu đoạn đó thì prompt vào kho rồi mà ô vẫn hiện nội dung cũ, nhân sự tưởng hỏng.

### Khi sửa

Sửa `loi-nhac-content.js` xong mà chạy ở máy thì **phải khởi động lại `may-chu.js`**.
Node nhớ module, máy chủ đang chạy vẫn dùng bản cũ, biểu hiện là `promptAnh` rỗng và khối
ảnh không có nút nào. Đã mất công một lần vì chuyện này.

Sửa `manifest.json` của extension thì phải vào `chrome://extensions` bấm **Tải lại**.

---

## 4d. Trang Quản trị

Địa chỉ: `/quan-tri.html`. Cố ý KHÔNG có đường dẫn tới nó từ trang tin, để nhân sự không
vô tình mở. Muốn vào thì gõ thẳng địa chỉ.

### Mật khẩu riêng, không dùng lại mã của nhân sự

| Biến | Ai giữ | Dùng cho |
|---|---|---|
| `MA_TRUY_CAP` | cả nhóm nhân sự | Hỏi nhanh, Tạo content |
| `MA_QUAN_TRI` | chỉ người quản lý | Trang Quản trị |

Trang này cho thấy ai dùng bao nhiêu lượt. Đó là chuyện của người quản lý, không phải
chuyện cả nhóm xem được, nên phải là biến riêng.

Hàm `thong-ke` nhận **POST** chứ không GET: mật khẩu nằm trong thân yêu cầu, không lọt
vào thanh địa chỉ, lịch sử trình duyệt hay nhật ký máy chủ. Chưa đặt `MA_QUAN_TRI` thì
hàm từ chối, giống hai cửa còn lại của app.

Trang giữ mật khẩu trong `sessionStorage` chứ không `localStorage`: đóng tab là mất, phải
nhập lại. Để dính trên một máy dùng chung thì hớ.

### Nhật ký ghi thế nào

Kho Blobs `nhat-ky`, **mỗi sự kiện một blob riêng**, khóa dạng `YYYY-MM-DD/<id>`.

Cố ý không gom cả ngày vào một blob rồi đọc ra ghi đè: hai người bấm cùng lúc thì cả hai
đọc được bản cũ, người ghi sau đè mất sự kiện của người ghi trước. Mỗi sự kiện một khóa
thì không bao giờ tranh nhau, đổi lại lúc đọc phải liệt kê. Với vài chục lượt mỗi ngày,
liệt kê rẻ hơn nhiều so với việc mất số liệu.

`ghiSuKien` **không bao giờ ném lỗi ra ngoài**. Nhật ký hỏng thì người dùng vẫn phải lấy
được bài của họ. Ghi log là việc phụ, không được làm hỏng việc chính.

Ghi **sau** cổng mã truy cập, cố ý: người gõ sai mã không phải người dùng thật, đưa vào
thống kê chỉ làm nhiễu số liệu.

Giữ 90 ngày. Dọn phần cũ ngay trong hàm `thong-ke` với xác suất 1/10 mỗi lần mở trang,
để không phải lần nào cũng quét cả kho.

### Ngày theo giờ Việt Nam

`ngayVN()` cộng 7 tiếng trước khi cắt lấy phần ngày. Máy chủ Netlify chạy giờ UTC; bỏ
bước này thì mọi lượt dùng từ 0h tới 7h sáng giờ Việt bị đếm sang ngày hôm trước. Trang
quản trị cũng cộng 7 tiếng khi hiện giờ từng dòng lịch sử.

### Tên nhân sự

App không có tài khoản, cố ý, vì dựng đăng nhập cho vài người dùng nội bộ là quá tay.
Thay vào đó hỏi tên MỘT LẦN ở lần đầu dùng Tạo content hoặc Hỏi nhanh, trình duyệt nhớ
trong `localStorage` khóa `nep-toc-ten`, gửi kèm mỗi yêu cầu.

Không ép: bỏ trống vẫn dùng app bình thường, chỉ là vào thống kê dưới tên `(không tên)`.
Đổi tên ở dòng cuối trang tin.

### Công thức tính dùng chung hai đường chạy

`netlify/functions/chung/gop-so-lieu.js` viết bằng **CommonJS**, chứa toàn bộ phần tính
thuần, không đụng kho lưu trữ. Hai nơi dùng chung:
- `chung/nhat-ky.mjs` (ESM, đọc ghi Netlify Blobs)
- `nep-toc-app/may-chu.js` (CommonJS, giữ nhật ký trong bộ nhớ)

Viết bằng CommonJS vì ESM import được CommonJS, chiều ngược lại thì không. Chép công thức
ra hai chỗ thì sớm muộn con số ở máy và con số trên mạng lệch nhau, mà lệch số liệu thì
không ai biết bên nào đúng.

Chạy ở máy thì nhật ký nằm trong bộ nhớ, **tắt máy chủ là mất**. Đủ để thử giao diện quản
trị mà không phải cài thêm gì. Đặt `MA_QUAN_TRI` trước khi chạy `may-chu.js` thì mới vào
được trang quản trị ở máy.

### Xuất CSV

Nút "Tải lịch sử về máy" xuất file CSV mở bằng Excel. File có **BOM ở đầu**, bắt buộc:
thiếu nó thì Excel trên Windows đọc UTF-8 thành ký tự lạ, tên tiếng Việt nát hết.

### Bẫy CSS, lần thứ hai

`.qt-o` và `.hop` đều phải có `min-width: 0`. Ô lưới mặc định `min-width: auto` nên không
bao giờ hẹp hơn nội dung. Bảng có `min-width: 520px`, thế là trên điện thoại 375px ô bị
kéo giãn ra 522px và tràn khỏi màn hình. Đây là lần thứ hai vấp đúng chỗ này trong app.
**Quy tắc: hễ đặt một bảng cuộn ngang vào trong ô lưới, đặt luôn `min-width: 0` cho ô đó.**

---

## 5. Ba cửa có khóa, không cửa nào mở sẵn

App bỏ tầng trả phí theo yêu cầu, nhưng **không bỏ tầng chặn**. Bài học SỨC BẬT: hàm nền
để trần thì ai biết đường dẫn cũng ngồi bấm cả ngày, đốt sạch credit mà không ai hay.

| Hàm | Khóa | Đặt ở đâu |
|---|---|---|
| `phan-tich` | header `x-khoa-noi-bo` khớp env `KHOA_NOI_BO` | **CẢ HAI**: env Netlify **và** GitHub Secrets |
| `hoi-background` | token của người đã đăng ký, HOẶC `MA_TRUY_CAP` + trần lượt/ngày theo IP | env Netlify |
| `thong-ke` | mật khẩu riêng `MA_QUAN_TRI` | env Netlify |
| `content-da-tao` | token, hoặc `MA_TRUY_CAP` (không gọi API nên không cần trần lượt) | env Netlify |
| `dang-ky` | `MA_TRUY_CAP` để cấp token; việc `kiem` thì không cần | env Netlify |
| `gop-y` | gửi thì KHÔNG cần gì (cố ý); đọc lại cần `MA_QUAN_TRI` | env Netlify |

**Thiếu `KHOA_NOI_BO` ở GitHub Secrets** thì bộ quét 7h sáng vẫn chạy và vẫn lấy tin,
nhưng không viết được gợi ý content nào. Triệu chứng: tin mới về đều nhưng không bài nào
có câu mở bài.

Cả hai hàm **mặc định đóng**: chưa đặt biến thì từ chối chạy, không phải mở toang.

Mã truy cập Hỏi nhanh: nhân sự gõ một lần, trình duyệt nhớ trong `localStorage`. Mã không
nằm trong mã nguồn trang. Gõ sai thì mã bị xóa để lần sau hỏi lại. Trần mặc định 60 lượt
mỗi ngày cho một IP, đổi bằng env `TRAN_LUOT_NGAY`.

---

## 6. Đưa lên Netlify

**ĐÃ LÀM XONG ngày 17/08/2026.** Live tại **https://nep-toc.netlify.app**, repo riêng tư
`github.com/vuhuyhai/nep-toc`, site Netlify tên `nep-toc` team Vu Hai, deploy tự động từ
nhánh main, GitHub Actions đã bật quyền Read and write. Netlify đọc đúng netlify.toml.
Còn lại đúng bước 4, 5, 6 bên dưới (ba biến môi trường + một GitHub secret).
Các bước 1, 2, 3, 7 giữ lại để tham khảo khi dựng app tin kế tiếp.


1. Đẩy `nep-toc-deploy` lên một repo GitHub **riêng tư**.
2. Netlify > Add new site > Import from Git. Netlify tự đọc `netlify.toml`
   (publish `nep-toc-app`, functions `netlify/functions`).
3. **Đổi tên site thành `nep-toc`.** Netlify đặt tên ngẫu nhiên khi tạo, mà địa chỉ
   `nep-toc.netlify.app` đã ghi cứng trong `URL_PHANTICH` của `thu-thap.js` và trong
   thẻ meta. Đặt tên khác thì phải sửa cho khớp.
4. Site configuration > Environment variables, thêm ba biến (đánh dấu **secret**):
   - `ANTHROPIC_API_KEY`
   - `KHOA_NOI_BO` (tự đặt, chuỗi dài ngẫu nhiên)
   - `MA_TRUY_CAP` (mã nhân sự gõ vào, đặt dễ nhớ)
   - `MA_QUAN_TRI` (mật khẩu trang /quan-tri.html, CHỈ người quản lý biết)
5. **Deploys > Trigger deploy.** Biến môi trường mới **chỉ vào hàm nền sau khi deploy
   lại**. Bỏ bước này thì hàm vẫn báo `chua_co_key`, nhìn y hệt như gõ sai tên biến. Đây
   là bẫy đã mất công nhất ở app DẪN DẮT.
6. GitHub repo > Settings > Secrets and variables > Actions, thêm `KHOA_NOI_BO` **đúng
   giá trị** đã đặt ở Netlify.
7. GitHub repo > Settings > Actions > General > Workflow permissions = **Read and write**,
   không thì bước commit dữ liệu mới bị từ chối.

Kiểm nhanh sau khi deploy:

```bash
curl -s -X POST https://nep-toc.netlify.app/.netlify/functions/phan-tich -H "content-type: application/json" -H "x-khoa-noi-bo: KHOA_CUA_ANH" --data "{\"tieuDe\":\"Study finds strength training helps postmenopausal women\",\"nhom\":\"nu\"}"
```

Trả về JSON có `hook` và `gocViet` là chạy đúng.

---

## 7. Chỉnh app

**Thêm hoặc bớt nguồn:** sửa `cau-hinh.json`, đổi `trangThai` giữa `bat` và `tat`. Nguồn
bỏ đi thì **để lại kèm `lyDo`**, đừng xóa hẳn.

**Đổi giọng gợi ý content:** sửa `netlify/functions/loi-nhac-phan-tich.js`, rồi tăng
`WA_VER` trong `thu-thap.js` để bắt viết lại toàn bộ kho. Không tăng thì bài cũ giữ nguyên
gợi ý cũ.

**Nới trần số bài mỗi tab:** `soTinKhoaHoc`, `soTinNu`, `soTinXuHuong`, `soTinVN` trong
`cau-hinh.json`. Cắt trần riêng từng nhóm, để nhóm đăng dày không lấn chỗ nhóm đăng thưa.

**Viết bù gợi ý cho kho:** bấm `VIET-BU-GOI-Y.bat`, mỗi lần làm tối đa 150 bài. Kho còn
nhiều thì chạy lại nhiều lần, bài đã xong không bị làm lại.
