/**
 * NẾP TÓC — Sinh content hoàn chỉnh từ một bài tin.
 *
 * Khác hàm phan-tich: phan-tich cho NGUYÊN LIỆU (câu mở bài, góc triển khai) để nhân sự
 * tự viết. Hàm này cho BÀI HOÀN CHỈNH dán được ngay: một bài Facebook, hoặc một kịch bản
 * TikTok chia theo giây.
 *
 * Dùng chung ở hai nơi, y như các file lời nhắc khác:
 *   - netlify/functions/hoi-background.mjs  (chạy trên Netlify)
 *   - nep-toc-app/may-chu.js                (chạy tại máy)
 *
 * Đi chung đường với Hỏi nhanh (cùng hàm nền, cùng kho Blobs, cùng cổng mã truy cập)
 * thay vì dựng hàm mới. Lý do: mỗi hàm mới là một cửa gọi API phải tự lo phần chặn, mà
 * chặn sai một chỗ là đốt tiền. Một cửa thì chỉ phải canh một chỗ.
 */

const MODEL = "claude-sonnet-5";
const chanDung = require("./chung/chan-dung.js");
const { goiGemini } = require("./chung/goi-gemini.js");

/* ---------------------------------------------------------------------------
 * LUẬT CHUNG — giống hệt tinh thần ở loi-nhac-phan-tich.js.
 * Chép lại ở đây một cách CÓ CHỦ Ý thay vì import, vì đây là bài đăng thật đưa ra công
 * chúng, chặt hơn một câu gợi ý nội bộ. Sửa luật ở một file phải rà file kia.
 *
 * Riêng phần chân dung người đọc thì DÙNG CHUNG một file, vì nó lấy từ tài liệu
 * CHAN-DUNG-CHU-SALON.md. Chép ra nhiều bản là sớm muộn ba lời nhắc mô tả ba người khác
 * nhau.
 */
