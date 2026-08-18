# Đưa NẾP TÓC lên mạng

Bảy bước. Làm đúng thứ tự. Đừng nhập khóa vào bất kỳ file nào trong repo, chỉ nhập ở
trang quản trị của Netlify và GitHub.

---

## 1. Đẩy lên GitHub

Repo đã khởi tạo sẵn và đã commit lần đầu ở máy. Chỉ còn nối với GitHub.

Tạo repo **riêng tư** tên `nep-toc` trong tài khoản `vuhuyhai`, đừng tích thêm README hay
.gitignore nào. Rồi chạy trong thư mục `nep-toc-deploy`:

```bash
git remote add origin https://github.com/vuhuyhai/nep-toc.git
```

```bash
git push -u origin main
```

## 2. Tạo site Netlify

Add new site, Import an existing project, chọn repo `nep-toc`.

| Ô | Điền |
|---|---|
| Base directory | để trống |
| Build command | để trống |
| Publish directory | `nep-toc-app` |
| Functions directory | `netlify/functions` |

`netlify.toml` đã khai sẵn, Netlify tự đọc. Không có bước build nào.

## 3. Đổi tên site thành `nep-toc`

**Bước này bắt buộc, không phải cho đẹp.** Netlify đặt tên ngẫu nhiên khi tạo site, mà địa
chỉ `https://nep-toc.netlify.app` đã ghi cứng ở ba chỗ:

- `nep-toc-app/thu-thap.js`, hằng `URL_PHANTICH`
- `nep-toc-app/index.html`, thẻ canonical và og:url
- `.github/workflows/quet-tin.yml` gọi gián tiếp qua `thu-thap.js`

Tên sai thì bộ quét 7h sáng vẫn chạy nhưng không viết được gợi ý content nào.

Site configuration, Change site name, gõ `nep-toc`.

## 4. Nhập biến môi trường trên Netlify

Site configuration, Environment variables. Năm biến bắt buộc:

| Tên biến | Là gì | Gợi ý |
|---|---|---|
| `ANTHROPIC_API_KEY` | Khóa Claude. Dùng cho Hỏi nhanh (cần tra web) và làm đường lùi khi Gemini hỏng | Lấy ở console.anthropic.com |
| `GEMINI_API_KEY` | Khóa Gemini. Viết content chính, nhanh hơn hẳn, bậc miễn phí rộng | Lấy ở aistudio.google.com |
| `KHOA_NOI_BO` | Khóa riêng để hàm `phan-tich` không bị ai gọi bừa. Tự nghĩ ra một chuỗi dài | Ví dụ dạng `nt-` cộng 24 ký tự ngẫu nhiên |
| `MA_TRUY_CAP` | Mã người dùng nhập một lần khi đăng ký | **Đừng đặt dễ đoán.** VÓC DÁNG đang để `Ladysfit`, đoán ra trong ba giây |
| `MA_QUAN_TRI` | Mật khẩu vào `/quan-tri.html`. Khác hẳn mã trên | Chỉ mình anh giữ |

Bốn biến tùy chọn, không nhập thì chạy theo mặc định:

| Tên biến | Mặc định | Khi nào đổi |
|---|---|---|
| `TRAN_LUOT_NGUOI` | `8` | Số lượt tạo content mỗi người mỗi ngày. Để 8 vì app này dùng chung khóa API với bốn app kia |
| `TRAN_LUOT_NGAY` | `30` | Trần theo địa chỉ IP, lớp chặn thứ hai |
| `GEMINI_MODEL` | tự dò | Chỉ đặt khi muốn ghim một tên model cụ thể |
| `MAX_PHANTICH` | `60` | Số bài mỗi lần quét được viết gợi ý |

## 5. Nhập secret trên GitHub

Repo, Settings, Secrets and variables, Actions, New repository secret.

| Tên | Giá trị |
|---|---|
| `KHOA_NOI_BO` | **Đúng chuỗi** đã nhập ở Netlify. Lệch một ký tự là bộ quét 7h sáng không viết được gợi ý nào |

Đây là secret duy nhất GitHub cần. Khóa AI cố ý **không** để ở đây: khóa chỉ nằm một chỗ
là Netlify, bộ quét đi vòng qua hàm nền đã deploy.

## 6. Bấm Trigger deploy

**Đây là chỗ đã dính hai lần ở app trước.** Thêm biến môi trường xong, Netlify **không** tự
deploy lại. Bản đang chạy vẫn là bản cũ, không thấy biến mới. Lần thứ hai app âm thầm lùi
về Claude mà không ai biết.

Deploys, Trigger deploy, Deploy site. Xong thì vào xem danh sách deploy, phải thấy một bản
mới sau thời điểm anh nhập biến.

## 7. Kiểm bản online

Ba việc, làm lần lượt:

**a. Trang tin lên chưa.** Mở `https://nep-toc.netlify.app`, phải thấy 480 bài, bốn tab, tab
đầu là Nghề & Salon.

**b. Hàm nền sống chưa.** Chạy lệnh này, thay `KHOA_CUA_ANH` bằng `KHOA_NOI_BO` vừa đặt:

```bash
curl -s -X POST https://nep-toc.netlify.app/.netlify/functions/phan-tich -H "content-type: application/json" -H "x-khoa-noi-bo: KHOA_CUA_ANH" --data "{\"tieuDe\":\"Salon pricing report: hair color volume is down\",\"nhom\":\"nghe\"}"
```

Trả về JSON có `tieuDeViet`, `tomTat`, `hook`, `gocViet` là chạy đúng.

**c. Bộ quét tự động.** Repo, tab Actions, chọn workflow "Quét tin ngành Tóc hằng ngày", bấm
Run workflow. Chạy xong phải thấy một commit mới của `nep-toc-bot`.

---

## Sau khi lên, việc còn lại

**Sinh thử vài chục bài rồi ĐẾM cụm mở đầu.** Đây là việc quan trọng nhất còn chưa làm
được, vì máy chưa có khóa AI nên chưa sinh được bài nào để đo.

Danh sách cụm cấm trong `loi-nhac-phan-tich.js` và `loi-nhac-content.js` hiện đang dựa
trên các cụm đã biết là hỏng ở app trước, cộng vài cụm dễ rơi vào ở ngành tóc. Đó là
phỏng đoán, chưa phải số đo. Sau khi chạy được, lấy 30 tới 50 câu hook, đếm mấy chữ đầu,
cụm nào lặp quá 10% thì thêm thẳng vào danh sách cấm. Làm y như cách đã tìm ra
"Nhiều người nghĩ" chiếm 23 trong 160 câu ở app VÓC DÁNG.

**Bộ lọc hại tâm lý chưa bắt bài nào** trong lần quét đầu. Có thể vì nguồn sạch thật, cũng
có thể vì danh sách từ khóa chưa khớp cách người ta thật sự viết. Sau vài tuần tin về, mở
nhật ký xem con số đó có nhúc nhích không. Vẫn là 0 thì phải xem lại từ khóa chứ đừng mừng.

**Extension ChatGPT Auto Ảnh** hiện chỉ nhận trang `voc-dang.netlify.app` và `localhost:8095`.
Muốn nút gửi prompt ảnh chạy trên NẾP TÓC thì phải thêm `nep-toc.netlify.app` vào
`Extension-ChatGPT-Auto-Anh/cau-noi-vocdang.js`.
