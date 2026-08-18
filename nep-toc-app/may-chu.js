/**
 * NẾP TÓC — Máy chủ nhỏ để dùng app ngay trên máy, không cần deploy.
 * Chạy:  node may-chu.js       (rồi mở http://localhost:8095)
 *        node may-chu.js 9000  (đổi cổng)
 *
 * Không cần cài gì. Chỉ dùng module có sẵn của Node.
 * Phải xem qua máy chủ chứ đừng mở thẳng file index.html: mở thẳng file thì trình duyệt
 * chặn lệnh đọc du-lieu/tin-tuc.json, trang sẽ trống.
 *
 * Máy chủ này phục vụ hai việc:
 *   1. Trả file tĩnh (index.html, du-lieu/tin-tuc.json, ảnh...).
 *   2. Đóng vai hai hàm nền của Netlify cho tab Hỏi nhanh, để ở máy cũng hỏi được:
 *        POST /.netlify/functions/hoi-background   nhận câu hỏi, chạy nền, trả 202
 *        GET  /.netlify/functions/hoi-ket-qua?id=  hỏi kết quả
 *      Trên Netlify kết quả để trong Blobs; ở đây chỉ cần giữ trong bộ nhớ, vì tắt máy
 *      chủ là hết phiên. Dùng chung một bản lời nhắc với hàm nền thật.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const GOC = __dirname;
const CONG = Number(process.argv[2]) || 8095;

const KHOA = process.env.ANTHROPIC_API_KEY || "";
const KHOA_GEMINI = process.env.GEMINI_API_KEY || "";
let hoiTroLy = null;
try { ({ hoiTroLy } = require("../netlify/functions/loi-nhac-hoi.js")); }
catch (e) { /* thiếu file thì tab Hỏi nhanh tự rơi về kho câu trả lời có sẵn */ }
let taoContent = null;
try { ({ taoContent } = require("../netlify/functions/loi-nhac-content.js")); }
catch (e) { /* thiếu file thì nút Tạo content báo chưa bật, phần còn lại vẫn chạy */ }

/* Nhật ký cho trang Quản trị.
   Trên Netlify nó nằm ở Netlify Blobs; ở máy thì giữ trong bộ nhớ, tắt máy chủ là hết.
   Đủ để thử giao diện quản trị mà không phải cài thêm gì. Công thức tính dùng CHUNG một
   file với bản trên mạng, để con số ở hai nơi không lệch nhau. */
let gopSoLieu = null, soanSuKien = null, ngayVN = null;
try { ({ gopSoLieu, soanSuKien, ngayVN } = require("../netlify/functions/chung/gop-so-lieu.js")); }
catch (e) { /* thiếu file thì trang quản trị báo chưa bật */ }
const nhatKy = [];   // mới nhất ở cuối
/* Kho content đã tạo. Trên Netlify nằm ở Blobs; ở máy giữ trong bộ nhớ, tắt máy chủ là
   hết. Đủ để thử tab "Đã tạo" mà không phải cài thêm gì. */
const khoContent = [];   // mới nhất ở đầu
const khoGopY = [];      // góp ý, mới nhất ở đầu. Ở máy giữ trong bộ nhớ như mọi kho khác.
const MA_QUAN_TRI = process.env.MA_QUAN_TRI || "";

// Kết quả Hỏi nhanh đang chờ, theo id do trình duyệt sinh ra.
const khoHoi = new Map();

function docBody(req) {
  return new Promise((giai, hong) => {
    let s = "";
    req.on("data", (c) => {
      s += c;
      if (s.length > 200000) { req.destroy(); hong(new Error("body qua lon")); }
    });
    req.on("end", () => giai(s));
    req.on("error", hong);
  });
}

const traJson = (res, obj, ma = 200) => {
  res.writeHead(ma, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(obj));
};

