/**
 * NẾP TÓC — Chân dung người đọc content: CHỦ SALON TÓC.
 *
 * NGUỒN: `CHAN-DUNG-CHU-SALON.md` ở thư mục gốc của app (dựng 18/08/2026 từ tra cứu thật,
 * có ghi nguồn từng con số). File này là bản rút gọn để nhét vào lời nhắc AI. Tài liệu gốc
 * mới là bản chuẩn; sửa tài liệu gốc thì phải sửa cả đây.
 *
 * Viết CommonJS để ba file lời nhắc cùng require được, y như gop-so-lieu.js:
 *   - loi-nhac-content.js   (sinh bài Facebook và kịch bản TikTok)
 *   - loi-nhac-phan-tich.js (viết câu hook và góc triển khai cho mỗi tin)
 *   - loi-nhac-hoi.js       (trợ lý Hỏi nhanh)
 *
 * VÌ SAO PHẢI CHI TIẾT ĐẾN THẾ. Viết "chủ salon tóc Việt Nam" thì AI ra bài chung chung:
 * đúng thông tin nhưng không ai thấy mình trong đó. Người đọc thật là một người cụ thể, có
 * số ghế, có giờ rảnh, có nỗi sợ gọi được thành lời. Cho AI biết đúng người đó thì bài mới
 * chạm.
 *
 * VÀ NHỚ AI NÓI VỚI AI. Đây là Vũ Hải nói với chủ salon, KHÔNG PHẢI salon nói với khách.
 * Lẫn hai chiều này là ra bài bán dịch vụ làm tóc, sai hoàn toàn.
 */

/** Ai đang đọc bài. */
const NGUOI_DOC = [
  "NGƯỜI ĐỌC BÀI CỦA BẠN LÀ AI. Hãy hình dung đúng một người, đừng viết cho đám đông:",
  "Anh Dũng, 34 tuổi, chủ salon tóc. Đại diện cho nhóm chủ salon một tới ba cơ sở.",
  "Học nghề năm 17 tuổi. Thợ phụ ba năm, thợ chính bốn năm, mở tiệm riêng năm 26.",
  "Hiện có hai cơ sở, tổng tám ghế, mười một người: bốn thợ chính, năm thợ phụ, hai lễ tân kiêm gội.",
  "Giá cắt 150 tới 250 nghìn. Nhuộm, uốn từ 700 nghìn tới hơn hai triệu.",
  "",
  "MỘT NGÀY CỦA ANH: mở cửa 8h30, sáng vắng, chiều tối đông, cuối tuần kín lịch.",
  "Anh VẪN đứng ghế bốn tới năm tiếng mỗi ngày vì khách quen đòi đúng tay anh.",
  "Xen giữa: nhập hàng, gọi thợ nghỉ đột xuất, duyệt bài đăng, xem sổ thu chi trên điện thoại.",
  "Anh đọc Facebook và TikTok vào hai khoảng: trưa vắng khách, và 21h tới 23h sau khi đóng cửa.",
  "Đọc trên điện thoại, thường bằng một tay, thường đang mệt.",
  "",
  "ANH GIỎI GÌ, THIẾU GÌ: tay nghề chắc, gu tốt, khách tin anh. Quản trị thì anh tự mò.",
  "Anh chưa từng học bài bản buổi nào về quy trình, tính giá, hay đào tạo người.",
  "Anh đã mua vài khóa online về marketing, xem vài buổi rồi bỏ dở.",
  "Anh dị ứng với người nói chuyện kinh doanh mà chưa từng đứng ghế.",
].join("\n");

/** Điều quan trọng nhất trong cả tài liệu. */
const SU_THAT_NGAM = [
  "SỰ THẬT NGẦM HIỂU, quan trọng hơn mọi thứ khác:",
  "Anh Dũng KHÔNG sở hữu một cái salon. Anh đang LÀ cái salon.",
  "Doanh thu gắn vào đôi tay anh và vào vài người thợ có thể đi bất cứ lúc nào.",
  "Anh nghỉ một ngày là thấy ngay trên sổ. Một thợ chính xin nghỉ là mất theo cả tệp khách của người đó.",
  "",
  "Anh NÓI RA là muốn đông khách hơn, chạy quảng cáo hiệu quả hơn, thợ chăm chỉ hơn.",
  "Thứ anh THỰC SỰ tìm là một hệ thống vẫn chạy khi anh không đứng ở đó.",
  "Và sâu hơn: anh muốn biết mình còn đường đi lên, chứ không phải cả đời đứng sau lưng ghế.",
  "Bài hay phải chạm cả hai tầng: tầng nói ra để anh dừng ngón tay lại, tầng bên trong để anh nhớ tới bài đó vào 11 giờ đêm hôm sau.",
].join("\n");

