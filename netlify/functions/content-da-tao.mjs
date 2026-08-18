/**
 * NẾP TÓC — Đọc và xóa content đã tạo. Netlify Functions v2.
 *
 * Dùng cho tab "Đã tạo" trong app. Gác bằng MA_TRUY_CAP, tức là cùng mã nhân sự đang
 * dùng để tạo content: ai tạo được thì đọc lại được, hợp lý cho một công cụ dùng chung.
 * KHÔNG dùng MA_QUAN_TRI ở đây, vì đây là việc hằng ngày của nhân sự chứ không phải
 * việc của người quản lý.
 *
 * Nhận POST để mã không lọt vào thanh địa chỉ, giống hàm thong-ke.
 * Hàm này KHÔNG gọi API tính tiền nào, nên không cần trần lượt.
 */
import { docNhieuNgay, xoaContent, donCu, SO_NGAY_GIU } from "./chung/kho-content.mjs";
import { kiemToken } from "./chung/nguoi-dung.mjs";

const SO_NGAY_MAC_DINH = 60;
const SO_BAI_TRA_VE = 200;

export default async (req) => {
  const dau = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ loi: "chi_nhan_post" }), { status: 405, headers: dau });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ loi: "body_hong" }), { status: 400, headers: dau }); }

  // Cùng hai đường vào như hàm nền: token của người đã đăng ký, hoặc mã dùng chung cũ.
  const maDung = process.env.MA_TRUY_CAP || "";
  if (!maDung) return new Response(JSON.stringify({ loi: "chua_dat_ma" }), { headers: dau });
  if (body && body.token) {
    if (!(await kiemToken(body.token))) {
      return new Response(JSON.stringify({ loi: "token_hong" }), { headers: dau });
    }
  } else if (String((body && body.ma) || "") !== maDung) {
    return new Response(JSON.stringify({ loi: "sai_ma" }), { headers: dau });
  }

  try {
    if (body.viec === "xoa") {
      const ok = await xoaContent(body.ngay, body.id);
      return new Response(JSON.stringify({ ok }), { headers: dau });
    }

    const soNgay = Math.min(Math.max(Number(body.soNgay) || SO_NGAY_MAC_DINH, 1), SO_NGAY_GIU);
    const ds = await docNhieuNgay(soNgay);

    // Dọn bài quá hạn với xác suất nhỏ, để không phải lần nào mở tab cũng quét cả kho.
    if (Math.random() < 0.05) await donCu();

    return new Response(JSON.stringify({
      ok: true, soNgay, soNgayGiu: SO_NGAY_GIU,
      tong: ds.length,
      ds: ds.slice(0, SO_BAI_TRA_VE),
    }), { headers: dau });
  } catch (e) {
    return new Response(JSON.stringify({ loi: "doc_hong", chiTiet: String((e && e.message) || e) }), { headers: dau });
  }
};