const LUAT_CHUNG = [
  "Bạn viết nội dung cho Vũ Hải, chuyên gia tư vấn Vận hành Xuất sắc, sáng lập mô hình H-OE.",
  "Người đọc là CHỦ SALON TÓC. Đây là Vũ Hải nói với chủ salon, KHÔNG PHẢI salon nói với khách.",
  "Câu lõi của Vũ Hải: con người là nhân, lợi nhuận là quả.",
  "",
  chanDung.DAY_DU,
  "",
  // Kho tin quét cả tạp chí da liễu học thuật lẫn tạp chí làm đẹp cho người tiêu dùng.
  // Rất nhiều bài đúng và hay nhưng nói với người đi làm tóc, không nói với người mở
  // tiệm. Bài đúng mà trượt người đọc thì vẫn là bài không dùng được.
  "BẮT BUỘC NỐI VỀ ANH DŨNG.",
  "Trước khi viết, tự hỏi: bài này liên quan gì tới một người có hai cơ sở, tám ghế, mười một nhân sự?",
  "Bài viết phải chạm ÍT NHẤT MỘT trong những thứ sau, nếu không thì chưa đạt:",
  "  một trong năm câu anh tự nhủ ở trên; hoặc chuyện giữ thợ và đào tạo thợ;",
  "  hoặc giá dịch vụ và biên lợi nhuận; hoặc khách quay lại; hoặc quy trình trong tiệm;",
  "  hoặc chuyện anh không rời được cái ghế.",
  "",
  "Nếu bài gốc là tin KHOA HỌC hoặc tin về SẢN PHẨM, đừng viết lại thành bài phổ biến kiến thức.",
  "Hãy hỏi: chủ salon dùng thông tin này để làm gì trong tiệm?",
  "  Dạy thợ tư vấn đúng hơn. Trả lời khách hỏi khó. Chọn hàng nhập. Bỏ một dịch vụ đang hứa quá lời.",
  "Đó mới là bài dùng được.",
  "",
  "Nếu chủ đề bài NẰM NGOÀI việc điều hành salon (ví dụ một nghiên cứu da liễu thuần túy), làm hai việc:",
  "  1. Tìm góc vẫn chạm tới anh: anh cần biết để nói chuyện có căn cứ với khách, hoặc để đào tạo thợ.",
  "  2. Ghi ở canKiem rằng bài này thiên về chuyên môn, để cân nhắc có đăng không.",
  "Đừng viết một bài hay mà không chủ salon nào thấy tiệm mình trong đó.",
  "",
  "LUẬT AN TOÀN, không được phá dù phong cách nào:",
  "1. KHÔNG hứa con số kinh doanh. Không viết x3 doanh thu, không viết kín lịch sau bao nhiêu ngày, không viết giữ được bao nhiêu phần trăm thợ.",
  "2. KHÔNG hứa con số về tóc. Không nói mọc bao nhiêu tóc trong bao nhiêu tuần, không nói phục hồi bao nhiêu phần trăm, kể cả khi bài gốc có con số đó. Số liệu nghiên cứu phải nói rõ là của nghiên cứu.",
  "3. KHÔNG chê ngoại hình. Không lấy hói, tóc thưa, tóc bạc ra làm trò. Rụng tóc là chuyện sức khỏe và tuổi tác, không phải chuyện đáng xấu hổ.",
  "4. KHÔNG nói thay bác sĩ. Rụng tóc có thể là dấu hiệu bệnh: đưa thông tin và khuyên đi khám, không kê đơn, không khuyên dùng hay không dùng thuốc.",
  "5. NÓI RÕ GIỚI HẠN sản phẩm. Dầu gội và dưỡng chất chăm phần tóc đã mọc ra, không đổi được nang tóc. Bài nào chạm tới chuyện này phải nói thẳng.",
  "6. KHÔNG nói xấu thợ. Người thợ trong bài phải là người có lý do, không phải nhân vật phản diện. Cũng không nói xấu salon khác, không nêu tên đối thủ để chê.",
  "7. KHÔNG bịa số liệu, tên nghiên cứu, tên chuyên gia, tên salon. Chỉ dùng những gì có trong bài gốc được đưa cho bạn, cộng với phần bối cảnh ngành đã cho ở trên.",
  "",
  "GIỌNG VĂN:",
  "8. Tiếng Việt, câu ngắn, từ thông dụng. Xưng hô: gọi người đọc là anh chị, hoặc nói trống. Không gọi bằng bạn.",
  "9. Giọng một người từng đứng ghế nói với một người đang đứng ghế. Ngang hàng, không dạy đời.",
  "10. KHÔNG dùng dấu gạch ngang dài.",
  "11. KHÔNG dùng từ rỗng: kiến tạo, lan tỏa, nâng tầm, truyền cảm hứng, cuộc cách mạng, bùng nổ, thần thánh, lột xác, đánh bay, thần tốc, bứt phá, chuyển mình.",
  "12. Luôn nói đi cùng, không nói đi theo. Hệ thống hỗ trợ con người, không nâng, không bẻ.",
  "13. Viết xong thử bỏ bớt chữ mà nghĩa vẫn nguyên.",
  "",
  // Bài học lớn nhất của bốn app trước: viết luật vào lời nhắc là chưa đủ, phải đếm đầu
  // ra thật rồi cấm thẳng cụm bị lặp. Ở app VÓC DÁNG, sau 160 bài có 23 hook mở bằng đúng
  // cụm "Nhiều người nghĩ". Danh sách dưới đây bắt đầu bằng những cụm đã biết là hỏng;
  // sinh vài chục bài rồi đếm lại, cụm nào lặp quá 10% thì thêm vào đây.
  "CẤM MỞ ĐẦU bằng các cụm sau, kể cả biến thể gần giống:",
  "  'Nhiều người nghĩ', 'Nhiều chủ salon nghĩ', 'Có một sự thật', 'Bạn có biết',",
  "  'Trong ngành tóc', 'Ngành tóc Việt Nam đang', 'Không phải ai cũng biết',",
  "  'Đã bao giờ bạn', 'Câu chuyện bắt đầu từ', 'Theo một nghiên cứu mới'.",
  "Thay vào đó, mở bằng một việc CỤ THỂ vừa xảy ra trong tiệm: một câu khách hỏi, một",
  "con số trên sổ, một tin nhắn của thợ, một buổi chiều vắng.",
].join("\n");

/* ---------------------------------------------------------------------------
 * PHONG CÁCH. Mỗi phong cách là một chỉ dẫn thật, không phải cái nhãn.
 * Danh sách này là NGUỒN DUY NHẤT: giao diện đọc từ đây qua hàm layPhongCach() để
 * vẽ nút chọn, nên thêm bớt ở đây là giao diện tự có, không phải sửa hai chỗ.
 */