/** Ghi một sự kiện vào nhật ký trong bộ nhớ. Không được làm hỏng việc chính. */
function ghiSuKien(sk) {
  try {
    if (!soanSuKien) return;
    const x = soanSuKien(sk);
    nhatKy.push({ ...x, ngay: ngayVN() });
    if (nhatKy.length > 5000) nhatKy.splice(0, nhatKy.length - 5000);
  } catch (e) { /* im lặng */ }
}

/** Đóng vai hàm thong-ke của Netlify, đọc từ nhật ký trong bộ nhớ. */
async function xuLyThongKe(req, res) {
  let body = {};
  try { body = JSON.parse(await docBody(req) || "{}"); } catch (e) { return traJson(res, { loi: "body_hong" }, 400); }
  if (!gopSoLieu) return traJson(res, { loi: "doc_hong", chiTiet: "thiếu gop-so-lieu.js" });
  if (!MA_QUAN_TRI) return traJson(res, { loi: "chua_dat_ma_quan_tri" });
  if (String(body.ma || "") !== MA_QUAN_TRI) return traJson(res, { loi: "sai_ma" });

  const soNgay = Math.min(Math.max(Number(body.soNgay) || 30, 1), 90);
  const ngay = [];
  for (let i = 0; i < soNgay; i++) ngay.push(ngayVN(new Date(Date.now() - i * 86400000)));
  const trong = new Set(ngay);
  const tatCa = nhatKy.filter((x) => trong.has(x.ngay)).slice().reverse();

  return traJson(res, {
    ok: true, soNgay, soNgayGiu: 90, daDon: 0,
    soLieu: gopSoLieu({ ngay, tatCa }),
    lichSu: tatCa.slice(0, 300),
    tongSuKien: tatCa.length,
  });
}

/** Đóng vai hàm content-da-tao của Netlify, đọc từ kho trong bộ nhớ. */
async function xuLyDaTao(req, res) {
  let body = {};
  try { body = JSON.parse(await docBody(req) || "{}"); } catch (e) { return traJson(res, { loi: "body_hong" }, 400); }
  // Ở máy không đòi mã, giống mọi đường chạy tại chỗ khác.
  if (body.viec === "xoa") {
    const i = khoContent.findIndex((x) => x.ngay === body.ngay && x.id === body.id);
    if (i >= 0) khoContent.splice(i, 1);
    return traJson(res, { ok: i >= 0 });
  }
  return traJson(res, { ok: true, soNgay: 60, soNgayGiu: 180, tong: khoContent.length, ds: khoContent.slice(0, 200) });
}

