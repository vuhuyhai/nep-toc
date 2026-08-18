/**
 * NẾP TÓC — Lời nhắc và lệnh gọi cho phần dịch + Gợi ý content.
 *
 * Đặt riêng một file để CHỈ CÓ MỘT BẢN lời nhắc. Hai nơi dùng chung:
 *   - netlify/functions/phan-tich.js  (khi app chạy trên Netlify)
 *   - nep-toc-app/thu-thap.js         (khi chạy bộ quét ngay trên máy)
 * Chép lời nhắc ra hai chỗ thì sớm muộn hai bản lệch giọng nhau.
 *
 * KHÁC ba app tin trước ở chỗ quan trọng nhất: người đọc app này KHÔNG lướt tin để biết.
 * Họ là Vũ Hải, sáng mở app ra để lấy nguyên liệu viết bài nói với chủ salon. Vì vậy mỗi
 * bài trả về một CÂU MỞ BÀI viết sẵn dùng được ngay, một góc triển khai, và khi cần thì
 * một câu cảnh báo để bài không thành lời hứa sai.
 */

const MODEL = "claude-sonnet-5";
const chanDung = require("./chung/chan-dung.js");

const HE_THONG = [
  "Bạn là người viết nội dung cho Vũ Hải, chuyên gia tư vấn Vận hành Xuất sắc ngành dịch vụ.",
  "Người đọc bài của Vũ Hải là CHỦ SALON TÓC. Đây là Vũ Hải nói với chủ salon, KHÔNG PHẢI salon nói với khách.",
  "Người mở app mỗi sáng để lấy nguyên liệu chính là Vũ Hải. Hãy viết như đang đưa nguyên liệu tận tay đồng nghiệp, không phải viết báo cáo.",
  "",
  // Bản GỌN, không phải bản đầy đủ: hàm này chạy cho hàng trăm bài mỗi ngày và chỉ trả
  // về câu hook với góc triển khai, nhét cả chân dung đầy đủ vào là tốn token vô ích.
  chanDung.GON,
  "",
  "Câu hook bạn viết là để anh Dũng dừng ngón tay lại lúc 11 giờ đêm, sau khi đã đóng cửa tiệm. Viết cho đúng người đó.",
  "",
  "Với mỗi bài, viết đúng năm phần:",
  "1. tieuDeViet: dịch tiêu đề sang tiếng Việt, TỐI ĐA 16 TỪ. Dịch lấy ý cho người Việt hiểu ngay, không dịch từng chữ. Bỏ tên chuyên mục và tên báo dính ở đuôi. Tiêu đề gốc đã là tiếng Việt thì chép lại y nguyên, không sửa gì.",
  "2. tomTat: tóm tắt nội dung bài trong 1 tới 2 câu, TỐI ĐA 45 TỪ. Nói rõ bài phát hiện ra điều gì, có số liệu thì giữ số liệu.",
  "3. hook: MỘT câu mở đầu bài đăng, TỐI ĐA 30 TỪ, viết sẵn để chép ra dùng luôn. Nói thẳng với chủ salon. Phải cụ thể tới mức đọc xong người ta muốn đọc tiếp, không phải câu chung chung ai cũng gật.",
  "4. gocViet: MỘT câu chỉ hướng triển khai bài đăng, TỐI ĐA 35 TỪ. Nói rõ nên nối bài này vào chuyện gì trong tiệm: giữ thợ, giá dịch vụ, khách quay lại, quy trình, hay chuyện chủ không rời được ghế.",
  "5. luuY: câu cảnh báo, TỐI ĐA 30 TỪ, CHỈ viết khi bài dễ bị hiểu sai thành lời hứa hoặc lời khuyên y tế. Không có gì cần cảnh báo thì để chuỗi rỗng.",
  "",
  "KHI NÀO PHẢI CÓ luuY. Bắt buộc viết khi bài nói về: thuốc mọc tóc (minoxidil, finasteride), cấy tóc, thực phẩm chức năng cho tóc, bệnh rụng tóc, hóa chất trong sản phẩm tóc, hoặc bài có con số phục hồi tóc ấn tượng. Nội dung cảnh báo: nhắc không hứa kết quả, không tư vấn y tế thay bác sĩ, nói rõ giới hạn của sản phẩm chăm tóc.",
  "",
  "LUẬT VIẾT, không được phá:",
  "Không hứa con số. Không viết mọc bao nhiêu tóc trong bao nhiêu tuần, không viết x lần doanh thu, kể cả khi bài gốc có con số đó. Nêu số liệu nghiên cứu thì phải gắn với nghiên cứu.",
  "Không chê ngoại hình ai. Không lấy hói, tóc thưa, tóc bạc ra làm trò. Không lấy sự tự ti làm đòn bẩy bán hàng.",
  "Không nói thay bác sĩ. Rụng tóc có thể là dấu hiệu bệnh: đưa thông tin và khuyên đi khám, không kê đơn.",
  "Không nói xấu thợ, không nói xấu salon khác, không nêu tên đối thủ để chê.",
  "Không dùng các từ rỗng: kiến tạo, lan tỏa, nâng tầm, truyền cảm hứng, cuộc cách mạng, bùng nổ, thần thánh, lột xác, bứt phá.",
  "Không dùng dấu gạch ngang dài.",
  "Luôn nói đi cùng, không nói đi theo. Hệ thống hỗ trợ con người, không nâng, không bẻ.",
  "Câu ngắn, từ thông dụng. Viết xong thử bỏ bớt chữ mà nghĩa vẫn nguyên.",
  "",
  "QUAN TRỌNG về câu hook: người dùng lướt hàng trăm bài liền nhau, mở đầu giống hệt nhau là không dùng được bài nào.",
  // Danh sách này KHÔNG phải phỏng đoán. Ở app VÓC DÁNG, trong 160 câu hook của lần chạy
  // đầu, riêng 'Nhiều người nghĩ' chiếm 23 câu, tức cứ 7 bài lại một câu mở y hệt. Ép
  // luân phiên 6 kiểu vẫn chưa đủ, vì trong CÙNG một kiểu model lại rơi vào cùng khuôn câu.
  // Phần dưới đây gồm các cụm đã biết là hỏng, cộng các cụm dễ rơi vào ở ngành tóc.
  // Sinh vài chục bài rồi ĐẾM LẠI, cụm nào lặp quá 10% thì thêm vào đây.
  "TUYỆT ĐỐI không mở đầu bằng các cụm sau, kể cả biến thể của chúng:",
  "  'Nhiều người nghĩ', 'Nhiều chủ salon', 'Nhiều thợ tóc', 'Không ít người',",
  "  'Bạn có biết', 'Có thể bạn chưa biết', 'Có một sự thật',",
  "  'Một nghiên cứu mới', 'Nghiên cứu mới đây', 'Theo nghiên cứu',",
  "  'Trong ngành tóc', 'Ngành tóc đang', 'Thị trường làm đẹp',",
  "  'Khách bước vào tiệm', 'Mỗi ngày trong tiệm'.",
  "Mỗi câu hook phải mở bằng cách diễn đạt riêng. Viết xong hãy đọc lại mấy chữ đầu: nếu đó là một cụm giới thiệu chung chung thì bỏ đi, câu vẫn đứng được và còn mạnh hơn.",
  "Nếu tin nhắn có dòng 'Kiểu mở đầu lần này', theo đúng kiểu đó. Không có thì tự chọn một kiểu.",
  "",
  "Nguồn phần lớn bằng tiếng Anh. Luôn viết cả năm phần BẰNG TIẾNG VIỆT. Thuật ngữ chuyên ngành giữ tiếng Anh thì kèm nghĩa Việt trong ngoặc lần đầu.",
].join("\n");

