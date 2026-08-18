# NẾP TÓC — Tin ngành Tóc & Vận hành salon

**Live: https://nep-toc.netlify.app** · repo riêng tư `vuhuyhai/nep-toc` · quét tự động 7h sáng

Công cụ của Vũ Hải. Mỗi sáng mở ra là có nguyên liệu viết content trong ngày: tin nghề,
nghiên cứu da liễu và xu hướng ngành tóc đã dịch sang tiếng Việt, kèm **một câu mở bài
viết sẵn** và **góc triển khai**. Bài nào dễ viết sai thành lời hứa thì có thêm câu **Lưu ý**.

**Ai nói với ai:** đây là Vũ Hải nói với **chủ salon**, không phải salon nói với khách.
Nhầm chiều này là ra bài bán dịch vụ làm tóc, sai hoàn toàn.

App là bản thứ năm trong bộ app tin ngành, dựng từ khung của VÓC DÁNG.

---

## Dùng ngay trên máy (không cần deploy)

Máy đã có Node.js. Chỉ cần bấm đúp:

| File | Việc nó làm |
|---|---|
| `MO-APP.bat` | Mở app ở `http://localhost:8095` |
| `CAP-NHAT-TIN.bat` | Quét tin mới từ 54 nguồn và viết gợi ý content |
| `VIET-BU-GOI-Y.bat` | Không quét tin mới, chỉ viết tiếp gợi ý cho bài còn thiếu |

Cổng 8095 chứ không phải 8090: VÓC DÁNG đang giữ 8090, chạy cả hai cùng lúc thì đụng nhau.

Muốn có gợi ý content thì đặt khóa Anthropic **một lần** rồi mở lại cửa sổ:

```bash
setx ANTHROPIC_API_KEY "sk-ant-..."
```

Chưa có khóa thì app vẫn chạy và vẫn có tin, chỉ thiếu phần câu mở bài.

---

## Bốn tab nội dung

| Tab | Nội dung | Dùng để viết gì |
|---|---|---|
| **Nghề & Salon** | Modern Salon, Salon Today, American Salon, Hairdressers Journal, r/Hairstylist | Tab chính. Nhân sự, giá dịch vụ, khách quay lại, mô hình kinh doanh |
| **Khoa học** | Tạp chí da liễu Wiley, ScienceDaily, nghiên cứu rụng tóc | Dẫn chứng thật để đào tạo thợ và trả lời khách hỏi khó |
| **Xu hướng & Khách** | Allure, Elle, Byrdie, xu hướng tóc, ba nhóm Reddit | Biết khách muốn gì trước khi khách bước vào ghế |
| **Việt Nam** | Báo Việt, tin thu hồi sản phẩm, thị trường làm đẹp trong nước | Bắt sóng tin nóng, chọn hàng nhập cho đúng |

### Nút Tạo content

Trên mỗi thẻ tin có nút **Tạo content**. Chọn đăng ở đâu, chọn phong cách, chọn độ dài,
rồi bấm tạo. Xong bấm **Chép toàn bộ** là dán đi dùng được.

| Định dạng | Phong cách | Kích cỡ |
|---|---|---|
| **Bài Facebook** | Ca bệnh salon · Đọc con số · Gỡ hiểu lầm · Làm được ngay tuần này · Nói thật với nhau | Ngắn · Vừa · Dài |
| **Kịch bản TikTok** | Hậu trường nghề · Chuyên gia · Thông tin nhanh · Kể chuyện · Bắt trend | 15 · 30 · 60 giây |

Năm phong cách Facebook đặt lại hết theo nghề, không lấy nguyên của app trước. "Ca bệnh
salon" mở bằng một tình huống có thật trong tiệm rồi lần ra nguyên nhân. "Đọc con số" lấy
một con số trong bài gốc rồi quy về con số của một salon tám ghế.

**Ảnh đi kèm** có sẵn prompt tạo ảnh, một dòng, dán thẳng sang công cụ sinh ảnh được. Cài
extension **ChatGPT Auto Ảnh** thì có nút gửi thẳng sang hàng chờ. Prompt theo quy ước ảnh
chung: thẩm mỹ châu Á, giàu cảm xúc, kể bằng ẩn dụ, và **không bao giờ soi tóc của ai**
(cấm cận cảnh đỉnh đầu hói, tóc rụng trên lược, ảnh trước sau, cảnh đếm sợi tóc).

Phần viết content chạy bằng **Gemini** khi có `GEMINI_API_KEY`, hỏng thì tự lùi về Claude
và ghi rõ vào nhật ký. Hỏi nhanh vẫn dùng Claude vì cần tra web.

### Tab Đã tạo

Mọi bài content đã tạo đều tự lưu, kể cả khi đóng hộp giữa chừng. Lưu ở máy chủ nên đổi
máy hay đổi trình duyệt vẫn còn. Giữ 180 ngày, tìm được theo bài, theo người tạo, theo
nội dung.

---