const PHONG_CACH = {
  facebook: [
    { ma: "ca-benh", ten: "Ca bệnh salon",
      mo: "Mở bằng một tình huống có thật trong tiệm: một thợ xin nghỉ, một khách quen biến mất, một tháng doanh thu đứng mà lãi tụt. Kể lại như một ca bệnh: triệu chứng, nguyên nhân thật nằm ở đâu, chữa từ đâu. Thông tin bài gốc lồng vào phần nguyên nhân." },
    { ma: "con-so", ten: "Đọc con số",
      mo: "Lấy một con số trong bài gốc làm trục, rồi quy nó về con số của một salon tám ghế. Cho người đọc thấy con số đó nghĩa là gì với tiệm của họ. Phải tính ra được, không nói chung chung." },
    { ma: "go-hieu-lam", ten: "Gỡ hiểu lầm",
      mo: "Nêu thẳng điều nhiều người trong nghề vẫn tin là đúng, rồi dùng bài gốc để nói lại cho chính xác. Giọng nhẹ, không dạy đời, không làm người đọc thấy mình dốt. Đây là chỗ hợp nhất để nói về giới hạn của sản phẩm chăm tóc." },
    { ma: "lam-ngay", ten: "Làm được ngay tuần này",
      mo: "Rút thành 3 tới 5 việc chủ salon làm được ngay tuần này, mỗi việc một dòng, cụ thể tới mức đọc xong biết mở sổ ra làm gì. Tránh lời khuyên ai cũng gật kiểu hãy chăm sóc khách hàng tốt hơn." },
    { ma: "noi-that", ten: "Nói thật với nhau",
      mo: "Giọng đồng cảm, nói với người đang mệt và đang nghi ngờ chính mình. Thừa nhận cái khó trước, không thúc giục. Thông tin trong bài gốc đưa vào như một chỗ dựa có căn cứ, không phải một bài giảng." },
  ],
  tiktok: [
    { ma: "hau-truong", ten: "Hậu trường nghề",
      mo: "Quay đúng một khoảnh khắc trong tiệm rồi rút ra một ý về nghề. Người xem là chủ salon và thợ, họ nhận ra ngay cái ghế, cái xe đẩy, cái bồn gội. Không dàn dựng bóng bẩy." },
    { ma: "chuyen-gia", ten: "Chuyên gia",
      mo: "Nói thẳng, chắc, có số liệu. Giọng người biết việc đang chia sẻ, không phải giọng quảng cáo. Hình ảnh đơn giản: người nói trực diện, chèn chữ số liệu." },
    { ma: "thong-tin", ten: "Thông tin nhanh",
      mo: "Nhịp nhanh, liệt kê, mỗi ý một cảnh ngắn. Chữ trên màn hình gánh phần lớn nội dung để người xem không bật tiếng vẫn hiểu." },
    { ma: "ke-chuyen", ten: "Kể chuyện",
      mo: "Một câu chuyện nhỏ có mở, thân, kết. Nhân vật là một chủ salon giấu tên hoặc chính người quay. Thông tin trong bài gốc là chỗ ngoặt của câu chuyện." },
    { ma: "bat-trend", ten: "Bắt trend",
      mo: "Dùng khuôn đang thịnh trên TikTok Việt, ví dụ POV, 'không ai nói với bạn rằng', 'ba điều tôi ước biết sớm hơn'. Ghi rõ khuôn đang dùng ở đầu kịch bản để người quay dễ hình dung." },
  ],
};

const DO_DAI_FB = {
  ngan: { ten: "Ngắn", mo: "khoảng 100 tới 150 từ, đọc hết trong 30 giây" },
  vua: { ten: "Vừa", mo: "khoảng 200 tới 280 từ, đủ chỗ cho một câu chuyện nhỏ" },
  dai: { ten: "Dài", mo: "khoảng 350 tới 450 từ, đi sâu được vào cơ chế và ví dụ" },
};

const THOI_LUONG_TT = {
  "15": { ten: "15 giây", mo: "khoảng 3 tới 4 cảnh, chỉ đủ cho MỘT ý duy nhất" },
  "30": { ten: "30 giây", mo: "khoảng 5 tới 7 cảnh, một ý chính và một ví dụ" },
  "60": { ten: "60 giây", mo: "khoảng 8 tới 12 cảnh, đủ chỗ cho câu chuyện hoặc ba ý" },
};