const NHAN_NHOM = {
  nghe: "Đây là tin nghề và vận hành salon: nhân sự, giá dịch vụ, khách quay lại, mô hình kinh doanh. Đây là mảng trúng đích nhất, hãy viết hook thật sát với người đang điều hành một tiệm tám ghế.",
  khoahoc: "Đây là bài nghiên cứu hoặc tin khoa học. Phần tóm tắt phải giữ đúng phát hiện của nghiên cứu, đừng nói quá. Góc triển khai nên hướng về việc chủ salon dùng nó để đào tạo thợ hoặc trả lời khách hỏi khó.",
  xuhuong: "Đây là tin xu hướng hoặc thói quen của khách. Chủ salon cần biết khách đang muốn gì trước khi khách bước vào ghế. Dễ viral nhưng cũng dễ sai, hãy cân nhắc kỹ phần luuY.",
  vn: "Đây là tin trong nước, bối cảnh Việt Nam nên chủ salon thấy gần. Nếu là tin thu hồi sản phẩm hay xử phạt quảng cáo sai sự thật thì hướng triển khai là giúp chủ salon chọn hàng nhập cho đúng, KHÔNG phải công kích ai.",
};

/**
 * Sáu kiểu mở đầu cho câu hook, luân phiên theo thứ tự bài.
 *
 * Mỗi lần gọi Claude là một cuộc hội thoại riêng, nó không biết bài trước mở thế nào.
 * Để tự do thì hàng trăm câu hook sẽ mở gần giống nhau hết. Ép luân phiên từ ngoài là
 * cách chắc chắn nhất. Bài học này đã trả giá ở app ĐIỂM CHẠM.
 */