async function xuLyHoiNhanh(req, res, duong, truyVan) {
  if (duong.endsWith("/thong-ke")) return xuLyThongKe(req, res);
  if (duong.endsWith("/content-da-tao")) return xuLyDaTao(req, res);
  // Chạy tại máy thì không cần đăng ký, nhưng vẫn phải trả lời hàm này để trang không
  // báo lỗi mạng khi nó tự kiểm danh tính lúc mở.
  if (duong.endsWith("/gop-y")) {
    let b = {};
    try { b = JSON.parse(await docBody(req) || "{}"); } catch (e) {}
    if (b.viec === "doc") return traJson(res, { ok: true, tong: khoGopY.length, ds: khoGopY.slice(0, 300) });
    if (b.viec === "xoa") {
      const i = khoGopY.findIndex((x) => x.khoa === b.khoa);
      if (i >= 0) khoGopY.splice(i, 1);
      return traJson(res, { ok: i >= 0 });
    }
    const nd = String(b.noiDung || "").trim();
    if (nd.length < 5) return traJson(res, { loi: "qua_ngan" });
    const ngay = ngayVN ? ngayVN() : new Date().toISOString().slice(0, 10);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    khoGopY.unshift({
      khoa: ngay + "/" + id, id, t: new Date().toISOString(), ngay,
      loai: String(b.loai || "khac"), noiDung: nd,
      ten: String(b.ten || "").slice(0, 60), lienHe: String(b.lienHe || "").slice(0, 60),
      daDangKy: !!b.token, boiCanh: String(b.boiCanh || "").slice(0, 80),
      manHinh: String(b.manHinh || "").slice(0, 20),
    });
    console.log("  [Góp ý] " + nd.slice(0, 70).replace(/s+/g, " "));
    return traJson(res, { ok: true });
  }
  if (duong.endsWith("/dang-ky")) {
    let b = {};
    try { b = JSON.parse(await docBody(req) || "{}"); } catch (e) {}
    if (b.viec === "kiem") return traJson(res, { ok: true, ten: "", coSo: "" });
    return traJson(res, { ok: true, token: "tai-may", ten: String(b.ten || "").slice(0, 60), coSo: String(b.coSo || "").slice(0, 60) });
  }
  if (duong.endsWith("/hoi-ket-qua")) {
    const id = String(truyVan.get("id") || "");
    if (!id) return traJson(res, { loi: "thieu_id" }, 400);
    const val = khoHoi.get(id);
    if (!val) return traJson(res, { xong: false });
    khoHoi.delete(id); // lấy xong thì xóa, giống hàm thật
    return traJson(res, val);
  }

  // hoi-background: trả 202 ngay rồi chạy tiếp phía sau, đúng như Netlify.
  let body = {};
  try { body = JSON.parse(await docBody(req) || "{}"); } catch (e) { return traJson(res, {}, 400); }
  const id = String(body.id || "").slice(0, 80);
  if (!id) return traJson(res, { loi: "thieu_id" }, 400);

  res.writeHead(202, { "content-type": "application/json; charset=utf-8" });
  res.end("{}");

  if (!KHOA && !KHOA_GEMINI) { khoHoi.set(id, { xong: true, loi: "chua_co_key" }); return; }

  // Hai việc đi chung một cửa, y như hàm nền trên Netlify: hỏi trợ lý và sinh content.
  const laContent = body.viec === "content";

  // Phần chung để nhánh nào cũng ghi nhật ký được, kể cả nhánh hỏng.
  const batDau = Date.now();
  const nen = {
    nguoiDung: String(body.nguoiDung || "").slice(0, 40),
    viec: laContent ? "content" : "hoi",
    dinhDang: laContent ? String(body.dinhDang || "") : "",
    phongCach: laContent ? String(body.phongCach || "") : "",
    kichCo: laContent ? String(body.kichCo || "") : "",
    baiTieuDe: laContent ? String((body.bai && (body.bai.tieuDeViet || body.bai.tieuDe)) || "") : "",
    baiUrl: laContent ? String((body.bai && body.bai.url) || "") : "",
    nhom: laContent ? String((body.bai && body.bai.nhom) || "") : "",
  };

  if (laContent) {
    if (!taoContent) { khoHoi.set(id, { xong: true, loi: "chua_co_key" }); return; }
    if (!(body.bai && body.bai.tieuDe)) { khoHoi.set(id, { xong: true, loi: "thieu_bai" }); return; }
    const nhan = (body.dinhDang === "tiktok" ? "TikTok" : "Facebook") + "/" + (body.phongCach || "");
    console.log("  [Tạo content] " + nhan + ": " + String(body.bai.tieuDe).slice(0, 60));
    try {
      const content = await taoContent({
        key: KHOA, keyGemini: KHOA_GEMINI, bai: body.bai,
        dinhDang: body.dinhDang, phongCach: body.phongCach, kichCo: String(body.kichCo || ""),
      });
      const idLuu = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      khoContent.unshift({
        id: idLuu, ngay: ngayVN ? ngayVN() : new Date().toISOString().slice(0, 10),
        t: new Date().toISOString(), ng: nen.nguoiDung || "(không tên)",
        bai: { tieuDe: nen.baiTieuDe, url: nen.baiUrl, nguon: (body.bai && body.bai.nguon) || "", nhom: nen.nhom },
        content,
      });
      if (khoContent.length > 500) khoContent.length = 500;
      khoHoi.set(id, { xong: true, content, idLuu });
      ghiSuKien({ ...nen, ok: true, ms: Date.now() - batDau });
      console.log("  [Tạo content] xong.");
    } catch (e) {
      khoHoi.set(id, { xong: true, loi: e.tenLoi || "mang", chiTiet: String((e && e.message) || e) });
      ghiSuKien({ ...nen, ok: false, loi: e.tenLoi || "mang", ms: Date.now() - batDau });
      console.log("  [Tạo content] lỗi: " + String((e && e.message) || e));
    }
    return;
  }

  // Hỏi nhanh vẫn cần Claude vì nó tra web.
  if (!hoiTroLy || !KHOA) { khoHoi.set(id, { xong: true, loi: "chua_co_key" }); return; }
  const cauHoi = String(body.cauHoi || "").trim().slice(0, 2000);
  if (!cauHoi) { khoHoi.set(id, { xong: true, loi: "thieu_cau_hoi" }); return; }

  console.log("  [Hỏi nhanh] đang tra web: " + cauHoi.slice(0, 70).replace(/\s+/g, " "));
  try {
    const traLoi = await hoiTroLy({
      key: KHOA, cauHoi,
      kho: String(body.kho || "").slice(0, 6000),
      lichSu: body.lichSu,
    });
    khoHoi.set(id, { xong: true, traLoi });
    ghiSuKien({ ...nen, ok: true, ms: Date.now() - batDau });
    console.log("  [Hỏi nhanh] xong.");
  } catch (e) {
    khoHoi.set(id, { xong: true, loi: e.tenLoi || "mang", chiTiet: String((e && e.message) || e) });
    ghiSuKien({ ...nen, ok: false, loi: e.tenLoi || "mang", ms: Date.now() - batDau });
    console.log("  [Hỏi nhanh] lỗi: " + String((e && e.message) || e));
  }
}

