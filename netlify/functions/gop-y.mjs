/**
 * NẾP TÓC — Nhận góp ý từ người dùng. Netlify Functions v2.
 *
 * App mở công khai để lấy phản hồi, nên đây là cửa duy nhất KHÔNG đòi đăng ký:
 * bắt người ta đăng ký mới cho góp ý thì phần lớn sẽ bỏ đi, mà đúng những người bỏ đi
 * mới là người có điều đáng nói nhất.
 *
 * Không gọi API tính tiền nào. Chống spam bằng ba thứ nhẹ: giới hạn độ dài, trần số lần
 * gửi mỗi ngày theo IP, và bỏ qua nội dung quá ngắn.
 *
 * Đọc lại thì phải có MA_QUAN_TRI, vì góp ý có thể kèm số điện thoại người gửi.
 */
import { getStore } from "@netlify/blobs";
import gop from "./chung/gop-so-lieu.js";
import { kiemToken } from "./chung/nguoi-dung.mjs";

const { ngayVN } = gop;

const KHO = "gop-y";
const TRAN_NGAY_IP = 10;   // một địa chỉ IP gửi tối đa ngần này góp ý mỗi ngày
const SO_NGAY_GIU = 365;

const gon = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);

const LOAI_HOP_LE = new Set(["loi", "y-tuong", "noi-dung", "khac"]);

export default async (req) => {
  const dau = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ loi: "chi_nhan_post" }), { status: 405, headers: dau });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ loi: "body_hong" }), { status: 400, headers: dau }); }

  const store = getStore(KHO);

  // ---- Đọc: dành cho trang Quản trị, phải có mật khẩu quản trị ----
  if (body.viec === "doc") {
    const maQT = process.env.MA_QUAN_TRI || "";
    if (!maQT || String(body.ma || "") !== maQT) {
      return new Response(JSON.stringify({ loi: "sai_ma" }), { headers: dau });
    }
    try {
      const { blobs } = await store.list();
      const ds = await Promise.all(
        (blobs || []).map((b) => store.get(b.key, { type: "json" }).catch(() => null))
      );
      const sach = ds.filter(Boolean).sort((a, b) => String(b.t).localeCompare(String(a.t)));
      return new Response(JSON.stringify({ ok: true, tong: sach.length, ds: sach.slice(0, 300) }), { headers: dau });
    } catch (e) {
      return new Response(JSON.stringify({ loi: "doc_hong", chiTiet: String((e && e.message) || e) }), { headers: dau });
    }
  }

  // ---- Xóa một góp ý đã xử lý ----
  if (body.viec === "xoa") {
    const maQT = process.env.MA_QUAN_TRI || "";
    if (!maQT || String(body.ma || "") !== maQT) {
      return new Response(JSON.stringify({ loi: "sai_ma" }), { headers: dau });
    }
    try {
      if (!/^\d{4}-\d{2}-\d{2}\/[a-z0-9]+$/i.test(String(body.khoa || ""))) {
        return new Response(JSON.stringify({ ok: false }), { headers: dau });
      }
      await store.delete(String(body.khoa));
      return new Response(JSON.stringify({ ok: true }), { headers: dau });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false }), { headers: dau });
    }
  }

  // ---- Gửi góp ý: ai cũng gửi được ----
  const noiDung = gon(body.noiDung, 2000);
  if (noiDung.length < 5) {
    return new Response(JSON.stringify({ loi: "qua_ngan" }), { headers: dau });
  }

  const ip = req.headers.get("x-nf-client-connection-ip") || "khong-ro";
  const homNay = ngayVN();

  // Trần theo IP. Kho hỏng thì vẫn cho gửi: mất một góp ý vì lỗi kho tệ hơn là nhận
  // thừa vài cái.
  try {
    const demStore = getStore("gop-y-dem");
    const khoaDem = `${ip}-${homNay}`;
    const cu = await demStore.get(khoaDem, { type: "json" });
    const daGui = (cu && Number(cu.n)) || 0;
    if (daGui >= TRAN_NGAY_IP) {
      return new Response(JSON.stringify({ loi: "qua_nhieu" }), { headers: dau });
    }
    await demStore.setJSON(khoaDem, { n: daGui + 1 });
  } catch (e) { /* bỏ qua */ }

  // Người đã đăng ký thì lấy tên và liên hệ từ HỒ SƠ, khỏi bắt họ gõ lại.
  let nguoiGui = { ten: gon(body.ten, 60), lienHe: gon(body.lienHe, 60), daDangKy: false };
  if (body.token) {
    const hs = await kiemToken(body.token);
    if (hs) {
      nguoiGui = { ten: hs.ten, lienHe: hs.dienThoai || hs.email || "", daDangKy: true };
    }
  }

  try {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await store.setJSON(`${homNay}/${id}`, {
      khoa: `${homNay}/${id}`,
      id,
      t: new Date().toISOString(),
      ngay: homNay,
      loai: LOAI_HOP_LE.has(String(body.loai)) ? String(body.loai) : "khac",
      noiDung,
      ...nguoiGui,
      // Ghi lại người ta đang ở đâu trong app lúc góp ý. Biết bối cảnh thì đọc góp ý mới
      // hiểu, chứ "chỗ này khó dùng" mà không biết chỗ nào thì chịu.
      boiCanh: gon(body.boiCanh, 80),
      manHinh: gon(body.manHinh, 20),
    });
    return new Response(JSON.stringify({ ok: true }), { headers: dau });
  } catch (e) {
    return new Response(JSON.stringify({ loi: "ghi_hong", chiTiet: String((e && e.message) || e) }), { headers: dau });
  }
};