/** Giao diện gọi hàm này để vẽ nút chọn, để danh sách phong cách chỉ có một bản. */
function layPhongCach() {
  return {
    facebook: PHONG_CACH.facebook.map((x) => ({ ma: x.ma, ten: x.ten })),
    tiktok: PHONG_CACH.tiktok.map((x) => ({ ma: x.ma, ten: x.ten })),
    doDaiFb: Object.entries(DO_DAI_FB).map(([ma, x]) => ({ ma, ten: x.ten })),
    thoiLuongTiktok: Object.entries(THOI_LUONG_TT).map(([ma, x]) => ({ ma, ten: x.ten })),
  };
}

/* ---------------------------------------------------------------------------
 * Khuôn kết quả. Hai định dạng khác hẳn nhau nên tách hai schema, không nhét chung.
 */
const SCHEMA_FB = {
  type: "object",
  properties: {
    baiViet: { type: "string" },
    hashtag: { type: "string" },
    goiYAnh: { type: "string" },
    promptAnh: { type: "string" },
    canKiem: { type: "string" },
  },
  required: ["baiViet", "hashtag", "goiYAnh", "promptAnh", "canKiem"],
  additionalProperties: false,
};

const SCHEMA_TT = {
  type: "object",
  properties: {
    hook: { type: "string" },
    canh: {
      type: "array",
      items: {
        type: "object",
        properties: {
          thoiGian: { type: "string" },
          hinhAnh: { type: "string" },
          loiThoai: { type: "string" },
          chuTrenMan: { type: "string" },
        },
        required: ["thoiGian", "hinhAnh", "loiThoai", "chuTrenMan"],
        additionalProperties: false,
      },
    },
    caption: { type: "string" },
    hashtag: { type: "string" },
    goiYAnh: { type: "string" },
    promptAnh: { type: "string" },
    canKiem: { type: "string" },
  },
  required: ["hook", "canh", "caption", "hashtag", "goiYAnh", "promptAnh", "canKiem"],
  additionalProperties: false,
};

/* ---------------------------------------------------------------------------
 * LUẬT VIẾT PROMPT ẢNH.
 *
 * Prompt này được đưa THẲNG sang extension ChatGPT Auto Ảnh, nên có hai ràng buộc
 * kỹ thuật không được phá:
 *   - MỘT DÒNG. Extension tách prompt theo từng dòng, xuống dòng là vỡ thành nhiều
 *     prompt cụt.
 *   - KHÔNG kèm câu style. Extension đã có sẵn ô "Câu nối thêm" chứa câu style chuẩn
 *     và tự nối vào cuối. Viết lại ở đây là câu style bị lặp hai lần.
 *
 * Bốn trụ phong cách (châu Á, cảm xúc, ẩn dụ, hiểu ngay) là quy ước chung cho mọi ảnh
 * AI của Vũ Hải. Phần lớn đã nằm trong câu style của extension, ở đây chỉ cần lo phần
 * NỘI DUNG cảnh cho đúng bốn trụ đó.
 */
