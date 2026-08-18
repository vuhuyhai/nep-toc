/**
 * NẾP TÓC — Hàm NỀN Hỏi nhanh (trợ lý có tra web). Netlify Functions v2.
 *
 * Tên kết thúc bằng "-background" nên đây là Background Function: chạy tới 15 phút,
 * không bị timeout 26 giây như hàm đồng bộ. Nhờ vậy Claude có đủ thời gian tra web
 * nhiều lượt rồi tổng hợp. Kết quả ghi vào kho tạm Netlify Blobs theo "id" do trình
 * duyệt tạo; trang web hỏi kết quả qua hàm hoi-ket-qua.
 *
 * BẮT BUỘC dùng API v2 (export default async (req)). Bản v1 (exports.handler) báo
 * MissingBlobsEnvironmentError vì Netlify không tự cấp môi trường Blobs cho nó.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO CÓ MÃ TRUY CẬP, dù app này không bán vé
 *
 * App bỏ hẳn tầng trả phí theo yêu cầu, nhưng KHÔNG được bỏ tầng chặn. Mỗi lượt hỏi là
 * một lần gọi API có tra web, tốn tiền thật. Ở app SỨC BẬT, hàm này từng để trần: ai
 * biết đường dẫn cũng gọi được, ngồi bấm cả ngày là đốt sạch credit mà không ai hay.
 *
 * Ở đây dùng cách nhẹ nhất còn đủ an toàn cho một công cụ nội bộ:
 *   1. Một mã truy cập dùng chung, đặt ở biến môi trường MA_TRUY_CAP trên Netlify.
 *      Nhân sự gõ một lần, trình duyệt nhớ. Mã KHÔNG nằm trong mã nguồn trang.
 *   2. Trần lượt hỏi mỗi ngày theo địa chỉ IP. Lỡ mã bị chuyền tay ra ngoài thì thiệt
 *      hại vẫn có trần.
 *
 * Chưa đặt MA_TRUY_CAP thì hàm TỪ CHỐI chạy, cố ý. Mặc định phải là đóng, không phải mở.
 * Đường chạy tại máy (may-chu.js) không qua hàm này nên không cần mã.
 */
import { getStore } from "@netlify/blobs";
import loiNhacHoi from "./loi-nhac-hoi.js";
import loiNhacContent from "./loi-nhac-content.js";
import { ghiSuKien } from "./chung/nhat-ky.mjs";
import { luuContent } from "./chung/kho-content.mjs";
import { kiemToken, congLuotNgay } from "./chung/nguoi-dung.mjs";

const { hoiTroLy } = loiNhacHoi;
const { taoContent } = loiNhacContent;

// Trần lượt hỏi mỗi ngày cho một địa chỉ IP. Vài người có thể dùng chung một mạng, con số
// này rộng rãi cho người làm thật nhưng chặn được kiểu bấm liên tục cả ngày.
// Hạ từ 60 xuống 30: app thứ năm dùng chung khóa API với bốn app kia, xem ghi chú ở
// TRAN_NGUOI trong chung/nguoi-dung.mjs.
const TRAN_NGAY = Number(process.env.TRAN_LUOT_NGAY) || 30;

const ngayHomNay = () => new Date().toISOString().slice(0, 10);

