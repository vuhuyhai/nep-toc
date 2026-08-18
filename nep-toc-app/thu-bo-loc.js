/**
 * NẾP TÓC — Thử ba bộ lọc an toàn bằng mẫu.
 * Chạy:  node thu-bo-loc.js
 *
 * Vì sao cần file này: bộ lọc chặn nhầm thì âm thầm, không ai biết. Bài tốt biến mất
 * khỏi kho mà nhật ký chỉ ghi một con số. Nên mỗi lần sửa từ khóa phải chạy lại đây.
 *
 * Mẫu chia hai phần: PHẢI CHẶN và PHẢI GIỮ. Phần PHẢI GIỮ quan trọng hơn, vì chặn hụt
 * một bài rác thì người đọc bỏ qua được, còn chặn nhầm một nghiên cứu thật thì mất luôn.
 */
const { laQuangCaoThanDuoc, laHaiVeTamLy, laLacChuDe, chotGiuLai } = require("./thu-thap.js");

const PHAI_CHAN = [
  ["quangcao", "Bí quyết dân gian mọc tóc sau 7 ngày, hết hói vĩnh viễn"],
  ["quangcao", "Liệu trình phục hồi tóc hư tổn 100%, cam kết hoàn tiền"],
  ["quangcao", "Thuốc mọc tóc gia truyền, inbox để được tư vấn"],
  ["quangcao", "Viên uống mọc tóc giá chỉ còn 299k, mua 1 tặng 1"],
  ["quangcao", "Serum trị rụng tóc tận gốc, liên hệ hotline 0987654321"],
  ["quangcao", "This hair miracle will cure baldness overnight, doctors hate it"],
  ["quangcao", "Regrow your hairline in 14 days, guaranteed regrowth"],
  ["quangcao", "Hết gàu sau 3 ngày với bài thuốc gia truyền"],

  ["haitamly", "Đầu hói xấu xí: 10 kiểu tóc che đi cho đỡ ngại"],
  ["haitamly", "Bald shaming is back on TikTok and it is hilarious"],
  ["haitamly", "Ế vì hói, chàng trai quyết cấy tóc"],
  ["haitamly", "Đừng để mái tóc tố cáo bạn trước mặt đồng nghiệp"],
  ["haitamly", "No one dates bald men, says viral survey"],

  ["lacchude", "10 best mascaras for sensitive eyes in 2026"],
  ["lacchude", "Xu hướng móng tay mùa hè: tông pastel lên ngôi"],
  ["lacchude", "Top 15 dresses to wear this spring"],
  ["lacchude", "Woman hospitalized after car crashes into hair salon"],
  ["lacchude", "Chi đoàn Công an xã triển khai điểm cắt tóc miễn phí cho bà con"],
  ["lacchude", "Kem chống nắng nào hợp da dầu mùa hè"],
];

const PHAI_GIU = [
  "Study finds minoxidil regrowth rates higher in early androgenetic alopecia",
  "Nghiên cứu mới: 62% người rụng tóc sau sinh hồi phục trong 12 tháng",
  "Salon pricing report: hair color volume is down, but ticket value is up",
  "Textbooks were wrong: scientists reveal how human hair follicles form",
  "Ozempic and Mounjaro linked to a surprising hair loss signal in new data",
  "Thợ làm tóc kiệt sức: khảo sát 1.200 stylist tại Anh",
  "Bác sĩ da liễu chỉ 6 mẹo giảm gàu, có dẫn nghiên cứu",
  "Ulta Beauty bets on the growing scalp-care market with new brand",
  "Keratin treatment safety: what the formaldehyde research actually says",
  "Cách tư vấn khách rụng tóc mà không hứa quá lời",
  "Trào lưu tự nhuộm tóc tại nhà lên ngôi, thợ nói gì",
  "Hair transplant clinics face new advertising rules in the UK",
  "10 best shampoos for oily scalp, tested by stylists",
  "Xu hướng tóc 2026: 8 kiểu tóc hợp dân văn phòng",
];

let hongChan = 0, hongGiu = 0;

console.log("=== PHẢI CHẶN ===");
for (const [loai, t] of PHAI_CHAN) {
  const qc = laQuangCaoThanDuoc(t);
  const ht = laHaiVeTamLy(t);
  const lc = laLacChuDe(t);
  const batBoi = qc ? "quangcao" : ht ? "haitamly" : lc ? "lacchude" : null;
  const dat = batBoi !== null;
  if (!dat) hongChan++;
  console.log((dat ? "  ok  " : "  LỌT ") + (batBoi || "khong bo loc nao").padEnd(10) + " | " + t.slice(0, 62));
}

console.log("\n=== PHẢI GIỮ ===");
for (const t of PHAI_GIU) {
  const qc = laQuangCaoThanDuoc(t);
  const ht = laHaiVeTamLy(t);
  const lc = laLacChuDe(t);
  const biChan = qc || ht || lc;
  if (biChan) hongGiu++;
  const boi = qc ? "quangcao" : ht ? "haitamly" : lc ? "lacchude" : "";
  console.log((biChan ? "  CHẶN NHẦM bởi " + boi : "  ok  giữ được").padEnd(28) + " | " + t.slice(0, 62)
    + (chotGiuLai(t) ? "   [có bằng chứng]" : ""));
}

console.log("");
console.log(`Lọt lưới: ${hongChan}/${PHAI_CHAN.length}. Chặn nhầm: ${hongGiu}/${PHAI_GIU.length}.`);
process.exit(hongChan + hongGiu > 0 ? 1 : 0);