## Chân dung người đọc

Mọi bài AI sinh ra đều nhắm vào **anh Dũng**, 34 tuổi, chủ salon hai cơ sở, tám ghế, mười
một nhân sự. Học nghề năm 17, mở tiệm riêng năm 26. Vẫn đứng ghế bốn tới năm tiếng mỗi
ngày vì khách quen đòi đúng tay anh.

Bản chuẩn ở [`CHAN-DUNG-CHU-SALON.md`](CHAN-DUNG-CHU-SALON.md), dựng từ số liệu và lời nói
có thật, ghi nguồn từng dòng. Bản rút gọn nạp vào lời nhắc AI ở
`netlify/functions/chung/chan-dung.js`.

Điều quan trọng nhất: **anh không sở hữu một cái salon, anh đang LÀ cái salon.** Anh nói ra
là muốn đông khách hơn; thứ anh thật sự tìm là một hệ thống vẫn chạy khi anh không đứng ở
đó. Bài phải chạm ít nhất một trong năm câu anh tự nhủ, hoặc chuyện giữ thợ, giá dịch vụ,
khách quay lại, quy trình trong tiệm.

Nỗi sợ số một của anh là thợ ra mở riêng. H-OE trả lời đúng chỗ đó: giữ người bằng lộ
trình, không bằng dây trói. Con người là nhân, lợi nhuận là quả.

---

## Ba chốt an toàn đã dựng sẵn

Ngành tóc viết sai thì hại người đọc thật, nên bộ quét có ba tầng chặn chạy **trước** mọi
bộ lọc khác:

1. **Quảng cáo thần dược** bị bỏ thẳng: cam kết mốc thời gian mọc tóc, hết hói vĩnh viễn,
   phục hồi 100%, thuốc gia truyền, số điện thoại trong bài.
2. **Nội dung hại tâm lý** bị bỏ thẳng: chế giễu hói, chế giễu tóc thưa, gán tóc xấu với
   ế hay với thất bại.
3. **Bài lạc chủ đề** bị bỏ: son, móng, da, thời trang, tin hình sự xảy ra tại salon, hoạt
   động cắt tóc từ thiện.

Cộng thêm **câu Lưu ý** tự sinh cho mọi bài về thuốc mọc tóc, cấy tóc, bệnh da đầu, hóa
chất, hoặc có con số phục hồi ấn tượng.

Lời nhắc AI cũng cấm hứa con số (cả về tóc lẫn về doanh thu), cấm chê ngoại hình, cấm nói
thay bác sĩ, và bắt nói rõ giới hạn: dầu gội chăm phần tóc đã mọc, không đổi được nang tóc.

**Bộ lọc quét lại TOÀN BỘ kho mỗi lần chạy**, không chỉ tin mới. Chạy
`node thu-bo-loc.js` để thử bộ lọc bằng 19 mẫu phải chặn và 14 mẫu phải giữ; sửa từ khóa
xong nên chạy lại file này trước.

---

## Cấu trúc

```
nep-toc-deploy/
├─ CHAN-DUNG-CHU-SALON.md    chân dung người đọc, bản chuẩn, có nguồn
├─ nep-toc-app/              ← thư mục publish
│  ├─ index.html             giao diện, 6 tab
│  ├─ chung.css              hệ màu nâu đồng #8A5A3B, đã đo tương phản WCAG
│  ├─ cau-hinh.json          54 nguồn đang bật + 18 nguồn đã chết (ghi rõ lý do)
│  ├─ thu-thap.js            bộ quét, lọc, chấm điểm
│  ├─ thu-bo-loc.js          thử ba bộ lọc an toàn bằng mẫu
│  ├─ kiem-tra-nguon.js      kiểm nguồn còn sống không
│  ├─ sinh-icon.js           tự sinh icon PNG bằng zlib, không cần thư viện ảnh
│  ├─ may-chu.js             máy chủ chạy tại máy, cổng 8095
│  └─ du-lieu/tin-tuc.json   kho tin
├─ netlify/functions/
│  ├─ chung/chan-dung.js     chân dung rút gọn, ba lời nhắc dùng chung
│  ├─ loi-nhac-content.js    lời nhắc sinh bài Facebook và kịch bản TikTok
│  ├─ loi-nhac-phan-tich.js  lời nhắc viết gợi ý content
│  ├─ loi-nhac-hoi.js        lời nhắc trợ lý Hỏi nhanh
│  ├─ phan-tich.js           hàm viết gợi ý, có khóa nội bộ
│  ├─ hoi-background.mjs     trợ lý tra web + tạo content, có mã truy cập + trần lượt
│  └─ hoi-ket-qua.mjs        lấy kết quả
└─ .github/workflows/        quét tự động 7h sáng
```

Chi tiết vận hành, các bẫy đã trả giá, và cách đưa lên Netlify: xem
[`nep-toc-app/HUONG-DAN.md`](nep-toc-app/HUONG-DAN.md).
