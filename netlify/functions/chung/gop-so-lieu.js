/**
 * NẾP TÓC — Phần TÍNH TOÁN thuần của nhật ký. Không đụng tới kho lưu trữ.
 *
 * Tách riêng khỏi nhat-ky.mjs vì hai nơi cần dùng chung mà lại khác kiểu module:
 *   - netlify/functions/chung/nhat-ky.mjs  (ESM, đọc ghi qua Netlify Blobs)
 *   - nep-toc-app/may-chu.js               (CommonJS, giữ nhật ký trong bộ nhớ)
 * Viết bằng CommonJS vì ESM import được CommonJS, chiều ngược lại thì không.
 *
 * Chép công thức ra hai chỗ thì sớm muộn con số ở máy và con số trên mạng lệch nhau,
 * mà lệch số liệu thì không ai biết bên nào đúng.
 */

/**
 * Ngày theo giờ Việt Nam.
 * Máy chủ Netlify chạy giờ UTC. Vũ Hải xem số liệu theo ngày Việt Nam, nên phải cộng
 * 7 tiếng trước khi cắt lấy phần ngày. Bỏ bước này thì mọi lượt dùng từ 0h tới 7h sáng
 * giờ Việt bị đếm sang ngày hôm trước.
 */
function ngayVN(d) {
  const t = new Date((d || new Date()).getTime() + 7 * 3600 * 1000);
  return t.toISOString().slice(0, 10);
}

/** Rút gọn để nhật ký không phình: chỉ giữ đủ để nhận ra, không giữ nội dung bài. */
function gonChu(s, n) {
  return String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);
}

/** Chuẩn hóa một sự kiện trước khi lưu. Dùng chung để hai đường ghi ra cùng một hình dạng. */
function soanSuKien(sk) {
  return {
    t: new Date().toISOString(),
    ng: gonChu(sk.nguoiDung, 40) || "(không tên)",
    v: sk.viec === "content" ? "content" : "hoi",
    dd: gonChu(sk.dinhDang, 12),
    pc: gonChu(sk.phongCach, 20),
    kc: gonChu(sk.kichCo, 8),
    b: gonChu(sk.baiTieuDe, 120),
    u: gonChu(sk.baiUrl, 220),
    g: gonChu(sk.nhom, 10),
    ok: sk.ok !== false,
    loi: gonChu(sk.loi, 30),
    ms: Number(sk.ms) || 0,
  };
}

/**
 * Gộp số liệu cho trang Quản trị.
 * Tính hết ở máy chủ rồi mới trả về, để trang quản trị chỉ việc vẽ.
 */
function gopSoLieu({ ngay, tatCa }) {
  const dem = (ds, lay) => {
    const m = {};
    ds.forEach((x) => { const k = lay(x); if (k) m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };
  const homNay = ngay[0];
  const bayNgay = new Set(ngay.slice(0, 7));
  const content = tatCa.filter((x) => x.v === "content");

  return {
    tong: tatCa.length,
    homNay: tatCa.filter((x) => x.ngay === homNay).length,
    tuan: tatCa.filter((x) => bayNgay.has(x.ngay)).length,
    soNguoi: new Set(tatCa.map((x) => x.ng)).size,
    soLoi: tatCa.filter((x) => !x.ok).length,
    // Chuỗi ngày đảo lại cho biểu đồ chạy từ cũ sang mới, đọc mới thuận mắt.
    theoNgay: ngay.slice().reverse().map((d) => ({
      ngay: d,
      content: tatCa.filter((x) => x.ngay === d && x.v === "content").length,
      hoi: tatCa.filter((x) => x.ngay === d && x.v === "hoi").length,
    })),
    theoNguoi: dem(tatCa, (x) => x.ng).map(([ten, n]) => ({
      ten, n,
      content: tatCa.filter((x) => x.ng === ten && x.v === "content").length,
      hoi: tatCa.filter((x) => x.ng === ten && x.v === "hoi").length,
      // tatCa đã sắp mới nhất trước, nên cái tìm thấy đầu tiên chính là lần gần nhất.
      lanCuoi: (tatCa.find((x) => x.ng === ten) || {}).t || "",
    })),
    theoDinhDang: dem(content, (x) => x.dd),
    theoPhongCach: dem(content, (x) => (x.dd ? x.dd + " · " + x.pc : x.pc)),
    theoNhomTin: dem(content, (x) => x.g),
    baiDungNhieu: dem(content.filter((x) => x.b), (x) => x.b).slice(0, 12),
    loiHayGap: dem(tatCa.filter((x) => !x.ok), (x) => x.loi),
  };
}

module.exports = { ngayVN, gonChu, soanSuKien, gopSoLieu };
