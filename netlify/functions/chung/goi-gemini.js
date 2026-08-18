/**
 * NẾP TÓC — Gọi Gemini API, trả về JSON đã đọc sẵn.
 *
 * Viết CommonJS để loi-nhac-content.js require được, giống các file chung khác.
 *
 * VÌ SAO CÓ FILE NÀY. App mở công khai nên số lượt tạo content sẽ tăng mạnh. Gemini có
 * bậc miễn phí rộng hơn hẳn, hợp với giai đoạn lấy phản hồi. Lời nhắc và khuôn kết quả
 * GIỮ NGUYÊN, chỉ đổi chỗ gửi đi, để giọng văn không đổi theo.
 */

const GOC = "https://generativelanguage.googleapis.com/v1beta";

// Thứ tự ưu tiên khi phải tự dò model. Đặt bản mới trước, bản cũ sau làm lưới đỡ.
// Tên model Google đổi liên tục nên KHÔNG ghi cứng một cái: hôm nay đúng, ba tháng sau
// gọi là 404 và cả tính năng chết mà không ai biết vì sao.
const UU_TIEN = [
  "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash",
  "gemini-3-flash-preview", "gemini-3.1-flash-lite",
  "gemini-2.5-flash", "gemini-flash-latest",
];

// Nhớ model đã dò được trong vòng đời của hàm nền, khỏi hỏi lại mỗi lượt.
let modelDaDo = "";

/**
 * Đổi JSON Schema kiểu Anthropic sang khuôn Gemini nhận.
 *
 * Ba khác biệt đã phải xử lý:
 *   1. Gemini KHÔNG chấp nhận `additionalProperties`, gửi vào là báo lỗi 400.
 *   2. Gemini không giữ thứ tự khóa theo `properties`, phải khai `propertyOrdering`
 *      thì kết quả mới ra đúng thứ tự mình muốn.
 *   3. Kiểu viết hoa hay thường đều được ở bản v1beta, nhưng giữ nguyên chữ thường
 *      cho khớp file gốc.
 */
function doiSchema(s) {
  if (!s || typeof s !== "object") return s;
  if (Array.isArray(s)) return s.map(doiSchema);

  const ra = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === "additionalProperties") continue;
    if (k === "properties") {
      // PHẢI đệ quy vào TỪNG thuộc tính, không phải vào cả khối properties.
      // Làm sai chỗ này thì additionalProperties ở tầng trong vẫn còn nguyên và Gemini
      // trả 400. Đã đo và bắt được đúng lỗi đó.
      const p = {};
      for (const [ten, con] of Object.entries(v || {})) p[ten] = doiSchema(con);
      ra[k] = p;
    } else if (k === "items") {
      ra[k] = doiSchema(v);
    } else {
      ra[k] = v;
    }
  }
  if (ra.type === "object" && ra.properties) {
    ra.propertyOrdering = Object.keys(ra.properties);
  }
  return ra;
}

/** Hỏi Google xem khóa này dùng được model nào, rồi chọn theo thứ tự ưu tiên. */
async function doModel(key, signal) {
  const res = await fetch(`${GOC}/models?key=${encodeURIComponent(key)}&pageSize=200`, { signal });
  if (!res.ok) throw new Error("khong do duoc model: HTTP " + res.status);
  const j = await res.json();
  const co = (j.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m) => String(m.name).replace(/^models\//, ""));
  for (const m of UU_TIEN) if (co.includes(m)) return m;
  // Không có cái nào trong danh sách ưu tiên thì lấy bản flash bất kỳ, tránh model ảnh,
  // giọng nói, nhúng vector.
  const con = co.filter((m) => /flash|pro/.test(m) && !/image|tts|embedding|live|veo|lyria|robotics/.test(m));
  if (con[0]) return con[0];
  throw new Error("khoa nay khong co model nao sinh van ban duoc");
}

/**
 * Gọi Gemini, trả về đối tượng đã đọc từ JSON.
 * Ném lỗi có `tenLoi` để nơi gọi phân biệt được lỗi khóa với lỗi mạng.
 */
async function goiGemini({ key, model, heThong, tinNhan, schema, maxTokens, signal }) {
  const than = {
    systemInstruction: { parts: [{ text: heThong }] },
    contents: [{ role: "user", parts: [{ text: tinNhan }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: doiSchema(schema),
      maxOutputTokens: maxTokens || 4000,
      temperature: 1,
      // Tắt phần suy nghĩ. Cùng lý do như `thinking: disabled` bên Claude: việc này có
      // khuôn sẵn, không cần nghĩ dài, mà phần nghĩ lại ĐẾM VÀO maxOutputTokens.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const goiMot = async (ten) => {
    const res = await fetch(
      `${GOC}/models/${encodeURIComponent(ten)}:generateContent?key=${encodeURIComponent(key)}`,
      { method: "POST", signal, headers: { "content-type": "application/json" }, body: JSON.stringify(than) }
    );
    const data = await res.json().catch(() => null);
    return { res, data };
  };

  let ten = model || modelDaDo || UU_TIEN[0];
  let { res, data } = await goiMot(ten);

  // Model không tồn tại hoặc khóa không được phép dùng model đó: dò lại rồi thử một lần
  // nữa. Đây là đường sống khi Google đổi tên model.
  if (!res.ok && (res.status === 404 || res.status === 400)) {
    try {
      const moi = await doModel(key, signal);
      if (moi && moi !== ten) {
        modelDaDo = moi;
        ({ res, data } = await goiMot(moi));
        ten = moi;
      }
    } catch (e) { /* dò không được thì để lỗi gốc rơi xuống dưới */ }
  }

  if (!res.ok) {
    const tin = (data && data.error && data.error.message) || ("HTTP " + res.status);
    const e = new Error(tin);
    // Lỗi khóa và lỗi hạn mức thì thử lại vô ích, phải báo đúng bệnh.
    e.tenLoi = /API key|API_KEY_INVALID|PERMISSION_DENIED|quota|RESOURCE_EXHAUSTED/i.test(tin)
      ? "api" : "mang";
    throw e;
  }
  modelDaDo = ten;

  const ung = (data && data.candidates && data.candidates[0]) || null;
  const chu = ((ung && ung.content && ung.content.parts) || [])
    .map((p) => p && p.text).filter(Boolean).join("").trim();

  let out = null;
  try { out = JSON.parse(chu); } catch (e) {
    // Thỉnh thoảng Gemini vẫn bọc kết quả trong khối ``` dù đã bảo trả JSON thuần.
    try {
      const sach = chu.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      out = JSON.parse(sach);
    } catch (e2) { out = null; }
  }

  if (!out) {
    const biCat = ung && ung.finishReason === "MAX_TOKENS";
    const e = new Error(biCat
      ? "câu trả lời bị cắt vì chạm trần token, hãy nới maxOutputTokens"
      : "không đọc được kết quả: " + chu.slice(0, 160));
    e.tenLoi = biCat ? "cut_token" : "khong_doc_duoc";
    throw e;
  }
  return { out, model: ten };
}

module.exports = { goiGemini, doModel, doiSchema, UU_TIEN, GOC };
