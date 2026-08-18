/**
 * Sinh icon PNG cho NẾP TÓC mà không cần cài thư viện nào.
 *
 * Vì sao phải làm: Chrome chỉ mời cài app khi manifest có icon PNG 192 và 512. Icon SVG
 * không đủ. Máy không có thư viện xử lý ảnh nên tự viết bộ mã hóa PNG bằng zlib có sẵn
 * của Node.
 *
 * Hình: nền nâu đồng bo góc, cái lược trắng đặc ở giữa. Đặc chứ không viền, vì viền mảnh
 * nhìn ở cỡ 48 pixel trên màn hình điện thoại là mất nét.
 *
 * Chọn cái lược chứ không phải cái kéo: kéo có hai lỗ tròn và hai lưỡi mảnh, thu về 32
 * pixel là thành một vệt xám không đọc ra hình gì. Lược chỉ gồm các khối chữ nhật nên
 * nhỏ cỡ nào cũng còn nhận ra.
 */
const fs = require("fs");
const zlib = require("zlib");

const NAU = [0x8a, 0x5a, 0x3b];
const TRANG = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(ten, du) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(du.length);
  const than = Buffer.concat([Buffer.from(ten, "ascii"), du]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(than));
  return Buffer.concat([len, than, crc]);
}

/** Ghi PNG 8 bit màu thật, không kênh trong suốt (icon nền đặc nên không cần). */
function ghiPNG(w, h, lay) {
  const hang = Buffer.alloc((w * 3 + 1) * h);
  let p = 0;
  for (let y = 0; y < h; y++) {
    hang[p++] = 0; // kiểu lọc: none
    for (let x = 0; x < w; x++) {
      const c = lay(x, y);
      hang[p++] = c[0]; hang[p++] = c[1]; hang[p++] = c[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit mỗi kênh
  ihdr[9] = 2;   // màu thật RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(hang, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Trong cái lược hay ngoài.
 *
 * Quy về hộp đơn vị: bề ngang 1, bề cao 0.86. Phần trên tới 0.22 là thanh lược đặc,
 * phần dưới là bốn cái răng. Thanh mỏng và răng dài thì mới ra cái lược; thanh dày
 * răng ngắn nhìn ra bốn cái cột. Bốn răng chứ không phải sáu: sáu răng thì khe hở chỉ còn
 * hơn một điểm ảnh ở cỡ 32, in ra thành một mảng trắng liền.
 */
const RANG = [0.055, 0.277, 0.5, 0.723, 0.945];  // tâm mỗi răng theo chiều ngang
const NUA_RANG = 0.055;                          // nửa bề ngang một cái răng

function trongLuoc(x, y, cx, cy, u) {
  const cao = 1.0 * u;
  const X = (x - (cx - u / 2)) / u;
  const Y = (y - (cy - cao / 2)) / u;
  if (X < 0 || X > 1 || Y < 0 || Y > 1) return false;
  if (Y <= 0.20) return true;                                  // thanh lược
  return RANG.some((c) => Math.abs(X - c) <= NUA_RANG);        // răng lược
}

/** Trong hình vuông bo góc hay ngoài. */
function trongBoGoc(x, y, w, h, r) {
  const dx = Math.max(r - x, 0, x - (w - r));
  const dy = Math.max(r - y, 0, y - (h - r));
  return dx * dx + dy * dy <= r * r;
}

function veIcon(canh, laMaskable) {
  // Maskable: nền phải phủ KÍN ô vuông, vì hệ điều hành tự cắt theo hình nó muốn (tròn,
  // vuông bo, giọt nước). Bo góc sẵn thì lúc nó hiện dạng vuông bo sẽ lòi bốn góc trắng.
  // Hình chính phải nằm gọn trong vòng an toàn 80% ở giữa, không thì bị cắt mất chóp.
  //
  // Lược rộng đúng bằng u, nên bản maskable lấy 0.44 là chiếm 44% cạnh, nằm thoải mái
  // trong vòng an toàn 80%. Bản thường có góc bo nên cho rộng hơn một chút.
  const u = canh * (laMaskable ? 0.44 : 0.56);
  const boGoc = laMaskable ? 0 : canh * 0.22;
  const cx = canh / 2;
  const cy = canh * (laMaskable ? 0.50 : 0.49);
  // Lấy mẫu 3x3 mỗi điểm ảnh rồi trộn, để mép không bị răng cưa.
  const MAU = 3;
  return ghiPNG(canh, canh, (x, y) => {
    let luoc = 0, nen = 0;
    for (let sy = 0; sy < MAU; sy++) {
      for (let sx = 0; sx < MAU; sx++) {
        const px = x + (sx + 0.5) / MAU, py = y + (sy + 0.5) / MAU;
        if (boGoc > 0 && !trongBoGoc(px, py, canh, canh, boGoc)) continue;
        nen++;
        if (trongLuoc(px, py, cx, cy, u)) luoc++;
      }
    }
    const tong = MAU * MAU;
    if (nen === 0) return TRANG;                    // ngoài góc bo: để trắng
    const tNen = nen / tong, tLuoc = luoc / tong;
    // Trộn: trắng nền -> nâu -> trắng lược
    const m = [];
    for (let i = 0; i < 3; i++) {
      const nenMau = TRANG[i] * (1 - tNen) + NAU[i] * tNen;
      m[i] = Math.round(nenMau * (1 - tLuoc) + TRANG[i] * tLuoc);
    }
    return m;
  });
}

const DICH = __dirname + "/";
const ds = [
  ["icon-192.png", 192, true],
  ["icon-512.png", 512, true],
  ["apple-touch-icon.png", 180, false],
  ["favicon-32.png", 32, false],
];
for (const [ten, canh, mask] of ds) {
  const buf = veIcon(canh, mask);
  fs.writeFileSync(DICH + ten, buf);
  console.log("  " + ten.padEnd(22) + canh + "x" + canh + "  " + buf.length + " byte" + (mask ? "  (maskable)" : ""));
}
console.log("Xong.");
