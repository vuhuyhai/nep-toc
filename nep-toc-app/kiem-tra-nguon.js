/**
 * NẾP TÓC — Kiểm từng nguồn trong cau-hinh.json xem còn sống không.
 * Chạy:  node kiem-tra-nguon.js          (chỉ kiểm nguồn đang "bat")
 *        node kiem-tra-nguon.js tat-ca   (kiểm cả nguồn đang "tat", để xem có hồi không)
 *
 * In ra: HTTP, số item, và TUỔI của item đầu tiên.
 *
 * LUẬT QUAN TRỌNG NHẤT: đánh giá feed bằng pubDate của ITEM ĐẦU TIÊN, KHÔNG BAO GIỜ bằng
 * lastBuildDate. Đã trả giá: có feed lastBuildDate tự nhảy sang hôm nay nhưng bài mới nhất
 * từ hai năm trước, và có feed trả HTTP 200 với XML hợp lệ nhưng nội dung là blog khác hẳn.
 * Feed nào tuổi item đầu quá 180 ngày thì coi như chết dù nó trả 200.
 */
const fs = require("fs");
const path = require("path");

const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept": "application/rss+xml, application/xml, text/xml, application/atom+xml, application/json, */*",
  "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
  "Cookie": "CONSENT=YES+1",
};

const NGUONG_CHET = 180; // ngày. Item đầu cũ hơn ngần này thì feed coi như đã chết.

function layThe(khoi, the) {
  const m = khoi.match(new RegExp("<" + the + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + the + ">", "i"));
  if (!m) return "";
  return m[1].replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "").replace(/<[^>]*>/g, " ").trim();
}

function doc(xml) {
  const ra = [];
  let m;
  const reItem = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
  while ((m = reItem.exec(xml)) !== null) {
    ra.push({ t: layThe(m[1], "title"), d: layThe(m[1], "pubDate") || layThe(m[1], "dc:date") });
  }
  if (ra.length) return ra;
  const reEntry = /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi;
  while ((m = reEntry.exec(xml)) !== null) {
    ra.push({ t: layThe(m[1], "title"), d: layThe(m[1], "published") || layThe(m[1], "updated") });
  }
  return ra;
}

const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const cauHinh = JSON.parse(fs.readFileSync(path.join(__dirname, "cau-hinh.json"), "utf8"));
  const camTatCa = process.argv[2] === "tat-ca";
  const ds = cauHinh.nguon.filter((n) => n.url && (camTatCa || n.trangThai === "bat"));

  console.log(`Kiểm ${ds.length} nguồn${camTatCa ? " (cả nguồn đang tắt)" : " đang bật"}.\n`);
  const hong = [], cu = [];

  for (const ng of ds) {
    // Reddit chặn theo tốc độ ở mức IP, không theo từng sub. Gọi liền tay là 429.
    if (ng.loai === "reddit") await nghi(22000);

    const ctrl = new AbortController();
    const hen = setTimeout(() => ctrl.abort(), 25000);
    const nhan = (ng.ten + (ng.trangThai === "tat" ? " [đang tắt]" : "")).padEnd(46);
    try {
      const res = await fetch(ng.url, { headers: UA, redirect: "follow", signal: ctrl.signal });
      if (!res.ok) { console.log(`HỎNG  ${nhan} HTTP ${res.status}`); hong.push(ng.ten); continue; }
      const text = await res.text();
      const items = doc(text);
      if (!items.length) {
        console.log(`RỖNG  ${nhan} 0 item (dài ${text.length} ký tự)`);
        hong.push(ng.ten); continue;
      }
      const d0 = items[0].d ? new Date(items[0].d) : null;
      const tuoi = d0 && !isNaN(d0) ? Math.round((Date.now() - d0.getTime()) / 86400000) : null;
      const quaCu = tuoi !== null && tuoi > NGUONG_CHET;
      if (quaCu) cu.push(`${ng.ten} (${tuoi} ngày)`);
      console.log(`${quaCu ? "CŨ   " : "OK   "} ${nhan} ${String(items.length).padStart(4)} item | `
        + `${tuoi === null ? "  ?" : String(tuoi).padStart(4)} ngày | ${items[0].t.slice(0, 52)}`);
    } catch (e) {
      console.log(`HỎNG  ${nhan} ${String(e.message).slice(0, 46)}`);
      hong.push(ng.ten);
    } finally { clearTimeout(hen); }
  }

  console.log("");
  if (hong.length) {
    console.log(`${hong.length} nguồn KHÔNG tải được:`);
    hong.forEach((t) => console.log("  · " + t));
    console.log("  Cách chữa quen thuộc: đọc vòng qua Google News với truy vấn");
    console.log('  site:ten-mien KÈM từ khóa chủ đề. Thiếu từ khóa thì nó trả trang tĩnh của site.');
  }
  if (cu.length) {
    console.log(`\n${cu.length} nguồn tải được nhưng bài mới nhất đã quá ${NGUONG_CHET} ngày:`);
    cu.forEach((t) => console.log("  · " + t));
    console.log("  Feed kiểu này nên chuyển trangThai sang 'tat' kèm lyDo.");
  }
  if (!hong.length && !cu.length) console.log("Mọi nguồn đều sống và còn cập nhật.");
})();
