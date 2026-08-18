/**
 * NẾP TÓC — Nhật ký sử dụng, dùng cho trang Quản trị. Phần LƯU TRỮ.
 *
 * Phần tính toán nằm ở gop-so-lieu.js, dùng chung với máy chủ chạy tại máy.
 * Ở đây chỉ lo việc đọc ghi Netlify Blobs.
 *
 * Đặt trong thư mục con `chung/` để Netlify KHÔNG coi nó là một hàm riêng. File nằm
 * thẳng ở netlify/functions thì mỗi file thành một endpoint công khai; ở đây không muốn
 * vậy vì nhật ký chỉ được đọc qua hàm thong-ke đã kiểm mật khẩu.
 *
 * MỖI SỰ KIỆN LÀ MỘT BLOB RIÊNG, khóa dạng "YYYY-MM-DD/<id>".
 * Cố ý không gom cả ngày vào một blob rồi đọc ra ghi đè: hai người bấm cùng lúc thì cả
 * hai đọc được bản cũ, người ghi sau đè mất sự kiện của người ghi trước. Mỗi sự kiện một
 * khóa thì không bao giờ tranh nhau, đổi lại lúc đọc phải liệt kê. Với vài chục lượt mỗi
 * ngày thì liệt kê rẻ hơn nhiều so với việc mất số liệu.
 */
import { getStore } from "@netlify/blobs";
import gop from "./gop-so-lieu.js";

const { ngayVN, soanSuKien, gopSoLieu } = gop;

const KHO = "nhat-ky";
export const SO_NGAY_GIU = 90;
export { ngayVN, gopSoLieu };

/**
 * Ghi một sự kiện. KHÔNG BAO GIỜ ném lỗi ra ngoài: nhật ký hỏng thì người dùng vẫn phải
 * lấy được bài của họ. Ghi log là việc phụ, không được làm hỏng việc chính.
 */
export async function ghiSuKien(sk) {
  try {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await getStore(KHO).setJSON(`${ngayVN()}/${id}`, soanSuKien(sk));
  } catch (e) { /* im lặng, xem ghi chú ở trên */ }
}

/** Đọc mọi sự kiện của một ngày. */
async function docNgay(ngay) {
  const store = getStore(KHO);
  const { blobs } = await store.list({ prefix: ngay + "/" });
  const ra = await Promise.all(
    (blobs || []).map((b) => store.get(b.key, { type: "json" }).catch(() => null))
  );
  return ra.filter(Boolean);
}

/** Đọc N ngày gần nhất, mới nhất trước. */
export async function docNhieuNgay(soNgay) {
  const ngay = [];
  const nay = new Date();
  for (let i = 0; i < soNgay; i++) {
    ngay.push(ngayVN(new Date(nay.getTime() - i * 86400000)));
  }
  const theoNgay = await Promise.all(ngay.map((d) => docNgay(d).catch(() => [])));
  const tatCa = [];
  theoNgay.forEach((ds, i) => ds.forEach((x) => tatCa.push({ ...x, ngay: ngay[i] })));
  tatCa.sort((a, b) => String(b.t).localeCompare(String(a.t)));
  return { ngay, tatCa };
}

/** Dọn sự kiện cũ hơn SO_NGAY_GIU. Gọi thưa thôi, đây là việc quét cả kho. */
export async function donCu() {
  try {
    const store = getStore(KHO);
    const han = ngayVN(new Date(Date.now() - SO_NGAY_GIU * 86400000));
    const { blobs } = await store.list();
    const cu = (blobs || []).filter((b) => String(b.key).slice(0, 10) < han);
    await Promise.all(cu.map((b) => store.delete(b.key).catch(() => {})));
    return cu.length;
  } catch (e) { return 0; }
}
