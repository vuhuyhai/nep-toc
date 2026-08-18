/**
 * NẾP TÓC — Hàm nền viết tóm tắt tiếng Việt + Gợi ý content cho một bài.
 * Nhận tiêu đề + tóm tắt (phần lớn tiếng Anh), trả về:
 *   - tieuDeViet: tiêu đề dịch sang tiếng Việt
 *   - tomTat:     tóm tắt 1-2 câu bằng tiếng Việt
 *   - hook:       một câu mở bài viết sẵn để chép ra dùng ngay
 *   - gocViet:    một câu chỉ hướng triển khai bài đăng
 *   - luuY:       câu cảnh báo, rỗng nếu bài không có gì phải cảnh báo
 *
 * Lời nhắc và lệnh gọi Claude nằm ở loi-nhac-phan-tich.js, dùng chung với bộ quét chạy
 * ở máy. API key lấy từ biến môi trường ANTHROPIC_API_KEY của Netlify.
 *
 * CÓ KHÓA NỘI BỘ. Đây là cửa gọi API tốn tiền: mỗi lần POST là một lần gọi Claude. Để
 * trần thì ai biết đường dẫn cũng ngồi bấm được. Người gọi hợp lệ duy nhất là bộ quét
 * chạy trên GitHub Actions, nên nó phải gửi header x-khoa-noi-bo khớp env KHOA_NOI_BO.
 * Chưa đặt KHOA_NOI_BO thì hàm từ chối, cố ý: mặc định phải là đóng.
 * PHẢI đặt biến này ở CẢ HAI nơi, Netlify lẫn GitHub Secrets, không thì bộ quét 7h sáng
 * chạy nhưng không viết được gợi ý content nào.
 */

const { phanTichBai } = require("./loi-nhac-phan-tich.js");

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-khoa-noi-bo",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers, body: JSON.stringify({ loi: "chi_nhan_post" }) };

  const khoaDung = process.env.KHOA_NOI_BO || "";
  if (!khoaDung) return { statusCode: 200, headers, body: JSON.stringify({ loi: "chua_dat_khoa_noi_bo" }) };
  const h = event.headers || {};
  const khoaGui = h["x-khoa-noi-bo"] || h["X-Khoa-Noi-Bo"] || "";
  if (khoaGui !== khoaDung)
    return { statusCode: 200, headers, body: JSON.stringify({ loi: "sai_khoa_noi_bo" }) };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { statusCode: 200, headers, body: JSON.stringify({ loi: "chua_co_key" }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ loi: "body_hong" }) }; }

  const tieuDe = String(body.tieuDe || "").trim().slice(0, 500);
  const tomTat = String(body.tomTat || "").trim().slice(0, 1200);
  const nhom = String(body.nhom || "").trim().slice(0, 40);
  // Số thứ tự bài, để lời nhắc luân phiên kiểu mở đầu câu hook.
  const thuTu = Number.isInteger(body.thuTu) ? body.thuTu : undefined;
  if (!tieuDe) return { statusCode: 400, headers, body: JSON.stringify({ loi: "thieu_tieu_de" }) };

  try {
    const kq = await phanTichBai({ key, tieuDe, tomTat, nhom, thuTu });
    return { statusCode: 200, headers, body: JSON.stringify(kq) };
  } catch (e) {
    // Luôn trả 200 kèm mã lỗi, để bộ quét đọc được lý do thay vì chỉ thấy HTTP 500.
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ loi: e.tenLoi || "mang", chiTiet: String((e && e.message) || e) }),
    };
  }
};
