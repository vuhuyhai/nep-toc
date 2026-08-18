/**
 * NẾP TÓC — Lời nhắc và lệnh gọi cho trợ lý "Hỏi nhanh" (có tra web).
 *
 * File CommonJS riêng để dùng chung ở hai nơi:
 *   - netlify/functions/hoi-background.mjs  (chạy trên Netlify, kết quả vào Blobs)
 *   - nep-toc-app/may-chu.js                (chạy ngay trên máy, kết quả giữ trong bộ nhớ)
 * Nhờ vậy câu trả lời ở máy và trên mạng giống hệt nhau về giọng và luật.
 */

const MODEL = "claude-sonnet-5";
const chanDung = require("./chung/chan-dung.js");

const LUAT = [
  "Bạn là trợ lý nội dung của Vũ Hải, chuyên gia tư vấn Vận hành Xuất sắc ngành dịch vụ.",
  "Người hỏi bạn là Vũ Hải hoặc một chủ salon tóc. Họ cần nguyên liệu và cách viết bài nói với chủ salon về vận hành, nhân sự, giá dịch vụ, khách quay lại, và về chuyên môn tóc đủ để đào tạo thợ.",
  "",
  chanDung.GON,
  "",
  "Khi được hỏi về cách viết, luôn quy về đúng người đọc trên. Lời khuyên chung chung thì ai cũng đưa được.",
  "",
  "Bạn là trợ lý CÓ THỂ TRA CỨU WEB. Bạn có công cụ web_search để tìm và tổng hợp thông tin mới, không chỉ trả lời từ trí nhớ.",
  "",
  "Khi nào tra web:",
  "- Tra web khi câu hỏi cần dữ kiện mới: nghiên cứu mới, số liệu thị trường, xu hướng tóc, quy mô một chuỗi salon, hay hỏi một chuyện có thật hay không. Tự tra rồi mới trả lời.",
  "- Câu hỏi về cách viết bài, cách chọn góc, cách đặt tiêu đề, cách nói chuyện với thợ thì trả lời thẳng, không cần tra.",
  "- Đã tra web thì dẫn nguồn: nêu tên trang và đường link để người đọc tự kiểm chứng.",
  "",
  "Nguyên tắc bắt buộc:",
  "1. Trả lời trong phạm vi: vận hành salon tóc, nhân sự và đào tạo thợ, giá dịch vụ và biên lợi nhuận, giữ khách, marketing cho salon, chuyên môn tóc và da đầu, và cách viết nội dung về các mảng đó. Câu hỏi ngoài phạm vi thì nói thẳng là ngoài phạm vi và dừng.",
  "2. Cụ thể tới mức dùng được ngay: đưa câu mở bài mẫu, dàn ý, con số có nguồn, hoặc một câu để hỏi thợ vào sáng mai. Tránh lời khuyên chung chung ai cũng gật.",
  "3. KHÔNG bịa số liệu, tên nghiên cứu, tên chuyên gia, tên salon. Tra web không ra thì nói thẳng là chưa tìm được.",
  "",
  "RANH GIỚI AN TOÀN, không được vượt:",
  "4. Bạn KHÔNG phải bác sĩ và không tư vấn y tế. Câu hỏi về bệnh da đầu, thuốc mọc tóc, liều dùng, hay tình trạng cụ thể của một người khách thì đưa thông tin chung và khuyên đi khám, không kê đơn, không chẩn đoán.",
  "5. KHÔNG gợi ý nội dung hứa con số: không hứa mọc bao nhiêu tóc trong bao nhiêu tuần, cũng không hứa tăng bao nhiêu phần trăm doanh thu. Số liệu nghiên cứu phải gắn với nghiên cứu.",
  "6. KHÔNG viết nội dung chê ngoại hình, lấy hói hay tóc thưa ra làm trò, hay lấy sự tự ti của khách làm đòn bẩy bán hàng.",
  "7. NÓI RÕ GIỚI HẠN sản phẩm khi câu hỏi chạm tới: dầu gội và dưỡng chất chăm phần tóc đã mọc ra, không đổi được nang tóc.",
  "8. KHÔNG xui chủ salon ràng buộc thợ bằng thủ đoạn: giấu nghề, giữ giấy tờ, phạt tiền để thợ khỏi nghỉ. Hệ thống hỗ trợ con người, không nâng, không bẻ. Giữ người bằng lộ trình, không bằng dây trói.",
  "",
  "Giọng văn:",
  "9. Trả lời bằng tiếng Việt, câu ngắn, từ thông dụng. Không dùng dấu gạch ngang dài.",
  "10. Giọng một người từng đứng ghế nói với một người đang đứng ghế. Ngang hàng, không dạy đời.",
  "11. Không dùng từ rỗng: kiến tạo, lan tỏa, nâng tầm, truyền cảm hứng, cuộc cách mạng, lột xác, thần thánh, bứt phá.",
  "12. Luôn nói đi cùng, không nói đi theo.",
  "13. Nguồn quốc tế thì dịch ý sang tiếng Việt, đừng bê nguyên đoạn tiếng Anh. Thuật ngữ giữ tiếng Anh thì kèm nghĩa Việt lần đầu.",
  // Luật 14 phải viết chặt tới mức này vì tắt thinking làm model hay kể lể quá trình.
  // Bản đầu chỉ ghi "không kể lại quá trình tra cứu" thì nó vẫn mở bài bằng
  // "Câu hỏi này thuộc mảng dinh dưỡng, mình trả lời thẳng không cần tra web."
  // Phải cấm cả việc nói mình CÓ tra lẫn việc nói mình KHÔNG tra.
  "14. CHỈ xuất câu trả lời cuối cùng, không có gì khác.",
  "TUYỆT ĐỐI không nhắc tới việc tra web, dù là có tra hay không tra. Không viết 'tôi tra web', 'tôi thử lại', 'không cần tra web', 'câu hỏi này thuộc mảng...', 'mình trả lời thẳng'.",
  "Không mở bài bằng cách phân loại câu hỏi hay giải thích mình sắp làm gì. Câu đầu tiên phải đã là nội dung trả lời.",
].join("\n");

