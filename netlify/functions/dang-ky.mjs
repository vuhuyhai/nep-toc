/**
 * NẾP TÓC — Đăng ký người dùng. Netlify Functions v2.
 *
 * Nhận thông tin + mã truy cập dùng chung, đổi lấy một mã thông hành riêng (token).
 * Từ lúc đó trình duyệt chỉ gửi token, không gửi mã dùng chung nữa.
 *
 * Cũng nhận việc "kiem" để trang tự hỏi xem token còn sống không. Cần cái này vì Vũ Hải
 * có thể khóa một người ở trang Quản trị; trang phải biết mà đưa họ về màn đăng ký thay
 * vì để họ bấm mãi rồi báo lỗi khó hiểu.
 *
 * Nhận POST để mã không lọt vào thanh địa chỉ. Chưa đặt MA_TRUY_CAP thì TỪ CHỐI.
 */
import { dangKy, kiemToken } from "./chung/nguoi-dung.mjs";

export default async (req) => {
  const dau = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ loi: "chi_nhan_post" }), { status: 405, headers: dau });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ loi: "body_hong" }), { status: 400, headers: dau }); }

  // Việc "kiem": trang hỏi xem token còn dùng được không. Không cần mã truy cập.
  if (body && body.viec === "kiem") {
    const hs = await kiemToken(body.token);
    return new Response(JSON.stringify(
      hs ? { ok: true, ten: hs.ten } : { loi: "token_hong" }
    ), { headers: dau });
  }

  const maDung = process.env.MA_TRUY_CAP || "";
  if (!maDung) return new Response(JSON.stringify({ loi: "chua_dat_ma" }), { headers: dau });
  if (String((body && body.ma) || "") !== maDung) {
    return new Response(JSON.stringify({ loi: "sai_ma" }), { headers: dau });
  }

  try {
    const kq = await dangKy({
      ten: body.ten, dienThoai: body.dienThoai, dungZalo: body.dungZalo, email: body.email,
    });
    if (kq.loi) return new Response(JSON.stringify(kq), { headers: dau });
    return new Response(JSON.stringify({ ok: true, token: kq.token, ten: kq.hoSo.ten }), { headers: dau });
  } catch (e) {
    return new Response(JSON.stringify({ loi: "ghi_hong", chiTiet: String((e && e.message) || e) }), { headers: dau });
  }
};