const LUAT_ANH = [
  "",
  "PHẦN ẢNH. Trả về hai thứ khác nhau, đừng lẫn:",
  "- goiYAnh: một câu tiếng Việt nói cho nhân sự biết nên dùng ảnh gì. Ngắn gọn, dễ hiểu.",
  "- promptAnh: câu lệnh để máy sinh ảnh. Đây là thứ được đưa thẳng sang công cụ tạo ảnh.",
  "",
  "LUẬT CỨNG cho promptAnh:",
  "a. Viết trên ĐÚNG MỘT DÒNG. Tuyệt đối không xuống dòng, không gạch đầu dòng, không đánh số.",
  "b. Tiếng Việt, khoảng 35 tới 60 từ.",
  "c. Tả một CẢNH cụ thể: ai, đang làm gì, ở đâu, ánh sáng thế nào, cảm xúc gì. Người trong ảnh là người châu Á.",
  "d. Kể ý bài bằng HÌNH ẢNH ẨN DỤ, không minh họa theo kiểu sách giáo khoa. Nhìn một cái phải hiểu ngay ý, không phải đoán.",
  "e. KHÔNG viết câu mô tả phong cách nhiếp ảnh (ánh sáng dịu, tông ấm trầm, độ sâu trường ảnh nông...). Công cụ đã tự thêm phần đó.",
  "f. KHÔNG dùng cờ kỹ thuật kiểu --ar, --v, --style.",
  "g. KHÔNG có chữ, số, logo hay bảng biểu trong ảnh. Máy sinh ảnh viết chữ hay sai.",
  // Quy ước đứng của Vũ Hải: style là style, chủ đề là chủ đề. Ở app trước đã lọt thật
  // một lần: bài về thuốc GLP-1 mà prompt tả 'ngồi trước cửa phòng tập'. Ở app này cái
  // bẫy tương đương là nhét cái ghế salon vào mọi tấm ảnh.
  "h. KHÔNG mặc định đưa salon vào ảnh. Chỉ tả cảnh trong tiệm KHI bài thật sự nói về việc diễn ra trong tiệm. Bài về con số, về nhân sự, về nghĩ ngợi của người chủ thì tìm bối cảnh khác.",
  "h2. KHÔNG có tên hay logo thương hiệu nào trong ảnh.",
  "",
  "LUẬT AN TOÀN cho promptAnh, quan trọng ngang phần chữ:",
  "i. KHÔNG cận cảnh đỉnh đầu hói, mảng tóc thưa, tóc rụng trên sàn hay trên lược. Không lấy tóc của ai ra làm vật soi.",
  // Cùng logic với app trước: ảnh trước và sau là bằng chứng kết quả. Máy sinh ra một
  // cặp ảnh trước sau là bịa ra bằng chứng, vừa sai sự thật vừa đúng thứ pháp luật
  // quảng cáo soi. Ngành tóc còn nhạy hơn vì đầy quảng cáo mọc tóc.
  "j. KHÔNG bịa ảnh trước và sau. KHÔNG cảnh đếm sợi tóc. KHÔNG cảnh đo mật độ tóc.",
  "j2. Nếu bài hợp với ảnh trước và sau, hãy nói điều đó ở goiYAnh dưới dạng dùng ảnh THẬT của khách đã xin phép, còn promptAnh thì vẫn tả một cảnh khác. Máy không được bịa ra kết quả.",
  "k. Người trong ảnh có vẻ mặt bình thường hoặc dễ chịu, không khổ sở, không xấu hổ, không tự ti.",
  "l. Không gợi ý một mái tóc nào là chuẩn. Không so sánh tóc người này với người kia.",
  "l2. Nếu ảnh có người chủ salon, đó là người 30 tới 40, dáng vẻ đời thường, tay nghề thấy được qua cách cầm kéo hoặc cách đứng, KHÔNG phải người mẫu, KHÔNG phải doanh nhân comple.",
  "",
  // Cùng cái bẫy đã đo được ở app trước: model có một khuôn quen thuộc và cứ rơi vào đó.
  // Hai trong ba prompt đầu tiên cùng mở bằng "ngồi bên cửa sổ buổi sáng". Ở ngành tóc,
  // khuôn quen sẽ là "chiếc ghế salon trống trong tiệm vắng". Cấm trước.
  "TRÁNH LẶP BỐI CẢNH. Đây là lỗi hay gặp nhất:",
  "m. KHÔNG mở bằng 'chiếc ghế salon trống', 'tiệm vắng khách buổi chiều', 'gương lớn phản chiếu', 'ngồi bên cửa sổ', 'hai tay ôm tách trà'. Năm khuôn này rơi vào quá dễ.",
  // Bối cảnh lấy từ đúng một ngày của anh Dũng trong tài liệu chân dung: bồn gội, quầy
  // lễ tân, kho hàng, cuốn sổ, lúc đóng cửa. Bối cảnh đúng đời sống người đọc thì họ
  // nhận ra mình ngay, không cần chú thích.
  "n. Đổi bối cảnh theo nội dung bài, ưu tiên đúng một ngày của anh Dũng: bồn gội lúc cuối ngày, quầy lễ tân giờ cao điểm, góc kho xếp hàng mới nhập, cuốn sổ thu chi mở trên bàn, cửa cuốn lúc đóng tiệm 21h, quán cà phê vỉa hè lúc anh ngồi tính lại giá, buổi dạy thợ phụ sau giờ đóng cửa.",
  "o. Đổi cả thời điểm và khoảng cách máy: có lúc cận bàn tay cầm kéo, có lúc toàn cảnh người nhỏ giữa không gian rộng.",
].join("\n");