export default async (req) => {
  // Background function: Netlify đã trả 202 cho trình duyệt, giá trị trả về ở đây bị bỏ qua.
  // Vì vậy MỌI lỗi, kể cả "sai mã", đều phải ghi vào Blobs thì trình duyệt mới đọc được.
  let body;
  try { body = await req.json(); }
  catch { return new Response("", { status: 400 }); }

  const id = String((body && body.id) || "").slice(0, 80);
  if (!id) return new Response("", { status: 400 });

  const store = getStore("hoi-ketqua");
  const ghi = async (obj) => { try { await store.setJSON(id, obj); } catch (e) { /* bỏ qua */ } };

  const key = process.env.ANTHROPIC_API_KEY;
  // Gemini lo phần viết content, Claude lo Hỏi nhanh (cần tra web) và làm đường lùi.
  // Có một trong hai là chạy được, không cần cả hai.
  const keyGemini = process.env.GEMINI_API_KEY || "";
  if (!key && !keyGemini) { await ghi({ xong: true, loi: "chua_co_key" }); return new Response(""); }

  // ---- Cổng vào ----
  // Hai đường vào, cùng một cửa:
  //   1. TOKEN của người đã đăng ký. Đây là đường chính từ 18/08/2026.
  //   2. Mã truy cập dùng chung. Giữ lại để trình duyệt nào còn nhớ mã cũ vẫn dùng
  //      được, khỏi bắt cả nhóm đăng ký lại trong cùng một ngày.
  // Ưu tiên token, vì token cho biết ĐÚNG ai đang dùng, còn mã dùng chung thì ai gõ tên
  // gì cũng được.
  const maDung = process.env.MA_TRUY_CAP || "";
  if (!maDung) { await ghi({ xong: true, loi: "chua_dat_ma" }); return new Response(""); }

  let hoSo = null;
  if (body && body.token) {
    hoSo = await kiemToken(body.token);
    if (!hoSo) { await ghi({ xong: true, loi: "token_hong" }); return new Response(""); }
  } else if (String((body && body.ma) || "") !== maDung) {
    await ghi({ xong: true, loi: "sai_ma" }); return new Response("");
  }

  // Hai việc đi chung một cửa: hỏi trợ lý, và sinh content từ một bài.
  // Đi chung cố ý, để phần chặn (mã truy cập + trần lượt) chỉ có MỘT chỗ phải canh.
  const laContent = (body && body.viec) === "content";
  const cauHoi = String((body && body.cauHoi) || "").trim().slice(0, 2000);
  if (!laContent && !cauHoi) { await ghi({ xong: true, loi: "thieu_cau_hoi" }); return new Response(""); }
  if (laContent && !(body && body.bai && body.bai.tieuDe)) {
    await ghi({ xong: true, loi: "thieu_bai" }); return new Response("");
  }

  // ---- Cổng thứ hai: trần lượt trong ngày ----
  // Người ĐÃ ĐĂNG KÝ thì đếm theo NGƯỜI. Từ lúc app mở công khai, đếm theo IP không còn
  // đủ: nhiều người chung một mạng công ty thì chặn oan nhau, còn một người đổi mạng là
  // lách được.
  if (hoSo) {
    const d = await congLuotNgay(hoSo);
    if (d.het) {
      await ghi({ xong: true, loi: "het_luot", daDung: d.daDung, tran: d.tran });
      return new Response("");
    }
  }

  // Trần theo IP giữ lại làm lớp thứ hai, cho ai chưa đăng ký mà còn dùng mã cũ.
  // Cộng lượt TRƯỚC khi gọi Claude. Cộng sau thì ai mở nhiều tab bấm cùng lúc sẽ vượt
  // trần, vì lượt nào cũng đọc được con số cũ.
  const ip = req.headers.get("x-nf-client-connection-ip") || "khong-ro";
  const khoaDem = `${ip}-${ngayHomNay()}`;
  const demStore = getStore("hoi-dem");
  let daDung = 0;
  try {
    const cu = await demStore.get(khoaDem, { type: "json" });
    daDung = (cu && Number(cu.n)) || 0;
    if (daDung >= TRAN_NGAY) {
      await ghi({ xong: true, loi: "het_luot", daDung, tran: TRAN_NGAY });
      return new Response("");
    }
    await demStore.setJSON(khoaDem, { n: daDung + 1 });
  } catch (e) {
    // Đếm hỏng thì vẫn cho chạy. Chặn người dùng thật vì lỗi kho tạm là tệ hơn.
  }

  // Ghi nhật ký cho trang Quản trị. Gom sẵn phần chung ở đây để nhánh nào cũng ghi
  // được, kể cả nhánh hỏng. Ghi SAU khi đã qua cổng mã, cố ý: người gõ sai mã không
  // phải người dùng thật, đưa vào thống kê chỉ làm nhiễu số liệu.
  const batDau = Date.now();
  const nen = {
    // Có token thì lấy tên từ HỒ SƠ đã đăng ký, không tin chuỗi trình duyệt gửi lên.
    nguoiDung: hoSo ? hoSo.ten : String((body && body.nguoiDung) || "").slice(0, 40),
    viec: laContent ? "content" : "hoi",
    dinhDang: laContent ? String(body.dinhDang || "") : "",
    phongCach: laContent ? String(body.phongCach || "") : "",
    kichCo: laContent ? String(body.kichCo || "") : "",
    baiTieuDe: laContent ? String((body.bai && (body.bai.tieuDeViet || body.bai.tieuDe)) || "") : "",
    baiUrl: laContent ? String((body.bai && body.bai.url) || "") : "",
    nhom: laContent ? String((body.bai && body.bai.nhom) || "") : "",
  };

  try {
    if (laContent) {
      const content = await taoContent({
        key, keyGemini,
        bai: body.bai,
        dinhDang: body.dinhDang,
        phongCach: body.phongCach,
        kichCo: String(body.kichCo || ""),
      });
      // Lưu TRƯỚC khi trả kết quả về trang. Nếu lưu hỏng thì luuContent trả chuỗi rỗng
      // chứ không ném lỗi, trang vẫn nhận được bài, chỉ là không có trong tab Đã tạo.
      const idLuu = await luuContent({ nguoiDung: nen.nguoiDung, bai: body.bai, content });
      await ghi({ xong: true, content, idLuu, daDung: daDung + 1, tran: TRAN_NGAY });
      await ghiSuKien({ ...nen, ok: true, ms: Date.now() - batDau });
    } else {
      // Hỏi nhanh vẫn đi Claude: nó cần công cụ tra web, thứ đang gắn với Claude.
      if (!key) { await ghi({ xong: true, loi: "chua_co_key" }); return new Response(""); }
      const traLoi = await hoiTroLy({
        key,
        cauHoi,
        kho: String((body && body.kho) || "").slice(0, 6000),
        lichSu: body && body.lichSu,
      });
      await ghi({ xong: true, traLoi, daDung: daDung + 1, tran: TRAN_NGAY });
      await ghiSuKien({ ...nen, ok: true, ms: Date.now() - batDau });
    }
  } catch (e) {
    await ghi({ xong: true, loi: e.tenLoi || "mang", chiTiet: String((e && e.message) || e) });
    await ghiSuKien({ ...nen, ok: false, loi: e.tenLoi || "mang", ms: Date.now() - batDau });
  }

  return new Response("");
};