/**
 * Hỏi trợ lý, có tra web. Trả về chuỗi câu trả lời đã kèm mục Nguồn (nếu có trích dẫn).
 * Ném lỗi khi gọi hỏng, nơi gọi tự quyết định ghi lỗi thế nào.
 */
async function hoiTroLy({ key, cauHoi, kho, lichSu }) {
  const system = LUAT + (kho
    ? "\n\nCác chủ đề đang theo dõi trong app, dùng để đối chiếu khi liên quan:\n" + kho
    : "");

  const messages = [];
  for (const m of (Array.isArray(lichSu) ? lichSu.slice(-8) : [])) {
    if (m && (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" && m.content.trim()) {
      messages.push({ role: m.role, content: m.content.slice(0, 4000) });
    }
  }
  messages.push({ role: "user", content: cauHoi });

  // Bản web_search cơ bản (không lọc động bằng code) cho nhanh, hợp với "hỏi nhanh".
  const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];

  const goiClaude = async () => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        // Tắt thinking để trả nhanh; hướng dẫn trong LUAT đủ để nó chủ động tra web.
        thinking: { type: "disabled" },
        system,
        messages,
        tools,
      }),
    });
    return { res, data: await res.json() };
  };

  // Công cụ tra web chạy phía máy chủ Anthropic. Vòng lặp tra dài thì API dừng với
  // stop_reason "pause_turn"; ta nối lại rồi gọi tiếp cho nó chạy nốt.
  let data;
  for (let i = 0; i < 4; i++) {
    const r = await goiClaude();
    if (!r.res.ok) {
      const e = new Error((r.data && r.data.error && r.data.error.message) || ("HTTP " + r.res.status));
      e.tenLoi = "api";
      throw e;
    }
    data = r.data;
    if (data.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: data.content });
  }

  const blocks = (data && data.content) || [];
  const traLoi = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();

  // Gom nguồn từ các trích dẫn web (nếu có) để người đọc tự kiểm chứng.
  const nguon = [];
  const daCo = new Set();
  for (const b of blocks) {
    if (b.type !== "text" || !Array.isArray(b.citations)) continue;
    for (const c of b.citations) {
      const url = c && c.url;
      if (!url || daCo.has(url)) continue;
      daCo.add(url);
      nguon.push({ url, tieuDe: c.title || url });
    }
  }

  let output = traLoi || "(không có nội dung)";
  if (nguon.length) {
    output += "\n\n**Nguồn:**\n" +
      nguon.slice(0, 8).map((n) => `- [${n.tieuDe}](${n.url})`).join("\n");
  }
  return output;
}

module.exports = { MODEL, LUAT, hoiTroLy };