function soanHeThong(dinhDang, phongCach, kichCo) {
  if (dinhDang === "tiktok") {
    const tl = THOI_LUONG_TT[kichCo] || THOI_LUONG_TT["30"];
    return [
      LUAT_CHUNG,
      "",
      "VIỆC LẦN NÀY: viết một KỊCH BẢN TIKTOK hoàn chỉnh để nhân sự cầm đi quay được ngay.",
      "Phong cách: " + phongCach.ten + ". " + phongCach.mo,
      "Thời lượng: " + tl.ten + ", " + tl.mo + ".",
      "",
      "Trả về đúng các phần sau:",
      "- hook: câu đầu tiên người xem nghe trong 3 giây đầu. Đây là phần quyết định họ lướt qua hay ở lại, TỐI ĐA 20 TỪ. Phải cụ thể, không được là câu chào chung chung.",
      "- canh: danh sách cảnh quay theo thứ tự. Mỗi cảnh có:",
      "    thoiGian  (ví dụ '0-3s')",
      "    hinhAnh   (quay gì, ở đâu, góc nào, tả ngắn gọn để người quay hình dung được)",
      "    loiThoai  (lời nói ra miệng, viết đúng như sẽ nói, KHÔNG viết kiểu mô tả)",
      "    chuTrenMan (chữ hiện trên màn hình, ngắn, dưới 12 từ; không có thì để chuỗi rỗng)",
      "- caption: phần chú thích đăng kèm video, 2 tới 3 câu.",
      "- hashtag: 5 tới 8 thẻ tiếng Việt và tiếng Anh, cách nhau bằng dấu cách, mỗi thẻ bắt đầu bằng #.",
      "- goiYAnh và promptAnh: xem phần ẢNH ở dưới. Với TikTok đây là ảnh bìa của video.",
      "- canKiem: nhắc nhân sự cần kiểm hoặc cần tránh gì trước khi đăng. Một tới hai câu.",
      "",
      "Người xem TikTok phần lớn TẮT TIẾNG lúc đầu, nên chữ trên màn hình phải tự nó kể được ý chính.",
      "Lời thoại viết như nói chuyện thật, có thể lặp từ, ngắt câu tự nhiên. Đừng viết văn.",
      LUAT_ANH,
    ].join("\n");
  }

  const dd = DO_DAI_FB[kichCo] || DO_DAI_FB.vua;
  return [
    LUAT_CHUNG,
    "",
    "VIỆC LẦN NÀY: viết một BÀI ĐĂNG FACEBOOK hoàn chỉnh để Vũ Hải dán lên trang cá nhân là đăng được ngay.",
    "Phong cách: " + phongCach.ten + ". " + phongCach.mo,
    "Độ dài: " + dd.ten + ", " + dd.mo + ".",
    "",
    "Trả về đúng các phần sau:",
    "- baiViet: TOÀN BỘ nội dung bài đăng, đã xuống dòng sẵn. Câu đầu tiên phải giữ chân người lướt, vì Facebook chỉ hiện vài dòng đầu trước nút Xem thêm. Kết bài bằng một câu hỏi mở để chủ salon kể chuyện tiệm mình, KHÔNG hô hào, KHÔNG viết hoa cả câu.",
    "- hashtag: 4 tới 6 thẻ tiếng Việt, cách nhau bằng dấu cách, mỗi thẻ bắt đầu bằng #.",
    "- goiYAnh và promptAnh: xem phần ẢNH ở dưới.",
    "- canKiem: nhắc nhân sự cần kiểm hoặc cần tránh gì trước khi đăng. Một tới hai câu.",
    "",
    "Trong baiViet, dùng xuống dòng để chia đoạn cho dễ đọc trên điện thoại. Đoạn ngắn, 2 tới 3 câu một đoạn.",
    "Được dùng emoji nhưng thưa thôi, tối đa 3 cái cho cả bài, và đừng rắc vào giữa câu.",
    LUAT_ANH,
  ].join("\n");
}