const KIEU = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

const may = http.createServer((req, res) => {
  const dayDu = new URL(String(req.url), "http://localhost");
  let duong = decodeURIComponent(dayDu.pathname);

  if (duong.startsWith("/.netlify/functions/")) {
    xuLyHoiNhanh(req, res, duong, dayDu.searchParams)
      .catch((e) => { try { traJson(res, { loi: "mang", chiTiet: String(e.message) }, 500); } catch (x) {} });
    return;
  }

  if (duong === "/") duong = "/index.html";
  const tep = path.join(GOC, duong);

  // Chặn đi ngược ra ngoài thư mục app.
  if (!tep.startsWith(GOC)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    return res.end("Không được phép");
  }

  fs.readFile(tep, (loi, du) => {
    if (loi) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      return res.end("Không thấy: " + duong);
    }
    res.writeHead(200, {
      "content-type": KIEU[path.extname(tep).toLowerCase()] || "application/octet-stream",
      // Không cho nhớ tạm, để quét tin xong bấm tải lại là thấy bài mới ngay.
      "cache-control": "no-store",
    });
    res.end(du);
  });
});

may.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`Cổng ${CONG} đang bận. Có thể app đã chạy sẵn ở http://localhost:${CONG}`);
    console.error(`Muốn dùng cổng khác:  node may-chu.js 9000`);
  } else {
    console.error("Lỗi máy chủ:", e.message);
  }
  process.exit(1);
});

may.listen(CONG, () => {
  console.log("");
  console.log("  NẾP TÓC đang chạy tại:  http://localhost:" + CONG);
  console.log("  Tạo content: " + (KHOA_GEMINI ? "Gemini" + (KHOA ? " (lùi về Claude nếu hỏng)" : "") : KHOA ? "Claude" : "tắt, chưa có khóa nào"));
  console.log("  Hỏi nhanh: " + (KHOA && hoiTroLy
    ? "bật, có tra web"
    : "tắt (chưa đặt ANTHROPIC_API_KEY), sẽ trả lời tạm từ kho có sẵn"));
  console.log("  Bấm Ctrl + C để dừng.");
  console.log("");
});
