/**
 * NẾP TÓC — Bộ thu thập tin ngành Tóc cho chủ salon
 * Chạy một lần:  node thu-thap.js
 *
 * Không cần cài thư viện. Chỉ cần Node.js 18 trở lên (có fetch sẵn).
 * Đọc cấu hình từ cau-hinh.json, quét RSS/Atom (báo nghề, tạp chí da liễu, Google News,
 * tạp chí làm đẹp, báo Việt, Reddit), lọc theo từ khóa, chặn quảng cáo thần dược và nội
 * dung hại tâm lý, khử trùng lặp, chấm mức quan trọng, chia về 4 nhóm
 * (nghe / khoahoc / xuhuong / vn), ghi ra du-lieu/tin-tuc.json và chèn SSR vào index.html.
 *
 * Nguồn phần lớn tiếng Anh. Phần dịch và Gợi ý content do hàm phan-tich đảm nhiệm.
 *
 * KHÁC ba app tin trước: app này KHÔNG có tầng trả phí, nên chỉ có MỘT file dữ liệu công
 * khai. Không cần tách bản mở và bản đầy đủ.
 */

const fs = require("fs");
const path = require("path");

const THU_MUC = __dirname;
const DU_LIEU = path.join(THU_MUC, "du-lieu");
const LICH_SU = path.join(DU_LIEU, "lich-su");
const FILE_TIN = path.join(DU_LIEU, "tin-tuc.json");
const FILE_LOG = path.join(DU_LIEU, "nhat-ky.txt");

/* ---------- Dịch + Gợi ý content ----------
 * Hai đường đi, tự chọn:
 *
 * 1. CHẠY Ở MÁY, có sẵn ANTHROPIC_API_KEY trong biến môi trường: gọi thẳng Anthropic.
 *    Nhờ vậy dùng được ngay tại chỗ, không phải chờ deploy site lên Netlify.
 * 2. CHẠY TRÊN GITHUB ACTIONS: ở đó cố ý KHÔNG có khóa (khóa chỉ nằm ở Netlify),
 *    nên đi đường gọi hàm nền phan-tich đã deploy.
 *
 * Lời nhắc dùng chung một bản ở netlify/functions/loi-nhac-phan-tich.js, để giọng văn
 * của hai đường không lệch nhau.
 */
const URL_PHANTICH = process.env.URL_PHANTICH ||
  "https://nep-toc.netlify.app/.netlify/functions/phan-tich";
const MAX_PHANTICH = Number(process.env.MAX_PHANTICH) || 60; // trần số tin phân tích mỗi lần chạy
const WA_VER = 1;        // phiên bản gợi ý. Tăng số này là bắt dịch lại TOÀN BỘ kho.

const KHOA_MAY = process.env.ANTHROPIC_API_KEY || "";
let phanTichBai = null;
try { ({ phanTichBai } = require("../netlify/functions/loi-nhac-phan-tich.js")); }
catch (e) { /* thiếu file thì rơi về đường gọi hàm nền */ }

const dungKhoaMay = () => Boolean(KHOA_MAY && phanTichBai);

// Lỗi khóa thì thử lại bao nhiêu lần cũng vô ích, phải dừng ngay và nói đúng bệnh.
// Còn lại (mạng chập, quá tải nhất thời) thì thử lại vài lần là qua.
function laLoiKhoa(e) {
  const s = String((e && e.message) || e).toLowerCase();
  return /api key|authentication|unauthorized|401|invalid x-api-key|credit balance|quota/.test(s);
}

async function goiPhanTich(item, thuTu, soLanThu = 3) {
  let doi = 4000;
  for (let lan = 1; ; lan++) {
    try {
      return await goiPhanTichMotLan(item, thuTu);
    } catch (e) {
      if (laLoiKhoa(e) || lan >= soLanThu) throw e;
      await nghi(doi);
      doi *= 3;
    }
  }
}