const KIEU_MO = [
  "Bắt đầu bằng một con số cụ thể lấy từ bài. Đặt con số ở ngay từ đầu tiên của câu.",
  "Bắt đầu bằng một hiểu lầm phổ biến trong nghề rồi nói lại cho đúng. Nêu thẳng nội dung hiểu lầm đó, đừng mở bằng cụm giới thiệu nào cả.",
  "Bắt đầu bằng một câu khách hoặc thợ nói ra miệng, đặt trong ngoặc kép, như vừa nghe được trong tiệm.",
  "Bắt đầu bằng một câu hỏi thẳng khiến chủ salon phải mở sổ ra kiểm lại tiệm mình.",
  "Bắt đầu bằng một khoảnh khắc có mốc giờ cụ thể trong ngày làm việc. Đổi mốc mỗi lần, đừng lúc nào cũng cuối ngày.",
  "Bắt đầu bằng điều nghiên cứu vừa phát hiện, nói gọn như kể chuyện, vào thẳng phát hiện.",
];

function soanTinNhan({ tieuDe, tomTat, nhom, thuTu }) {
  const kieu = Number.isInteger(thuTu) ? KIEU_MO[thuTu % KIEU_MO.length] : "";
  return [
    "Bài về ngành tóc, salon hoặc chăm sóc tóc và da đầu:",
    NHAN_NHOM[nhom] || "",
    "Tiêu đề: " + tieuDe,
    "Tóm tắt: " + (tomTat || "(không có, hãy suy ra từ tiêu đề)"),
    kieu ? "\nKiểu mở đầu lần này cho câu hook: " + kieu : "",
  ].filter(Boolean).join("\n");
}

/**
 * Gọi Claude, trả về { tieuDeViet, tomTat, hook, gocViet, luuY }.
 * Ném lỗi khi gọi hỏng để nơi gọi tự quyết định thử lại hay bỏ qua.
 * Khóa truyền từ ngoài vào, file này không tự đọc biến môi trường.
 */
async function phanTichBai({ key, tieuDe, tomTat, nhom, thuTu, signal }) {
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
      // 1400 chứ không phải vài trăm. App này trả về NĂM trường tiếng Việt, nhiều hơn
      // ba trường của các app trước. Để chật thì câu trả lời bị cắt giữa chừng và khối
      // JSON hụt dấu ngoặc, không đọc ra được. Giới hạn số từ nằm ở lời nhắc; trần token
      // này chỉ là lưới an toàn.
      max_tokens: 1400,
      // Tắt thinking. Việc ngắn và có khuôn sẵn. Quan trọng hơn: phần thinking ĐẾM VÀO
      // max_tokens, bật nó thì nhiều bài tiêu vài trăm token để nghĩ rồi chạm trần.
      thinking: { type: "disabled" },
      system: HE_THONG,
      messages: [{ role: "user", content: soanTinNhan({ tieuDe, tomTat, nhom, thuTu }) }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              tieuDeViet: { type: "string" },
              tomTat: { type: "string" },
              hook: { type: "string" },
              gocViet: { type: "string" },
              luuY: { type: "string" },
            },
            required: ["tieuDeViet", "tomTat", "hook", "gocViet", "luuY"],
            additionalProperties: false,
          },
        },
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
  // luuY được phép rỗng, bốn trường còn lại thì không.
  if (!out || !out.tieuDeViet || !out.tomTat || !out.hook || !out.gocViet) {
    // Phân biệt rõ hai kiểu hỏng, vì cách chữa khác hẳn nhau: bị cắt vì hết token thì
    // nới max_tokens, còn trả sai định dạng thì phải xem lại lời nhắc.
    const biCat = data.stop_reason === "max_tokens";
    const e = new Error(biCat
      ? "câu trả lời bị cắt vì chạm trần token, hãy nới max_tokens"
      : "không đọc được kết quả: " + raw.slice(0, 160));
    e.tenLoi = biCat ? "cut_token" : "khong_doc_duoc";
    throw e;
  }
  return {
    tieuDeViet: String(out.tieuDeViet).trim(),
    tomTat: String(out.tomTat).trim(),
    hook: String(out.hook).trim(),
    gocViet: String(out.gocViet).trim(),
    luuY: String(out.luuY || "").trim(),
  };
}

module.exports = { MODEL, HE_THONG, soanTinNhan, phanTichBai };
