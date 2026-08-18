/**
 * NẾP TÓC — Kho lưu content đã tạo.
 *
 * Vì sao có file này: trước đây content sinh ra chỉ nằm trong trí nhớ của trang. Bấm ra
 * ngoài hộp một cái là mất trắng, mà mỗi lần tạo là một lượt gọi API tốn tiền và mất
 * nửa phút chờ. Nhân sự viết xong buổi sáng, chiều muốn xem lại thì không còn đâu mà xem.
 *
 * Lưu ở MÁY CHỦ chứ không phải trình duyệt, cố ý. Để ở localStorage thì đổi máy, đổi
 * trình duyệt, hay xóa lịch sử duyệt web là mất sạch, tức là vẫn đúng cái lỗi cũ.
 *
 * Khác kho `nhat-ky` (chỉ giữ số liệu để thống kê, không giữ nội dung): kho này giữ
 * TRỌN nội dung bài để đọc lại và chép lại được.
 *
 * Mỗi bài một blob riêng, khóa `YYYY-MM-DD/<id>`, cùng lý do như nhật ký: hai người tạo
 * cùng lúc thì không đè mất của nhau.
 */
import { getStore } from "@netlify/blobs";
import gop from "./gop-so-lieu.js";

const { ngayVN } = gop;

const KHO = "content-luu";
export const SO_NGAY_GIU = 180;

/**
 * Lưu một bài vừa tạo. KHÔNG ném lỗi ra ngoài: lưu hỏng thì người dùng vẫn phải nhận
 * được bài của họ trên màn hình. Đây là việc phụ.
 * Trả về id để trang biết mà hiện trạng thái đã lưu.
 */
export async function luuContent({ nguoiDung, bai, content }) {
  try {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await getStore(KHO).setJSON(`${ngayVN()}/${id}`, {
      id,
      t: new Date().toISOString(),
      ng: String(nguoiDung || "").slice(0, 40) || "(không tên)",
      bai: {
        tieuDe: String((bai && (bai.tieuDeViet || bai.tieuDe)) || "").slice(0, 200),
        url: String((bai && bai.url) || "").slice(0, 300),
        nguon: String((bai && bai.nguon) || "").slice(0, 80),
        nhom: String((bai && bai.nhom) || "").slice(0, 10),
      },
      content,
    });
    return id;
  } catch (e) { return ""; }
}

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
  for (let i = 0; i < soNgay; i++) ngay.push(ngayVN(new Date(nay.getTime() - i * 86400000)));
  const theo = await Promise.all(ngay.map((d) => docNgay(d).catch(() => [])));
  const tatCa = [];
  theo.forEach((ds, i) => ds.forEach((x) => tatCa.push({ ...x, ngay: ngay[i] })));
  tatCa.sort((a, b) => String(b.t).localeCompare(String(a.t)));
  return tatCa;
}

/** Xóa một bài. Cần cả ngày lẫn id vì khóa gồm hai phần. */
export async function xoaContent(ngay, id) {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ngay)) || !/^[a-z0-9]+$/i.test(String(id))) return false;
    await getStore(KHO).delete(`${ngay}/${id}`);
    return true;
  } catch (e) { return false; }
}

/** Dọn bài cũ hơn SO_NGAY_GIU. */
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