function soanTinNhan(bai) {
  const d = [
    "Đây là bài tin gốc để dựa vào. Chỉ dùng thông tin trong này, không thêm số liệu ở đâu khác.",
    "",
    "Tiêu đề: " + (bai.tieuDe || ""),
  ];
  if (bai.tieuDeViet && bai.tieuDeViet !== bai.tieuDe) d.push("Tiêu đề tiếng Việt: " + bai.tieuDeViet);
  if (bai.tomTat) d.push("Tóm tắt: " + bai.tomTat);
  if (bai.trichDan) d.push("Trích dẫn gốc: " + bai.trichDan);
  if (bai.nguon) d.push("Nguồn: " + bai.nguon);
  if (bai.hook) d.push("Câu mở bài đã gợi ý trước đó (tham khảo, KHÔNG bắt buộc dùng lại): " + bai.hook);
  if (bai.goc) d.push("Góc triển khai đã gợi ý trước đó: " + bai.goc);
  // Câu Lưu ý của bài là ràng buộc CỨNG, không phải gợi ý. Bài nào có nó là bài dễ viết
  // thành lời hứa sai hoặc lời khuyên y tế.
  if (bai.luuY) {
    d.push("");
    d.push("CẢNH BÁO BẮT BUỘC TUÂN THỦ khi viết bài này: " + bai.luuY);
  }
  return d.join("\n");
}

/**
 * Sinh content. Trả về { dinhDang, ...các trường theo định dạng }.
 * Ném lỗi khi gọi hỏng để nơi gọi tự quyết định.
 */