async function goiPhanTichMotLan(item, thuTu) {
  // Phải có hạn giờ. Khi site chưa deploy hoặc hàm nền treo, fetch không tự bỏ cuộc,
  // cả lượt chạy sẽ đứng im hàng chục phút mà không báo gì.
  const ctrl = new AbortController();
  const hen = setTimeout(() => ctrl.abort(), 45000);
  try {
    if (dungKhoaMay()) {
      return await phanTichBai({
        key: KHOA_MAY, tieuDe: item.t, tomTat: item.s, nhom: item.g, thuTu, signal: ctrl.signal,
      });
    }
    const res = await fetch(URL_PHANTICH, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        // Hàm phan-tich là cửa gọi API tốn tiền nên nó đòi khóa nội bộ. Khóa này phải
        // đặt ở CẢ HAI nơi: env Netlify và GitHub Secrets. Thiếu ở GitHub thì bộ quét
        // 7h sáng vẫn chạy nhưng không viết được gợi ý content nào.
        "x-khoa-noi-bo": process.env.KHOA_NOI_BO || "",
      },
      body: JSON.stringify({ tieuDe: item.t, tomTat: item.s, nhom: item.g, thuTu }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const d = await res.json();
    if (!d || !d.tomTat || !d.hook || !d.gocViet || !d.tieuDeViet) {
      throw new Error(d && d.loi ? d.loi : "thiếu dữ liệu");
    }
    return d;
  } finally {
    clearTimeout(hen);
  }
}

const CU_MOI = 25; // cứ ngần này bài dịch xong thì ghi tạm ra file một lần

async function boSungYKien(list, luuTam) {
  let n = 0, hongLienTiep = 0, loiCuoi = "", loiKhoa = false;
  const canDich = list.filter(x => x.wa !== WA_VER && !x.khongPT).length;
  if (!canDich) { ghiLog("Mọi bài đã có gợi ý content, bỏ qua bước gọi AI."); return; }
  ghiLog(dungKhoaMay()
    ? `Viết gợi ý bằng khóa ở máy (ANTHROPIC_API_KEY). Còn ${canDich} bài chưa có, lần này làm tối đa ${MAX_PHANTICH}.`
    : `Viết gợi ý qua hàm nền ${URL_PHANTICH}. Còn ${canDich} bài chưa có, lần này làm tối đa ${MAX_PHANTICH}.`);
  for (const it of list) {
    if (it.wa === WA_VER) continue;
    if (it.khongPT) continue;
    if (n >= MAX_PHANTICH) break;
    // Mỗi bài đã tự thử lại 3 lần rồi mới tính là hỏng. Hỏng liên tiếp 8 bài nghĩa là
    // hỏng thật chứ không phải mạng chập, khi đó dừng thay vì gọi tiếp hàng trăm lần.
    if (hongLienTiep >= 8) {
      ghiLog(`Dừng bước viết gợi ý: 8 bài liên tiếp không xong. Lỗi cuối: ${loiCuoi}`);
      ghiLog(loiKhoa
        ? "  Đây là lỗi khóa API. Kiểm tra ANTHROPIC_API_KEY và số dư ở console.anthropic.com."
        : dungKhoaMay()
          ? "  Nhiều khả năng do mạng. Chạy lại sau, những bài đã xong vẫn được giữ nguyên."
          : "  Chưa đặt ANTHROPIC_API_KEY ở máy, mà hàm nền trên Netlify cũng chưa trả lời. Xem HUONG-DAN.md mục 5.");
      break;
    }
    try {
      // Truyền số thứ tự để lời nhắc luân phiên kiểu mở đầu câu hook.
      const r = await goiPhanTich(it, n);
      // Nguồn vốn đã là tiếng Việt thì GIỮ NGUYÊN tiêu đề gốc, không cho AI đụng vào.
      // Bảo nó "chép y nguyên" vẫn bị diễn đạt lại, nghe xuôi hơn nhưng đã sai sự việc.
      // Chặn bằng mã thì chắc chắn.
      it.tv = (it.hang === "Việt Nam") ? it.t : r.tieuDeViet;
      it.w = r.tomTat;
      it.hook = r.hook;
      it.goc = r.gocViet;
      it.lu = r.luuY || "";
      it.wa = WA_VER;
      n++;
      hongLienTiep = 0;
      // Ghi tạm sau mỗi CU_MOI bài. Chạy cả kho mất gần nửa tiếng; nếu chỉ ghi lúc xong
      // thì mất mạng ở bài thứ 250 là mất trắng công của 249 bài trước.
      if (luuTam && n % CU_MOI === 0) {
        try { luuTam(); ghiLog(`  đã xong ${n}/${Math.min(canDich, MAX_PHANTICH)} bài, ghi tạm.`); }
        catch (e2) { ghiLog("  ghi tạm hỏng (bỏ qua): " + e2.message); }
      }
    } catch (e) {
      // giữ .w cũ, chưa đặt .wa để lần chạy sau thử lại
      hongLienTiep++;
      loiCuoi = String((e && e.message) || e);
      if (laLoiKhoa(e)) {
        loiKhoa = true;
        ghiLog(`Dừng bước viết gợi ý: lỗi khóa API (${loiCuoi}).`);
        ghiLog("  Kiểm tra ANTHROPIC_API_KEY và số dư ở console.anthropic.com.");
        break;
      }
    }
  }
  if (n) ghiLog(`Đã viết tóm tắt + gợi ý content cho ${n} tin.`);
}

/* ---------- SSR: chèn tin dạng HTML tĩnh vào index.html cho SEO ---------- */
const IMP_LABEL = { cao: "Nên dùng", vua: "Đáng chú ý", thap: "Tham khảo" };
const FILE_HTML = path.join(THU_MUC, "index.html");
const SSR_SO_TIN = 30; // số tin render tĩnh, đủ cho SEO và nhẹ trang

function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function ngayVN(d) {
  const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : escHtml(d);
}
function ssrTin(list) {
  return list.slice(0, SSR_SO_TIN).map(n => {
    const u = escHtml(n.u);
    const tieuDe = n.tv || n.t;
    // Tiêu đề gốc để dòng nhỏ bên dưới, chỉ khi bản dịch khác bản gốc (tin tiếng Việt
    // thì hai cái trùng nhau, in ra hai lần trông thừa).
    const goc = (n.tv && n.tv !== n.t) ? `<p class="tg">${escHtml(n.t)}</p>` : "";
    const s = (!n.w && n.s) ? `<p>${escHtml(n.s)}</p>` : "";
    const hook = n.hook ? `<div class="why"><b>Câu mở bài gợi ý</b><p>${escHtml(n.hook)}</p></div>` : "";
    return `<article class="news"><div class="news__meta"><span class="d">${ngayVN(n.d)}</span><span>${escHtml(n.src)}</span><span class="dot dot--${escHtml(n.imp)}">${escHtml(IMP_LABEL[n.imp] || "")}</span></div>`
      + `<h3><a href="${u}" target="_blank" rel="noopener">${escHtml(tieuDe)}</a></h3>`
      + goc + s
      + `<div class="why"><b>Tóm tắt tiếng Việt</b><p>${escHtml(n.w)}</p></div>`
      + hook
      + `<a class="go" href="${u}" target="_blank" rel="noopener">Đọc bản gốc</a></article>`;
  }).join("\n");
}
// Chèn giữa hai mốc. Không có mốc thì bỏ qua an toàn, không đụng file.
function chenSSR(list) {
  try {
    if (!fs.existsSync(FILE_HTML)) return;
    let html = fs.readFileSync(FILE_HTML, "utf8");
    const re = /(<!--TIN-SSR-START-->)[\s\S]*?(<!--TIN-SSR-END-->)/;
    if (!re.test(html)) { ghiLog("SSR: không thấy mốc trong index.html, bỏ qua."); return; }
    const noiDung = ssrTin(list); // dùng hàm thay thế để '$' trong tin không bị hiểu đặc biệt
    html = html.replace(re, (m, a, b) => a + "\n" + noiDung + "\n" + b);
    fs.writeFileSync(FILE_HTML, html, "utf8");
    ghiLog(`SSR: đã chèn ${Math.min(list.length, SSR_SO_TIN)} tin tĩnh vào index.html.`);
  } catch (e) { ghiLog("SSR lỗi (bỏ qua): " + e.message); }
}

/* ---------- tiện ích ---------- */

function ghiLog(dong) {
  const t = new Date().toISOString().replace("T", " ").slice(0, 19);
  const s = `[${t}] ${dong}`;
  console.log(s);
  try {
    fs.mkdirSync(DU_LIEU, { recursive: true });
    fs.appendFileSync(FILE_LOG, s + "\n");
  } catch (e) { /* không chặn luồng chính vì lỗi ghi log */ }
}

function boDau(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase();
}

const soVeKyTu = (raw, he) => {
  try { return String.fromCodePoint(parseInt(raw, he)); } catch (e) { return " "; }
};

/**
 * Giải mã thực thể HTML.
 * Tin tiếng Anh rất hay dính &#8217; &#8230; và cả &amp;#39; nên phải giải mã số, rồi
 * mới đổi &amp; thành &, rồi giải mã số lần nữa. Bỏ lượt nào cũng để lọt rác ra trang.
 * Thanh Niên trả tiêu đề dính &uacute; &ograve; nên lượt này bắt buộc.
 */
function giaiMaThucThe(s) {
  return String(s)
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&(?:rsquo|lsquo|apos);/gi, "'")
    .replace(/&(?:rdquo|ldquo);/gi, '"')
    .replace(/&(?:mdash|ndash);/gi, "-")
    .replace(/&hellip;/gi, "…")
    .replace(/&aacute;/gi, "á").replace(/&agrave;/gi, "à").replace(/&atilde;/gi, "ã")
    .replace(/&eacute;/gi, "é").replace(/&egrave;/gi, "è")
    .replace(/&iacute;/gi, "í").replace(/&igrave;/gi, "ì")
    .replace(/&oacute;/gi, "ó").replace(/&ograve;/gi, "ò").replace(/&otilde;/gi, "õ")
    .replace(/&uacute;/gi, "ú").replace(/&ugrave;/gi, "ù").replace(/&utilde;/gi, "ũ")
    .replace(/&yacute;/gi, "ý")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => soVeKyTu(h, 16))
    .replace(/&#(\d+);/g, (_, n) => soVeKyTu(n, 10))
    .replace(/&amp;/gi, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => soVeKyTu(h, 16))
    .replace(/&#(\d+);/g, (_, n) => soVeKyTu(n, 10));
}

/**
 * Gỡ thẻ HTML và giải mã thực thể.
 *
 * Chạy HAI LƯỢT gỡ thẻ rồi giải mã. Lý do: nội dung bài Reddit là HTML đã bị mã hóa
 * thành thực thể (&lt;div class="md"&gt;...). Làm một lượt thì lượt gỡ thẻ chạy trước
 * lúc giải mã, không thấy thẻ nào, giải mã xong lại lòi nguyên khối HTML ra thẳng trang.
 */
function goHtml(s) {
  let t = String(s);
  for (let i = 0; i < 2; i++) {
    t = t
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]*>/g, " ");
    t = giaiMaThucThe(t);
  }
  return t.replace(/\s+/g, " ").trim();
}

