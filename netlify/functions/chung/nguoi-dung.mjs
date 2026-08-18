/**
 * NẾP TÓC — Đăng ký và nhận diện người dùng.
 *
 * VÌ SAO CÓ FILE NÀY. Trước đây nhân sự phải gõ mã truy cập rồi gõ tên, mỗi thứ một hộp
 * thoại của trình duyệt, và bật lên GIỮA LÚC đang bấm tạo content. Xóa lịch sử duyệt web
 * hay đổi máy là hỏi lại từ đầu. Nay đăng ký MỘT LẦN ở màn riêng, xong dùng thẳng.
 *
 * CÁCH LÀM: đổi mã dùng chung lấy một mã thông hành riêng cho từng người.
 *   - Nhập mã truy cập + thông tin => máy chủ cấp `token` ngẫu nhiên, lưu kèm hồ sơ.
 *   - Từ đó trình duyệt gửi `token`, không gửi mã dùng chung nữa.
 *
 * Được ba thứ mà cách cũ không có:
 *   1. Không phải gõ lại gì sau lần đầu.
 *   2. Tên người dùng là thật, lấy từ hồ sơ đã đăng ký, không phải ai gõ gì cũng được.
 *   3. Khóa được TỪNG người mà không phải đổi mã của cả nhóm.
 *
 * Đây KHÔNG phải hệ thống tài khoản có mật khẩu. Cố ý. Công cụ nội bộ vài người dùng,
 * dựng đăng nhập đầy đủ là quá tay. Token đây tương đương một tấm thẻ ra vào: ai cầm thẻ
 * thì vào được, mất thẻ thì khóa thẻ đó lại.
 */
import { getStore } from "@netlify/blobs";
import gop from "./gop-so-lieu.js";

const { ngayVN } = gop;

const KHO = "nguoi-dung";

const gon = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);

/** Sinh token. 32 byte ngẫu nhiên, đủ dài để không ai đoán được. */
function sinhToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * Đăng ký một người. Trả { ok, token, hoSo } hoặc { loi }.
 * Người gọi đã phải kiểm mã truy cập TRƯỚC khi gọi hàm này.
 */
export async function dangKy({ ten, dienThoai, dungZalo, email }) {
  const hoTen = gon(ten, 60);
  if (hoTen.length < 2) return { loi: "thieu_ten" };

  // Số liên lạc: bỏ khoảng trắng, dấu chấm, gạch ngang, ngoặc mà người ta hay gõ xen vào.
  // Kiểm LỎNG thôi, chỉ chặn thứ rõ ràng không phải số. Chặt quá thì loại nhầm số cố
  // định có mã vùng, hay người quen gõ +84.
  const sdt = gon(dienThoai, 30).replace(/[\s.()-]/g, "");
  if (!/^\+?\d{8,15}$/.test(sdt)) return { loi: "sai_so_lien_lac" };

  const mail = gon(email, 80);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(mail)) return { loi: "sai_email" };

  const token = sinhToken();
  const hoSo = {
    token,
    ten: hoTen,
    dienThoai: sdt,
    dungZalo: !!dungZalo,
    email: mail,
    tao: new Date().toISOString(),
    lanCuoi: new Date().toISOString(),
    soLuot: 0,
    khoa: false,
  };
  await getStore(KHO).setJSON(token, hoSo);
  return { ok: true, token, hoSo };
}

/**
 * Kiểm token, trả hồ sơ hoặc null.
 * KHÔNG ném lỗi: kho hỏng thì trả null để nơi gọi tự quyết, chứ không làm sập hàm nền.
 */
export async function kiemToken(token) {
  try {
    const t = String(token || "");
    if (!/^[a-f0-9]{64}$/.test(t)) return null;
    const hs = await getStore(KHO).get(t, { type: "json" });
    if (!hs || hs.khoa) return null;
    return hs;
  } catch (e) { return null; }
}

/**
 * Trần lượt mỗi ngày cho MỘT NGƯỜI.
 *
 * Từ lúc app mở công khai, trần theo địa chỉ IP không còn đủ: nhiều người dùng chung một
 * mạng công ty thì chặn oan nhau, còn một người đổi mạng là lách được. Đếm theo người
 * đúng hơn ở cả hai chiều.
 * Trần theo IP vẫn giữ, làm lớp thứ hai cho ai chưa đăng ký mà còn dùng mã cũ.
 *
 * ĐỂ 8 chứ không phải 20 như app VÓC DÁNG. Đây là app thứ NĂM dùng chung một khóa API,
 * nên nó ăn vào cùng một hạn mức với bốn app kia. Tám lượt một ngày vẫn thừa cho một
 * người làm content thật (mỗi ngày đăng một tới hai bài), mà nếu app lan rộng thì cũng
 * không kéo sập hạn mức của bốn app đang chạy.
 */
export const TRAN_NGUOI = Number(process.env.TRAN_LUOT_NGUOI) || 8;

/**
 * Cộng một lượt cho người này và trả về { daDung, tran, con }.
 * Cộng TRƯỚC khi gọi API, cùng lý do với bộ đếm theo IP: cộng sau thì ai mở nhiều tab
 * bấm cùng lúc sẽ vượt trần vì lượt nào cũng đọc được con số cũ.
 * Kho hỏng thì cho qua, chặn người dùng thật vì lỗi kho là tệ hơn.
 */
export async function congLuotNgay(hoSo) {
  try {
    if (!hoSo || !hoSo.token) return { daDung: 0, tran: TRAN_NGUOI, con: TRAN_NGUOI };
    const homNay = ngayVN();
    // Sang ngày mới thì bộ đếm về 0.
    const daDung = hoSo.ngayDem === homNay ? (Number(hoSo.luotHomNay) || 0) : 0;
    if (daDung >= TRAN_NGUOI) return { daDung, tran: TRAN_NGUOI, con: 0, het: true };
    await getStore(KHO).setJSON(hoSo.token, {
      ...hoSo,
      ngayDem: homNay,
      luotHomNay: daDung + 1,
      lanCuoi: new Date().toISOString(),
      ngayCuoi: homNay,
      soLuot: (Number(hoSo.soLuot) || 0) + 1,
    });
    return { daDung: daDung + 1, tran: TRAN_NGUOI, con: TRAN_NGUOI - daDung - 1 };
  } catch (e) {
    return { daDung: 0, tran: TRAN_NGUOI, con: TRAN_NGUOI };
  }
}

/** Danh sách người đã đăng ký, mới nhất trước. Dùng cho trang Quản trị. */
export async function danhSach() {
  try {
    const store = getStore(KHO);
    const { blobs } = await store.list();
    const ds = await Promise.all(
      (blobs || []).map((b) => store.get(b.key, { type: "json" }).catch(() => null))
    );
    return ds.filter(Boolean).sort((a, b) => String(b.tao).localeCompare(String(a.tao)));
  } catch (e) { return []; }
}

/** Khóa hoặc mở khóa một người. Dùng khi ai đó nghỉ việc hoặc mất máy. */
export async function datKhoa(token, khoa) {
  try {
    const store = getStore(KHO);
    const hs = await store.get(String(token || ""), { type: "json" });
    if (!hs) return false;
    await store.setJSON(hs.token, { ...hs, khoa: !!khoa });
    return true;
  } catch (e) { return false; }
}

/** Xóa hẳn một người khỏi kho. */
export async function xoaNguoi(token) {
  try {
    if (!/^[a-f0-9]{64}$/.test(String(token || ""))) return false;
    await getStore(KHO).delete(String(token));
    return true;
  } catch (e) { return false; }
}
