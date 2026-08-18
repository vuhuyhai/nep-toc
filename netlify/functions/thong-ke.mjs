/**
 * NẾP TÓC — Cấp số liệu cho trang Quản trị. Netlify Functions v2.
 *
 * Đọc nhật ký từ Blobs, gộp thành số liệu, trả về cho quan-tri.html vẽ.
 *
 * MẬT KHẨU RIÊNG, KHÔNG dùng lại MA_TRUY_CAP.
 * Mã truy cập đưa cho cả nhóm nhân sự; ai cũng biết. Trang quản trị cho thấy ai dùng bao
 * nhiêu lượt, đó là chuyện của người quản lý, không phải chuyện cả nhóm xem được. Nên
 * dùng biến riêng MA_QUAN_TRI.
 *
 * Nhận POST chứ không GET: mật khẩu nằm trong thân yêu cầu, không lọt vào thanh địa chỉ,
 * lịch sử trình duyệt hay nhật ký máy chủ.
 *
 * Chưa đặt MA_QUAN_TRI thì TỪ CHỐI, không mở toang. Giống hai cửa còn lại của app.
 */
import { docNhieuNgay, gopSoLieu, donCu, SO_NGAY_GIU } from "./chung/nhat-ky.mjs";
import { danhSach, datKhoa, xoaNguoi } from "./chung/nguoi-dung.mjs";

const SO_NGAY_MAC_DINH = 30;
const SO_SU_KIEN_TRA_VE = 300;

export default async (req) => {
  const dau = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ loi: "chi_nhan_post" }), { status: 405, headers: dau });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ loi: "body_hong" }), { status: 400, headers: dau }); }

  const maDung = process.env.MA_QUAN_TRI || "";
  if (!maDung) {
    return new Response(JSON.stringify({ loi: "chua_dat_ma_quan_tri" }), { headers: dau });
  }
  if (String((body && body.ma) || "") !== maDung) {
    // Trả 200 kèm mã lỗi thay vì 401, để trang tự hiện thông báo tiếng Việt gọn gàng.
    return new Response(JSON.stringify({ loi: "sai_ma" }), { headers: dau });
  }

  // Khóa, mở khóa, hoặc xóa một người đã đăng ký. Dùng khi ai đó nghỉ việc hay mất máy.
  // Khóa thì người đó về màn đăng ký, mà cả nhóm KHÔNG phải đổi mã truy cập.
  if (body.viec === "khoa") {
    return new Response(JSON.stringify({ ok: await datKhoa(body.token, body.khoa !== false) }), { headers: dau });
  }
  if (body.viec === "xoa-nguoi") {
    return new Response(JSON.stringify({ ok: await xoaNguoi(body.token) }), { headers: dau });
  }

  const soNgay = Math.min(Math.max(Number(body.soNgay) || SO_NGAY_MAC_DINH, 1), SO_NGAY_GIU);

  try {
    const kho = await docNhieuNgay(soNgay);
    const so = gopSoLieu(kho);

    // Dọn nhật ký quá hạn. Làm ở đây vì trang quản trị chạy thưa, không ảnh hưởng ai.
    // Xác suất 1/10 để không phải lần mở nào cũng quét cả kho.
    let daDon = 0;
    if (Math.random() < 0.1) daDon = await donCu();

    return new Response(JSON.stringify({
      ok: true,
      soNgay,
      soNgayGiu: SO_NGAY_GIU,
      daDon,
      soLieu: so,
      // Chỉ trả về một khúc lịch sử gần đây. Ba trăm dòng là quá đủ để dò lại một việc,
      // mà vẫn nhẹ để trang vẽ mượt trên điện thoại.
      lichSu: kho.tatCa.slice(0, SO_SU_KIEN_TRA_VE),
      tongSuKien: kho.tatCa.length,
      nguoiDung: await danhSach(),
    }), { headers: dau });
  } catch (e) {
    return new Response(JSON.stringify({ loi: "doc_hong", chiTiet: String((e && e.message) || e) }), { headers: dau });
  }
};