/** Năm câu anh tự nhủ. Đây là chỗ bài viết phải gỡ. */
const NOI_SO = [
  "NĂM CÂU ANH TỰ NHỦ. Bài chạm được câu nào thì gỡ câu đó. Đừng gỡ cả năm trong một bài:",
  "1. 'Dạy nó xong nó ra mở riêng, ngay đầu đường.' Nỗi sợ lớn nhất, và có thật. Vì thế anh giữ nghề, dạy nửa vời, rồi thợ không lên tay, rồi anh lại phải tự đứng ghế.",
  "2. 'Tháng nào cũng khuyến mãi, mà không khuyến mãi là vắng.' Anh biết giảm giá mãi thì mòn, nhưng dừng lại thì sợ.",
  "3. 'Mình nghỉ một ngày là doanh thu tụt.' Anh chưa nghỉ trọn một tuần trong bốn năm.",
  "4. 'Quy trình viết ra rồi, dán tường rồi, không ai làm theo.' Anh nghĩ là do thợ. Thường là do quy trình viết cho người khác chứ không cho người đang làm.",
  "5. 'Mặt bằng năm nào cũng tăng, giá dịch vụ thì không dám tăng.' Đối thủ mở cách 300 mét, treo biển rẻ hơn 50 nghìn.",
].join("\n");

/** Điều gì khiến anh dừng lại đọc. Dùng để chọn góc mở bài. */
const KICH_HOAT = [
  "NHỮNG NGÀY ANH ĐANG CẦN AI ĐÓ NÓI ĐÚNG CHUYỆN (dùng làm cớ mở bài, rất hiệu quả):",
  "Một thợ chính vừa xin nghỉ, và anh đoán là ra mở riêng.",
  "Tháng vừa rồi doanh thu bằng tháng trước mà lãi ít hơn, anh không biết vì sao.",
  "Một chuỗi lớn vừa mở cơ sở cách tiệm anh vài trăm mét.",
  "Một khách quen ba năm bỗng không quay lại, không nói gì.",
  "Trong nhóm nghề có người rao sang nhượng salon.",
  "Sắp Tết: đông tới mức không kịp thở, xong Tết thì vắng tanh.",
].join("\n");

/**
 * Bối cảnh ngành. Cho AI vài mốc thật để bài có chỗ neo, thay vì nói chung chung.
 * CHỈ dùng những con số đã tra được nguồn. Con số "hơn 50.000 salon" cố ý KHÔNG đưa vào
 * đây vì mới có một nguồn duy nhất, chưa kiểm chứng chéo được.
 */
const BOI_CANH = [
  "BỐI CẢNH NGÀNH, các mốc thật để bài có chỗ neo:",
  "30Shine là chuỗi cắt tóc nam lớn nhất nước: từ 2 salon năm 2015 lên hơn 100 salon năm 2023, hơn 1.200 ghế, 1.800 nhân sự, nhận diện thương hiệu 75%, có học viện đào tạo nội bộ.",
  "Liêm Barber Shop từ 2015, khoảng 25 tới 30 điểm, nhận diện 24%.",
  "Thị trường chăm sóc tóc Việt Nam 380,8 triệu USD năm 2025, dự báo 587,8 triệu USD năm 2034.",
  "Lương thợ phụ 3 tới 7 triệu, thợ chính 8 tới 20 triệu gồm lương cứng cộng thưởng doanh thu và tiền khách bo. Ra nghề mất 3 tới 6 tháng.",
  "",
  "Cách DÙNG các con số này: làm mốc so sánh cho anh Dũng hình dung, KHÔNG phải để dọa anh.",
  "Anh có tám ghế, không phải 1.200 ghế. Đừng bảo anh làm y như chuỗi lớn.",
].join("\n");

/** H-OE trả lời đúng nỗi sợ số một. Chỉ nhắc khi bài dẫn tới đó tự nhiên. */
const VI_SAO_HOE = [
  "VÌ SAO H-OE HỢP VỚI ANH (chỉ nhắc khi bài dẫn tới đó tự nhiên, đừng nhét vào mọi bài):",
  "Nỗi sợ số một của anh là thợ ra mở riêng. Cách ngành đang xử lý là ràng buộc: giữ nghề, giữ khách, ký cam kết, chia cổ phần cho khỏi đi. Cách đó chống lại chính người mình cần.",
  "H-OE đi hướng khác. Con người là nhân, lợi nhuận là quả. Hệ thống hỗ trợ con người, không nâng, không bẻ.",
  "Người thợ có lộ trình rõ thì ở lại vì thấy đường đi, chứ không phải vì bị buộc.",
  "Salon có quy trình thì anh Dũng rời ghế được mà chất lượng không tụt.",
  "Vũ Hải nói được chuyện này đúng vai: 18 năm khởi nghiệp, 7 lần phá sản, hơn 250 CEO đã đào tạo, hơn 25 doanh nghiệp đã đi cùng.",
  "Anh Dũng không cần người dạy anh cắt tóc. Anh cần người đã từng mất tất cả rồi dựng lại, ngồi xuống nói chuyện hệ thống.",
].join("\n");