function layThe(khoi, the) {
  const re = new RegExp("<" + the + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + the + ">", "i");
  const m = khoi.match(re);
  if (!m) return "";
  return m[1].replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "").trim();
}

/**
 * Chuẩn hóa ngày.
 * Một số CMS trả offset 2 chữ số ("+07") mà Date của JS không hiểu,
 * phải đổi thành "+0700" trước khi parse.
 */
function chuanNgay(raw) {
  if (!raw) return null;
  let s = String(raw).trim().replace(/([+-]\d{2})$/, "$1" + "00");
  let d = new Date(s);
  if (isNaN(d.getTime())) d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d;
}

function ngayISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const n = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${n}`;
}

/* ---------- đọc RSS và Atom ---------- */

function docFeed(xml) {
  const ra = [];

  // RSS 2.0
  const reItem = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = reItem.exec(xml)) !== null) {
    const b = m[1];
    ra.push({
      tieuDe: goHtml(layThe(b, "title")),
      lien: goHtml(layThe(b, "link") || layThe(b, "guid")),
      ngay: layThe(b, "pubDate") || layThe(b, "dc:date") || layThe(b, "date"),
      tom: goHtml(layThe(b, "description") || layThe(b, "summary") || layThe(b, "content:encoded")),
      nguonGoc: goHtml(layThe(b, "source")) // Google News gắn tên báo gốc ở thẻ <source>
    });
  }
  if (ra.length) return ra;

  // Atom (Nature, The Conversation, một số blog)
  const reEntry = /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi;
  while ((m = reEntry.exec(xml)) !== null) {
    const b = m[1];
    let lien = layThe(b, "id");
    const href = b.match(/<link[^>]*href=["']([^"']+)["']/i);
    if (href) lien = href[1];
    ra.push({
      tieuDe: goHtml(layThe(b, "title")),
      lien: goHtml(lien),
      ngay: layThe(b, "published") || layThe(b, "updated"),
      tom: goHtml(layThe(b, "summary") || layThe(b, "content")),
      nguonGoc: ""
    });
  }
  return ra;
}

/* ---------- đọc Reddit (Atom) ----------
 * Reddit CÓ RSS thật: /r/<sub>/top/.rss?t=week — không cần khóa, không cần cầu nối.
 * Nhược điểm: feed KHÔNG kèm số upvote. Bù lại, bản thân đường dẫn /top/?t=week đã là
 * bộ lọc upvote: Reddit xếp bài nhiều upvote nhất tuần lên trước. Vì vậy ta ghi lại
 * THỨ HẠNG trong feed (rank) và dùng nó thay cho điểm số.
 */
function docReddit(xml, tenSub) {
  const ra = [];
  const reEntry = /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi;
  let m, i = 0;
  while ((m = reEntry.exec(xml)) !== null) {
    const b = m[1];
    let lien = "";
    const href = b.match(/<link[^>]*href=["']([^"']+)["']/i);
    if (href) lien = href[1];
    if (!lien) lien = goHtml(layThe(b, "id"));
    ra.push({
      tieuDe: goHtml(layThe(b, "title")),
      lien,
      ngay: layThe(b, "updated") || layThe(b, "published"),
      tom: goHtml(layThe(b, "content")),
      nguonGoc: tenSub || "",
      rank: ++i,
    });
  }
  return ra;
}

/** Thay ${TEN_BIEN} trong URL bằng biến môi trường, để token bí mật nằm ngoài file cấu hình. */
function thayEnv(url) {
  return String(url).replace(/\$\{(\w+)\}/g, (m, k) => process.env[k] || "");
}

const nghi = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Tải một nguồn, có thử lại khi bị chặn tốc độ.
 *
 * Reddit chặn rất gắt: gọi liên tiếp vài lần là trả 429 hoặc 500 ngay, dù mỗi lần đều
 * hợp lệ. Đã đo thật: 10 request liên tiếp thì cái đầu 200, còn lại 429. Vì vậy gặp
 * 429/500/503 thì nghỉ rồi thử lại, mỗi lần nghỉ dài gấp đôi lần trước.
 * Không thử lại với 403 và 404 vì thử lại cũng vô ích.
 */
async function tai(url, soLanThu = 3, doiDauMs = 15000) {
  let doiMs = doiDauMs;
  for (let lan = 1; ; lan++) {
    const ctrl = new AbortController();
    const hen = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: {
          // Nhiều trang từ chối yêu cầu không có User-Agent. Reddit chặn khá gắt,
          // phải khai User-Agent giống trình duyệt thật.
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Accept": "application/rss+xml, application/xml, text/xml, application/atom+xml, application/json, */*",
          "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
          // Google News đôi khi trả trang xin đồng ý cookie nếu thiếu cái này
          "Cookie": "CONSENT=YES+1"
        }
      });
      if ((res.status === 429 || res.status === 500 || res.status === 503) && lan < soLanThu) {
        clearTimeout(hen);
        ghiLog(`    bị chặn tốc độ (${res.status}), nghỉ ${Math.round(doiMs / 1000)}s rồi thử lại`);
        await nghi(doiMs);
        doiMs *= 2;
        continue;
      }
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      if (!text || text.length < 80) throw new Error("nội dung rỗng");
      return text;
    } finally {
      clearTimeout(hen);
    }
  }
}

/* ---------- lọc và chấm điểm ---------- */

/**
 * So khớp có ranh giới từ.
 * Chỉ dùng includes() thì "bmi" khớp vào giữa từ khác, "cân" bắt nhầm "cân bằng".
 * Ở đây yêu cầu hai đầu từ khóa phải là ký tự không phải chữ hoặc số.
 *
 * TỪ KHÓA CÓ DẤU THÌ KHỚP TRÊN CHUỖI CÒN DẤU. Đây là chỗ đã trả giá đắt nhất trong
 * lần quét đầu: bỏ dấu xong "hói" thành "hoi", khớp luôn "hơi", "hội", "hỏi", "hồi".
 * Một mình từ đó kéo 65 bài rác vào kho, trong đó có tin hình sự và tin du lịch, vì
 * "Hội tụ vẻ đẹp..." và "bốc hơi" đều thành "hoi". Cùng lỗi đó: "da đầu" (scalp) và
 * "da dầu" (oily skin) bỏ dấu ra cùng một chuỗi.
 *
 * Từ khóa toàn chữ ASCII (tiếng Anh) vẫn khớp trên chuỗi đã bỏ dấu, để bài tiếng Việt
 * viết chen tiếng Anh vẫn bắt được.
 */
const CO_DAU = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/;

function coTuKhoa(chuoi, tuKhoa) {
  const k = tuKhoa.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Ranh giới từ phải chấp nhận cả chữ có dấu, nếu không "tóc" sẽ khớp vào giữa "tóc-đỏ".
  return new RegExp("(^|[^a-z0-9à-ỹ])" + k + "($|[^a-z0-9à-ỹ])").test(chuoi);
}

function demTuKhoa(vanBan, danhSach) {
  const raw = String(vanBan || "").toLowerCase();
  const v = boDau(vanBan);
  const trung = [];
  for (const tk of danhSach) {
    const t = tk.toLowerCase();
    const khop = CO_DAU.test(t) ? coTuKhoa(raw, t) : coTuKhoa(v, boDau(t));
    if (khop) trung.push(tk);
  }
  return { soLan: trung.length, trung };
}

/**
 * Chấm mức quan trọng.
 * "cao" đòi hỏi tín hiệu bằng chứng MẠNH (nghiên cứu, thử nghiệm, số liệu) đi cùng ít
 * nhất một từ khóa ngành. Nhân sự nhìn nhãn "Nên dùng" là biết bài này có gì để trích dẫn.
 */
function chamMuc(nganh, chuDe, manh) {
  if (manh >= 1 && nganh >= 1) return "cao";
  if (nganh >= 2 && chuDe >= 1) return "vua";
  if (manh >= 1 || (nganh >= 1 && chuDe >= 1)) return "vua";
  return "thap";
}

/* ---------- CHỐT GIỮ LẠI ----------
 * Bài có bằng chứng thật thì GIỮ, dù có dính vài mẫu bị loại ở dưới.
 * Bằng chứng thật = số liệu, hoặc ngôn ngữ nghiên cứu, hoặc kể một quá trình có thật.
 * Thà giữ nhầm một bài hay còn hơn lọc mất nó.
 *
 * CHÚ Ý: hàm này KHÔNG cứu được bài quảng cáo thần dược. Bên dưới, laQuangCaoThanDuoc
 * chạy TRƯỚC chốt này, cố ý, vì bài quảng cáo mọc tóc luôn khoe số liệu ấn tượng nhất.
 */
function chotGiuLai(text) {
  const raw = String(text || "");
  const v = boDau(raw);

  // Số liệu nghiên cứu: phần trăm, cỡ mẫu, thời gian theo dõi.
  if (/\d+(\.\d+)?\s?%/.test(raw)) return true;
  if (/\b\d[\d,.]*\s?(participants|adults|women|patients|subjects|nguoi tham gia|benh nhan|phu nu)\b/.test(v)) return true;

  // Ngôn ngữ nghiên cứu và bằng chứng.
  const nghienCuu = [
    "randomized", "randomised", "clinical trial", "meta-analysis", "meta analysis",
    "systematic review", "cohort study", "longitudinal", "placebo", "double-blind",
    "study found", "study finds", "new study", "researchers found", "research shows",
    "published in", "peer-reviewed", "according to the study",
    "nghien cuu cho thay", "nghien cuu moi", "cong bo tren", "thu nghiem lam sang",
    "phan tich tong hop", "theo nghien cuu"
  ];
  for (const k of nghienCuu) if (v.includes(k)) return true;

  // Theo dõi có mốc thời gian thật.
  if (/(after|over|during)\s+\d+\s+(month|months|year|years|weeks)/.test(v)) return true;
  if (/(sau|trong)\s+\d+\s+(thang|nam|tuan)/.test(v)) return true;

  return false;
}

/* ---------- nhận diện QUẢNG CÁO THẦN DƯỢC ----------
 * Bộ lọc QUAN TRỌNG NHẤT của app.
 *
 * Ngành tóc ngập bài quảng cáo trá hình: thuốc mọc tóc gia truyền, tinh dầu bưởi cam
 * kết hết hói, liệu trình phục hồi tóc hư tổn 100%, viên uống chống rụng. Chúng lọt qua
 * mọi bộ lọc từ khóa vì chúng dùng ĐÚNG những từ khóa ngành mình đang tìm, và chúng khoe
 * số liệu ấn tượng nhất nên chotGiuLai cũng cứu nhầm. Vì vậy hàm này chạy TRƯỚC chốt giữ.
 *
 * Chủ salon chép nhầm một bài thần dược thành content thì mất uy tín nghề, mà uy tín
 * nghề là thứ duy nhất giữ khách quay lại ghế.
 *
 * CẨN THẬN khi thêm từ khóa: nghiên cứu thật cũng nói "regrowth", "minoxidil",
 * "hair growth". Chỉ chặn khi có NGÔN NGỮ CAM KẾT đi kèm, đừng chặn từ chuyên môn trần.
 */
function laQuangCaoThanDuoc(text) {
  const raw = String(text || "");
  const v = boDau(raw);

  // Cam kết mốc thời gian cho việc mọc tóc. Dấu hiệu chắc chắn nhất của bài quảng cáo.
  if (/(moc|dai|day|phuc hoi|het rung|giam rung)\s?toc\s?(sau|trong|chi sau|chi trong)\s?\d+\s?(ngay|tuan|thang)/.test(v)) return true;
  if (/\d+\s?(ngay|tuan|thang)\s?(het|khong con|sach)\s?(rung toc|hoi|gau|toc bac)/.test(v)) return true;
  if (/(regrow|grow back|thicker hair|stop hair loss)\D{0,20}in\s+\d+\s+(days|weeks|nights)/.test(v)) return true;
  if (/\d+\s?%\s?(hair )?(regrowth|thicker|less shedding)\s?(guaranteed|in \d)/.test(v)) return true;

  // Cam kết tuyệt đối. Nang tóc đã teo thì không có cách nào hứa chắc như thế.
  const camKet = [
    "het hoi vinh vien", "het rung toc vinh vien", "khoi hoi hoan toan",
    "moc toc 100", "phuc hoi 100", "hu ton 100", "hieu qua 100",
    "tri rung toc tan goc", "tri hoi tan goc", "danh bay gau vinh vien",
    "cam ket moc toc", "cam ket hoan tien", "cam ket hieu qua",
    "hieu qua sau 1 lieu trinh", "hieu qua ngay lan dau",
    "cure baldness", "bald cure", "cure for baldness overnight",
    "permanent hair loss cure", "guaranteed regrowth", "reverse balding naturally"
  ];
  for (const k of camKet) if (v.includes(k)) return true;

  // Ngôn ngữ chào hàng, giống ba app trước nhưng đổi mặt hàng.
  const chaoHang = [
    "than duoc", "thuoc moc toc gia truyen", "bai thuoc gia truyen",
    "bi quyet dan gian moc toc", "meo dan gian tri hoi",
    "lieu trinh phuc hoi toc", "cong nghe phuc hoi toc",
    "dat ngay hom nay", "inbox de duoc tu van", "lien he hotline", "dang ky ngay",
    "uu dai duy nhat", "gia chi con", "mua 1 tang 1", "combo cham toc",
    "vien uong moc toc", "san pham duoc hang nghin", "duoc bo y te cap phep",
    "miracle hair", "hair miracle", "hair growth secret", "one weird trick",
    "doctors hate", "shark tank", "hair gummies", "rice water miracle",
    "click here", "order now", "buy now", "limited offer", "money back guarantee"
  ];
  for (const k of chaoHang) if (v.includes(k)) return true;

  // Giá tiền gắn với liệu trình trong tiêu đề gần như luôn là chào hàng.
  if (/\d[\d.,]*\s?(vnd|vnđ|đ\/|k\/)\s?(lieu trinh|buoi|hop|lo|lan)/.test(v)) return true;

  // Số điện thoại trong nội dung.
  if (/(^|[^\d])(0[35789])\d{8}([^\d]|$)/.test(raw)) return true;

  return false;
}

/* ---------- nhận diện NỘI DUNG HẠI VỀ TÂM LÝ ----------
 * Người đọc cuối cùng là khách ngồi trên ghế salon. Trong đó có người rụng tóc sau sinh,
 * người rụng tóc vì thuốc, người hói theo gen, người tóc bạc sớm. Rụng tóc là chuyện sức
 * khỏe và tuổi tác, không phải chuyện đáng xấu hổ.
 *
 * Ba loại bài chặn thẳng, không cho vào kho:
 *   - Chế giễu hói, chế giễu tóc thưa, lấy đầu hói ra làm trò.
 *   - Gán tóc xấu với thất bại, với ế, với kém hấp dẫn.
 *   - Lấy sự tự ti làm đòn bẩy bán hàng.
 *
 * Đây không phải chuyện lọc cho sạch feed, mà là chuyện không đưa nguyên liệu độc vào
 * tay người sắp viết bài cho hàng nghìn người đọc.
 */
function laHaiVeTamLy(text) {
  const v = boDau(String(text || ""));

  const chan = [
    // Chế giễu thẳng.
    "bald shaming", "bald and ugly", "ugly bald", "balding losers",
    "bald jokes", "make fun of bald", "laugh at bald",
    "che gieu hoi", "cuoi nguoi hoi", "dau hoi xau xi", "troc loc xau xi",
    "hoi dau la xau", "toc thua xau xi", "mai toc xau xi",

    // Gán tóc với giá trị con người.
    "no one dates bald", "nobody wants a bald", "bald men cant",
    "hair loss ruined my life", "balding is a death sentence",
    "your hair says you failed", "bad hair means",
    "e vi hoi", "khong ai lay nguoi hoi", "hoi thi kho lay vo",
    "toc xau thi kho thanh cong", "toc xau la thieu ban linh",

    // Lấy tự ti làm đòn bẩy bán hàng.
    "dung de mai toc to cao ban", "so nguoi khac nhin thay dinh dau",
    "xau ho vi mai toc", "tu ti vi mai toc", "giau dinh dau di",
    "hide your bald spot before", "before anyone notices youre balding"
  ];
  for (const k of chan) if (v.includes(k)) return true;

  return false;
}

/* ---------- nhận diện BÀI LẠC CHỦ ĐỀ ----------
 * Feed tạp chí làm đẹp (Allure, Elle, Kênh 14) và báo sức khỏe Việt là feed CẢ CHUYÊN
 * MỤC, nên lọt rất nhiều bài son, móng, da, thời trang. Đúng như đã đo ở bước kiểm
 * nguồn: bài đầu của Allure là mascara, của Elle là móng tay, của Cosmetics Business là
 * kem đánh răng. Từ khóa loại trừ trong cau-hinh.json lo phần lớn; hàm này bắt các dạng
 * hay lọt mà chotGiuLai lại cứu nhầm.
 *
 * Giữ đúng phần tóc và da đầu, bỏ phần còn lại của ngành làm đẹp.
 */
function laLacChuDe(text) {
  const raw = String(text || "").toLowerCase();
  const v = boDau(raw);

  // Nhận biết bài có dính tới tóc hay không, để còn tha cho nó ở các chốt bên dưới.
  //
  // PHẢI đọc phần tiếng Việt trên chuỗi CÒN DẤU. Bỏ dấu xong thì "da đầu" (scalp) và
  // "da dầu" (oily skin) đều thành "da dau", làm bài kem chống nắng cho da dầu bị coi là
  // bài về da đầu rồi lọt thẳng vào kho. Đã đo thật bằng thu-bo-loc.js.
  const coTocAnh = /(^|[^a-z0-9])(hair|scalp|stylist|salon|barber)([^a-z0-9]|$)/.test(v);
  const coTocViet = /(^|[^a-zà-ỹ])(tóc|da đầu|gội đầu)([^a-zà-ỹ]|$)/.test(raw);
  const coToc = coTocAnh || coTocViet;

  // Bài danh sách sản phẩm làm đẹp KHÔNG dính tới tóc.
  if (!coToc && /\b\d+\s+(best|top)\b.*(skin|makeup|serum|mascara|perfume|lipstick|nail|foundation|sunscreen)/.test(v)) return true;
  // Số nhiều phải khai rõ: \b sau "dress" không khớp "dresses". Đã lọt đúng chỗ này.
  if (/(best|top)\s+\d+[^.]*\b(dress|dresses|jeans|sneakers|leggings|bras|handbag|handbags)\b/.test(v)) return true;

  // Mảng làm đẹp khác, bài nào không nhắc tới tóc thì bỏ.
  if (!coToc) {
    const mangKhac = [
      "manicure", "pedicure", "nail art", "gel nails", "nails", "nail",
      "lash extensions", "eyebrow", "microblading", "botox", "filler",
      "lip gloss", "lipstick", "mascara", "foundation", "concealer", "blush",
      "fragrance", "perfume", "eau de parfum", "skincare", "sunscreen",
      "spa", "medspa", "med spa", "wellness month", "fashion",
      "son moi", "son duong", "mong tay", "mong chan",
      "trang diem", "kem chong nang", "kem duong da", "nuoc hoa",
      "mi mat", "long mi", "chan may", "phun xam", "thoi trang"
    ];
    // Ranh giới từ, không dùng includes(): "spa" nằm trong "space", "Spain", "spam".
    for (const k of mangKhac) {
      if (new RegExp("(^|[^a-z0-9])" + k + "(s)?($|[^a-z0-9])").test(v)) return true;
    }
  }

  // Nhiễu của feed tạp chí học thuật: mục lục số, lời tòa soạn, thông tin số báo.
  // Không phải bài, không dùng làm gì được. Dấu nháy của Wiley là dấu cong nên khớp lỏng.
  if (/editor.{0,3}s highlights/.test(v)) return true;
  for (const k of ["issue information", "table of contents", "cover image", "masthead"]) {
    if (v.includes(k)) return true;
  }

  // Tin hình sự và tai nạn xảy ra TẠI salon. Có chữ salon nhưng không phải chuyện nghề.
  // Đã đo thật: truy vấn "hair salon business" trả về "car crashes into hair salon".
  if (/(crash|crashed|robbery|robbed|shooting|stabbed|arson|burglary)/.test(v) && /(salon|barbershop|barber shop)/.test(v)) return true;
  if (/(cuop|dam xe|chay|danh nhau|an trom)/.test(v) && /(tiem toc|salon)/.test(v)) return true;

  // Hoạt động đoàn thể và từ thiện. Đúng chữ "cắt tóc" nhưng không phải chuyện nghề.
  const doanThe = [
    "cat toc mien phi", "cat toc tu thien", "cat toc 0 dong",
    "chi doan", "doan thanh nien", "hoi phu nu xa", "dan quan tu ve"
  ];
  for (const k of doanThe) if (v.includes(k)) return true;

  // Tin thời sự y tế nặng, không dùng làm content salon được.
  const thoiSu = [
    "qua doi", "tu vong do", "cap cuu vi tai nan", "ngo doc tap the",
    "dich benh bung phat", "so ca mac moi", "benh vien qua tai"
  ];
  for (const k of thoiSu) if (v.includes(k)) return true;

  return false;
}

/* ---------- chạy ---------- */

const NHOM_HOP_LE = new Set(["nghe", "khoahoc", "xuhuong", "vn"]);

async function chay() {
  const cauHinh = JSON.parse(fs.readFileSync(path.join(THU_MUC, "cau-hinh.json"), "utf8"));

  // CHI_DICH=1: bỏ hẳn bước lấy tin, chỉ lọc lại kho cũ rồi viết gợi ý cho bài còn thiếu.
  // Dùng cho lần đầu chạy bù cả kho, khỏi phải ngồi chờ Reddit nhả thêm mấy phút nữa.
  const CHI_DICH = process.env.CHI_DICH === "1";
  const nguonBat = CHI_DICH ? [] : cauHinh.nguon.filter(n => n.trangThai === "bat");

  ghiLog(CHI_DICH
    ? "Chế độ CHỈ VIẾT GỢI Ý: không lấy tin mới, chỉ làm tiếp kho đang có."
    : `Bắt đầu quét ${nguonBat.length} nguồn`);

  const thoRa = [];
  // Reddit đếm số lần gọi theo địa chỉ IP, không theo từng sub. Gọi liền tay là 429.
  // Nghỉ giữa hai lần gọi Reddit là cách rẻ nhất để lấy đủ các sub.
  const NGHI_REDDIT = Number(process.env.NGHI_REDDIT) || 22000;
  let lanRedditCuoi = 0;

  for (const ng of nguonBat) {
    try {
      const laReddit = ng.loai === "reddit";
      if (laReddit) {
        const cho = NGHI_REDDIT - (Date.now() - lanRedditCuoi);
        if (lanRedditCuoi && cho > 0) await nghi(cho);
        lanRedditCuoi = Date.now();
      }
      // Reddit: thử lại nhiều lần hơn và nghỉ dài hơn. Sub nào vẫn lỡ thì lần chạy
      // hôm sau nhặt tiếp, vì dữ liệu được gộp dồn chứ không ghi đè.
      const text = laReddit
        ? await tai(thayEnv(ng.url), 4, 25000)
        : await tai(thayEnv(ng.url));
      let items;
      if (ng.loai === "reddit") items = docReddit(text, ng.ten);
      else items = docFeed(text);

      if (!items.length) { ghiLog(`  ${ng.ten}: đọc được nhưng không thấy tin nào`); continue; }

      // Reddit: chỉ lấy N bài đầu của bảng xếp hạng tuần.
      if (ng.loai === "reddit" && ng.soBaiDau) {
        items = items.filter(x => (x.rank || 99) <= ng.soBaiDau);
      }

      items.forEach(it => thoRa.push({
        ...it, nguon: ng.ten, hang: ng.hang,
        nhom: NHOM_HOP_LE.has(ng.nhom) ? ng.nhom : "xuhuong",
        loai: ng.loai || "rss",
        giuTatCa: !!ng.giuTatCa,        // giữ mọi bài, không đòi từ khóa ngành
        khongPT: !!ng.khongPhanTich     // bỏ qua gợi ý AI cho nguồn này
      }));
      ghiLog(`  ${ng.ten}: ${items.length} tin`);
    } catch (e) {
      ghiLog(`  ${ng.ten}: LỖI — ${e.message}`);
    }
  }

  // lọc theo từ khóa
  const locRa = [];
  let boQuangCao = 0, boHai = 0, boLac = 0;
  for (const it of thoRa) {
    if (!it.tieuDe || !it.lien) continue;

    // Google News gắn " - Tên báo" ở cuối tiêu đề và tên báo thật ở thẻ <source>.
    // Bỏ đuôi đó cho tiêu đề sạch, lấy tên báo gốc làm nguồn hiển thị.
    let tieuDe = it.tieuDe;
    let nguonHienThi = it.nguonGoc || it.nguon;
    const laGoogle = /news\.google\.com/i.test(it.lien) || /google\.com\/rss/i.test(it.lien);
    if (it.nguonGoc) {
      const duoi = " - " + it.nguonGoc;
      if (tieuDe.endsWith(duoi)) tieuDe = tieuDe.slice(0, -duoi.length).trim();
    }

    // Mô tả của Google News là một khối HTML danh sách link, không dùng làm tóm tắt.
    let tom = laGoogle ? "" : it.tom;

    const toanVan = tieuDe + " " + (it.tom || "");

    // BA BỘ LỌC AN TOÀN, chạy TRƯỚC chốt giữ lại. Cố ý: bài quảng cáo thần dược luôn
    // khoe số liệu ấn tượng nhất, để chotGiuLai chạy trước là nó cứu nhầm hết.
    if (laQuangCaoThanDuoc(toanVan)) { boQuangCao++; continue; }
    if (laHaiVeTamLy(toanVan)) { boHai++; continue; }
    // Lạc chủ đề thì xét TIÊU ĐỀ thôi, không xét tóm tắt. Chủ đề bài nằm ở tiêu đề.
    // Đã đo thật: bài "16 New Fragrances" của Refinery29 có chữ "hair" nằm đâu đó giữa
    // đoạn tóm tắt dài, thế là bộ lọc tưởng bài về tóc rồi cho qua.
    if (laLacChuDe(tieuDe)) { boLac++; continue; }

    const loaiTru = demTuKhoa(toanVan, cauHinh.tuKhoaLoaiTru);
    const giuBangChung = chotGiuLai(toanVan);
    if (loaiTru.soLan > 0 && !giuBangChung) continue;

    const nganh = demTuKhoa(toanVan, cauHinh.tuKhoaNganh);
    // Nguồn thường: đòi ít nhất 1 từ khóa ngành. Nguồn đã chuyên đề (giuTatCa, ví dụ
    // ScienceDaily mục Rụng tóc): giữ mọi bài.
    if (!it.giuTatCa && nganh.soLan < 1) continue;

    const chuDe = demTuKhoa(toanVan, cauHinh.tuKhoaChuDe);
    const manh = demTuKhoa(toanVan, cauHinh.tuKhoaManh || []);
    const d = chuanNgay(it.ngay);

    // Mức quan trọng. Bài Reddit không có điểm thật nên dùng thứ hạng trong bảng tuần.
    let imp;
    if (it.loai === "reddit") {
      imp = (it.rank && it.rank <= 3) ? "vua" : "thap";
    } else {
      imp = chamMuc(nganh.soLan, chuDe.soLan, manh.soLan);
    }

    locRa.push({
      d: d ? ngayISO(d) : ngayISO(new Date()),
      src: nguonHienThi,
      hang: it.hang,
      g: it.nhom,
      imp,
      t: tieuDe,
      s: tom.length > 420 ? tom.slice(0, 417).trim() + "…" : tom,
      // Chỗ giữ tạm trước khi AI viết. Sau lần chạy đầu, .w là tóm tắt tiếng Việt thật.
      w: goiYTam(it.nhom, nganh.trung, manh.trung),
      u: it.lien,
      khongPT: it.khongPT,
      khoa: [...new Set([...manh.trung, ...nganh.trung, ...chuDe.trung])].slice(0, 8)
    });
  }
  if (!CHI_DICH) {
    ghiLog(`Bộ lọc an toàn đã bỏ: ${boQuangCao} bài quảng cáo thần dược, ${boHai} bài hại tâm lý, ${boLac} bài lạc chủ đề.`);
  }

  // gộp với dữ liệu cũ, khử trùng lặp theo đường dẫn
  let cu = [];
  let nguonCu = [];
  if (fs.existsSync(FILE_TIN)) {
    try {
      const j = JSON.parse(fs.readFileSync(FILE_TIN, "utf8"));
      cu = j.tin || [];
      nguonCu = j.nguonDaQuet || [];
    } catch (e) { cu = []; }
  }
  // Gộp: bài vừa quét lại LUÔN dùng bản mới, không giữ bản cũ. Nhờ vậy mỗi lần sửa lỗi
  // bóc tách là dữ liệu cũ cũng được chữa theo, thay vì ôm cái sai mãi. Riêng phần AI đã
  // trả tiền (w, hook, goc, lu, tv, wa) thì bê nguyên từ bản cũ sang để khỏi làm lại.
  const cuTheoU = new Map(cu.map(x => [x.u, x]));
  for (const x of locRa) {
    const c = cuTheoU.get(x.u);
    if (c && c.wa) {
      x.w = c.w; x.hook = c.hook; x.goc = c.goc; x.lu = c.lu; x.tv = c.tv; x.wa = c.wa;
    }
  }
  // Khử trùng lặp hai vòng. Vòng một theo đường dẫn, vòng hai theo TIÊU ĐỀ.
  // Vòng hai là cần thiết: Modern Salon và Salon Today là hai báo cùng nhà, đăng lại
  // của nhau, đường dẫn khác nhau mà bài y hệt. Lần quét đầu có 13 tiêu đề bị nhân đôi.
  const daThayTieuDe = new Set();
  const daLoc = [...locRa, ...cu]
    .filter((x, i, a) => a.findIndex(y => y.u === x.u) === i)
    .filter(x => {
      const khoa = boDau(x.t || "").replace(/[^a-z0-9]+/g, " ").trim();
      if (!khoa) return true;
      if (daThayTieuDe.has(khoa)) return false;
      daThayTieuDe.add(khoa);
      return true;
    })
    .filter(x => {
      // Bộ lọc an toàn quét LẠI TOÀN BỘ kho mỗi lần chạy, không chỉ tin vừa quét.
      // Bài học đã trả giá ở app SỨC BẬT: sửa bộ lọc mà chỉ áp cho tin mới thì hàng
      // trăm bài cũ vẫn nằm nguyên trong kho với nội dung đáng lẽ phải bỏ.
      const t = (x.t || "") + " " + (x.s || "");
      if (laQuangCaoThanDuoc(t)) return false;
      if (laHaiVeTamLy(t)) return false;
      if (laLacChuDe(x.t || "")) return false;   // chỉ tiêu đề, giống lúc lọc tin mới
      return true;
    })
    .sort((a, b) => b.d.localeCompare(a.d));

  // Cắt trần RIÊNG cho từng nhóm, để nhóm đăng dày (Việt Nam, xu hướng) không lấn chỗ
  // của nhóm đăng thưa (phụ nữ, khoa học).
  const tinKH = daLoc.filter(x => x.g === "khoahoc").slice(0, cauHinh.soTinKhoaHoc || 120);
  const tinNghe = daLoc.filter(x => x.g === "nghe").slice(0, cauHinh.soTinNghe || 120);
  const tinXH = daLoc.filter(x => x.g === "xuhuong").slice(0, cauHinh.soTinXuHuong || 120);
  const tinVN = daLoc.filter(x => x.g === "vn").slice(0, cauHinh.soTinVN || 120);
  const tatCa = [...tinNghe, ...tinKH, ...tinXH, ...tinVN];

  // Đếm bài mới SAU khi đã lọc và cắt trần, không đếm lúc vừa quét về. Mỗi lượt quét kéo
  // về hàng nghìn bài thô mà giữ lại vài chục; đếm ở đầu vào thì con số trong nhật ký vô
  // nghĩa và file lịch sử ngày phình toàn bài đã bị bỏ.
  const moi = tatCa.filter(x => !cuTheoU.has(x.u));

  const soanKetQua = () => ({
    capNhatLuc: new Date().toISOString(),
    soTin: tatCa.length,
    tinMoiLanNay: moi.length,
    theoNhom: { nghe: tinNghe.length, khoahoc: tinKH.length, xuhuong: tinXH.length, vn: tinVN.length },
    // Chế độ chỉ viết gợi ý không quét nguồn nào, giữ lại danh sách của lần quét trước
    // để dòng trạng thái trên trang không tụt về "0 nguồn".
    nguonDaQuet: CHI_DICH ? nguonCu : nguonBat.map(n => n.ten),
    tin: tatCa
  });
  fs.mkdirSync(LICH_SU, { recursive: true });
  fs.mkdirSync(DU_LIEU, { recursive: true });
  const ghiFileTin = () => {
    fs.writeFileSync(FILE_TIN, JSON.stringify(soanKetQua(), null, 1), "utf8");
  };
  // Ghi ngay một lần TRƯỚC khi gọi AI. Không có bước này thì lần chạy đầu mà API hỏng
  // là không có file dữ liệu nào, trang trắng trơn dù đã quét được cả nghìn bài.
  ghiFileTin();

  // XEN KẼ BỐN NHÓM trước khi viết gợi ý.
  //
  // tatCa xếp theo nhóm (nghề hết rồi mới tới khoa học, xu hướng, Việt Nam). Đưa
  // nguyên thứ tự đó cho AI thì trần MAX_PHANTICH tiêu hết vào nhóm đầu, ba tab còn lại
  // không có lấy một câu gợi ý nào. Đã thấy đúng như vậy ở lần chạy đầu: 40 bài xong thì
  // cả 40 đều nằm ở tab Khoa học.
  //
  // Đây là MẢNG CÙNG THAM CHIẾU tới các phần tử của tatCa, nên AI ghi vào đâu thì tatCa
  // thấy ở đó. Không được sao chép sâu.
  const xen = [];
  const nhomTheoThuTu = [tinNghe, tinKH, tinXH, tinVN];
  for (let i = 0; i < Math.max(...nhomTheoThuTu.map(a => a.length)); i++) {
    for (const nhom of nhomTheoThuTu) if (nhom[i]) xen.push(nhom[i]);
  }

  await boSungYKien(xen, ghiFileTin);

  const ketQua = soanKetQua();
  ghiFileTin();
  chenSSR(tatCa);
  fs.writeFileSync(
    path.join(LICH_SU, ngayISO(new Date()) + ".json"),
    JSON.stringify({ capNhatLuc: ketQua.capNhatLuc, tin: moi }, null, 1),
    "utf8"
  );
  donLichSu(cauHinh.soNgayGiuLichSu);

  ghiLog(`Xong. ${moi.length} tin mới, tổng ${tatCa.length} tin (nghề ${tinNghe.length}, khoa học ${tinKH.length}, xu hướng ${tinXH.length}, Việt Nam ${tinVN.length}).`);
  if (moi.length) {
    ghiLog("Tin mới nổi bật:");
    moi.filter(x => x.imp === "cao").slice(0, 5).forEach(x => ghiLog(`  · ${x.t}`));
  }
  return ketQua;
}

// Câu giữ chỗ trước khi AI viết xong. Không để trống để trang không bị hụt.
function goiYTam(nhom, nganh, manh) {
  const dau = nhom === "nghe" ? "Tin nghề và vận hành salon."
    : nhom === "khoahoc" ? "Bài nghiên cứu hoặc tin khoa học."
      : nhom === "vn" ? "Tin trong nước."
        : "Tin xu hướng và thói quen của khách.";
  if (manh.length) return `${dau} Có tín hiệu bằng chứng: ${manh.slice(0, 3).join(", ")}. Gợi ý content sẽ có sau lần chạy phân tích tới.`;
  if (nganh.length) return `${dau} Liên quan tới ${nganh.slice(0, 3).join(", ")}. Gợi ý content sẽ có sau lần chạy phân tích tới.`;
  return `${dau} Gợi ý content sẽ có sau lần chạy phân tích tới.`;
}

function donLichSu(soNgay) {
  try {
    const han = Date.now() - soNgay * 86400000;
    for (const f of fs.readdirSync(LICH_SU)) {
      const p = path.join(LICH_SU, f);
      if (fs.statSync(p).mtimeMs < han) fs.unlinkSync(p);
    }
  } catch (e) { /* bỏ qua */ }
}

if (require.main === module) {
  chay().catch(e => { ghiLog("LỖI NGHIÊM TRỌNG: " + e.message); process.exit(1); });
}

module.exports = {
  chay, docFeed, docReddit, thayEnv, chuanNgay, goHtml, boDau,
  chotGiuLai, laQuangCaoThanDuoc, laHaiVeTamLy, laLacChuDe
};