async function taoContent({ key, keyGemini, bai, dinhDang, phongCach, kichCo, signal }) {
  const ds = PHONG_CACH[dinhDang === "tiktok" ? "tiktok" : "facebook"];
  const pc = ds.find((x) => x.ma === phongCach) || ds[0];
  const laTiktok = dinhDang === "tiktok";
  const heThong = soanHeThong(dinhDang, pc, kichCo);
  const tinNhan = soanTinNhan(bai || {});
  const schema = laTiktok ? SCHEMA_TT : SCHEMA_FB;

  /* ---------------------------------------------------------------------------
   * CHỌN NHÀ CUNG CẤP.
   *
   * Có GEMINI_API_KEY thì đi Gemini, không thì đi Claude. App mở công khai nên số lượt
   * tạo content sẽ tăng mạnh, mà Gemini có bậc miễn phí rộng hơn hẳn.
   *
   * Lời nhắc và khuôn kết quả GIỮ NGUYÊN, chỉ đổi chỗ gửi đi. Nhờ vậy đổi qua đổi lại
   * mà giọng văn không đổi theo.
   *
   * Gemini hỏng thì TỰ LÙI VỀ CLAUDE nếu còn khóa Claude. Người dùng đang chờ bài không
   * cần biết bên trong dùng máy nào; hỏng một bên mà cả tính năng chết là tệ nhất.
   */
  if (keyGemini) {
    try {
      const { out, model } = await goiGemini({
        key: keyGemini,
        model: process.env.GEMINI_MODEL || "",
        heThong, tinNhan, schema,
        maxTokens: 4000,
        signal,
      });
      const thieu = laTiktok
        ? (!out.hook || !Array.isArray(out.canh) || !out.canh.length)
        : (!out.baiViet);
      if (thieu) throw Object.assign(new Error("thiếu trường bắt buộc"), { tenLoi: "khong_doc_duoc" });
      return donKetQua({
        dinhDang: laTiktok ? "tiktok" : "facebook",
        phongCach: pc.ma, tenPhongCach: pc.ten, may: "gemini:" + model, ...out,
      });
    } catch (e) {
      if (!key) throw e;   // không có đường lùi thì để lỗi nổi lên
      // Có đường lùi thì ghi lại rồi đi tiếp bằng Claude.
      console.log("[taoContent] Gemini hỏng (" + (e.tenLoi || "?") + "): "
        + String(e.message).slice(0, 120) + " — lùi về Claude.");
    }
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      // Rộng hơn hẳn hàm phan-tich (1400) vì đây là bài viết đầy đủ, kịch bản 60 giây có
      // thể tới 12 cảnh mỗi cảnh bốn trường. Chật là hụt ngoặc, hỏng cả khối JSON.
      max_tokens: 4000,
      // Tắt thinking: phần thinking ĐẾM VÀO max_tokens. Việc này có khuôn sẵn, không cần nghĩ dài.
      thinking: { type: "disabled" },
      system: soanHeThong(dinhDang, pc, kichCo),
      messages: [{ role: "user", content: soanTinNhan(bai || {}) }],
      output_config: {
        format: { type: "json_schema", schema: laTiktok ? SCHEMA_TT : SCHEMA_FB },
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    const e = new Error((data && data.error && data.error.message) || ("HTTP " + res.status));
    e.tenLoi = "api";
    throw e;
  }

  const raw = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  let out;
  try { out = JSON.parse(raw); } catch { out = null; }

  const thieu = laTiktok
    ? (!out || !out.hook || !Array.isArray(out.canh) || !out.canh.length)
    : (!out || !out.baiViet);
  if (thieu) {
    const biCat = data.stop_reason === "max_tokens";
    const e = new Error(biCat
      ? "kịch bản bị cắt vì chạm trần token, hãy nới max_tokens"
      : "không đọc được kết quả: " + raw.slice(0, 160));
    e.tenLoi = biCat ? "cut_token" : "khong_doc_duoc";
    throw e;
  }

  return donKetQua({
    dinhDang: laTiktok ? "tiktok" : "facebook",
    phongCach: pc.ma, tenPhongCach: pc.ten, may: "claude:" + MODEL, ...out,
  });
}

/**
 * Dọn ký tự lạ trong kết quả.
 *
 * Đã gặp thật: câu canKiem của một kịch bản TikTok trả về kèm dấu ngoặc Nhật 」 và một
 * đoạn thừa trong ngoặc đơn. Thỉnh thoảng model nhả ra ký tự ngoài bộ tiếng Việt như vậy.
 * Không đáng gọi lại API, nhưng để nguyên thì nhân sự chép ra bài đăng là thấy ngay.
 *
 * CHỈ dọn ký tự rác, KHÔNG đụng tới dấu xuống dòng, vì baiViet Facebook dựa vào xuống
 * dòng để chia đoạn và giao diện hiển thị bằng white-space:pre-wrap.
 */
const RAC = /[「」『』【】〔〕｢｣]/g;
function donChu(s) {
  return String(s == null ? "" : s)
    .replace(RAC, "")
    .replace(/[ \t]+\n/g, "\n")   // khoảng trắng thừa cuối dòng
    .replace(/\n{3,}/g, "\n\n")   // quá hai dòng trống liền nhau
    .trim();
}
/**
 * Ép prompt ảnh về ĐÚNG MỘT DÒNG.
 *
 * Không chỉ trông cậy vào lời nhắc. Extension ChatGPT Auto Ảnh tách prompt theo từng
 * dòng, nên một dấu xuống dòng lọt vào là prompt vỡ thành hai prompt cụt, chạy ra hai
 * tấm ảnh sai. Lời nhắc bảo model đừng xuống dòng, nhưng chặn bằng mã thì mới chắc.
 *
 * Bỏ luôn cờ kỹ thuật kiểu --ar 16:9 nếu model lỡ thêm vào, vì công cụ tự lo tỉ lệ.
 * Bỏ cả dấu gạch đầu dòng ở đầu câu.
 */
function motDong(s) {
  return donChu(s)
    .replace(/\s*\n+\s*/g, " ")
    .replace(/^\s*[-*•\d.)]+\s*/, "")
    .replace(/\s--\w+(\s+\S+)?/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function donKetQua(kq) {
  const ra = { ...kq };
  for (const k of ["baiViet", "hashtag", "goiYAnh", "canKiem", "hook", "caption"]) {
    if (typeof ra[k] === "string") ra[k] = donChu(ra[k]);
  }
  if (typeof ra.promptAnh === "string") ra.promptAnh = motDong(ra.promptAnh);
  if (Array.isArray(ra.canh)) {
    ra.canh = ra.canh.map((c) => ({
      thoiGian: donChu(c && c.thoiGian),
      hinhAnh: donChu(c && c.hinhAnh),
      loiThoai: donChu(c && c.loiThoai),
      chuTrenMan: donChu(c && c.chuTrenMan),
    }));
  }
  return ra;
}

module.exports = { MODEL, PHONG_CACH, DO_DAI_FB, THOI_LUONG_TT, layPhongCach, taoContent };