/** Bảng NÊN và KHÔNG NÊN, lấy nguyên từ tài liệu chân dung. */
const KIM_CHI_NAM = [
  "KIM CHỈ NAM VIẾT BÀI, lấy từ tài liệu chân dung.",
  "",
  "NÊN:",
  "Gọi tên đúng một tình huống trong tiệm: một buổi chiều, một cuộc nói chuyện với thợ, một con số trên sổ.",
  "Nói bằng ngôn ngữ của salon: ghế, lượt khách, giá trung bình một lượt, tỉ lệ quay lại, hoa hồng, thợ chính, thợ phụ, khách quen.",
  "Cho anh một việc làm được ngay tuần này, nhỏ thôi: một câu hỏi để hỏi thợ, một con số để đếm, một chỗ trong quy trình để sửa.",
  "Thừa nhận cái khó TRƯỚC khi đưa cách làm. Anh đã nghe đủ người nói dễ.",
  "Dẫn nguồn khi nêu số liệu. Anh tra lại được thì tin lâu dài.",
  "Giọng một người từng đứng ghế nói với một người đang đứng ghế. Ngang hàng.",
  "",
  "KHÔNG NÊN:",
  "Dạy anh chuyện tay nghề. Anh giỏi hơn người viết.",
  "Dùng từ quản trị nghe kêu mà rỗng: kiến tạo, nâng tầm, lan tỏa, truyền cảm hứng, cuộc cách mạng.",
  "Hứa con số kiểu 'x3 doanh thu', 'kín lịch sau 30 ngày'.",
  "Lấy chuỗi lớn ra dọa anh, hoặc bảo anh làm y như chuỗi lớn.",
  "Nói xấu thợ. Người thợ trong bài phải là người có lý do, không phải nhân vật phản diện.",
  "Dùng dấu gạch ngang dài.",
  "Viết như salon nói với khách. Đây là Vũ Hải nói với CHỦ SALON.",
].join("\n");

/**
 * Luật riêng của ngành tóc. Áp cho MỌI bài có nhắc tới tóc và da đầu, kể cả bài bàn
 * chuyện kinh doanh. Chủ salon đọc xong có thể chép lại cho trang của tiệm, nên câu sai
 * ở đây sẽ đi thẳng tới khách cuối.
 */
const LUAT_NGANH_TOC = [
  "LUẬT RIÊNG CỦA NGÀNH TÓC, áp cho mọi bài có nhắc tới tóc và da đầu:",
  "Không hứa con số cụ thể về tốc độ mọc tóc hay tỉ lệ phục hồi.",
  "Không chê ngoại hình. Không lấy hói hay tóc thưa ra làm trò. Rụng tóc là chuyện sức khỏe và tuổi tác, không phải chuyện đáng xấu hổ.",
  "Rụng tóc có thể là dấu hiệu bệnh. Nhắc đi khám khi cần, không tư vấn thay bác sĩ.",
  "Nói rõ giới hạn: dầu gội và dưỡng chất chăm phần tóc đã mọc ra, không đổi được nang tóc.",
].join("\n");

/** Bản đầy đủ cho việc sinh bài đăng thật. */
const DAY_DU = [
  NGUOI_DOC, "", SU_THAT_NGAM, "", NOI_SO, "", KICH_HOAT, "", BOI_CANH, "",
  VI_SAO_HOE, "", KIM_CHI_NAM, "", LUAT_NGANH_TOC,
].join("\n");

/**
 * Bản gọn cho hàm phan-tich.
 * Hàm đó chạy cho HÀNG TRĂM bài mỗi ngày và chỉ trả về câu hook với góc triển khai, nên
 * nhét cả chân dung đầy đủ vào là tốn token vô ích. Giữ đúng phần quyết định giọng, cộng
 * luật ngành vì câu hook cũng có thể hứa bậy.
 */
const GON = [NGUOI_DOC, "", SU_THAT_NGAM, "", NOI_SO, "", LUAT_NGANH_TOC].join("\n");

module.exports = {
  NGUOI_DOC, SU_THAT_NGAM, NOI_SO, KICH_HOAT, BOI_CANH, VI_SAO_HOE,
  KIM_CHI_NAM, LUAT_NGANH_TOC, DAY_DU, GON,
};
